# Agent Guide: Hua Bobo DIY System

## 🛠 Critical Commands
- `npm run dev`: Starts the development server using nodemon (`nodemon server.js`). Primary command for local development.
- `node scripts/setup-https.js`: Required to generate local certificates if `USE_HTTPS=true` is set in `.env`. Do this before starting the server in HTTPS mode.
- `docker compose up -d --build`: Production deployment with PostgreSQL.
- `npm run start:prod`: Runs PM2 cluster in production mode (`pm2-runtime ecosystem.config.js`).

## 🏗 Architecture Context

### Server
- **Default Port**: `3179`
- **Process Manager**: PM2 `instances: 'max'` cluster mode with 512MB memory limit per worker. Each worker runs an independent Express instance with its own Sequelize connection pool.
- **Compression**: Express `compression` middleware applies gzip/deflate. SSE streaming endpoints bypass compression buffering via `res.flush()` after each write.
- **Trust Proxy**: `app.set('trust proxy', 1)` is enabled by default. Set `TRUST_PROXY=false` in `.env` to disable (e.g., direct access without reverse proxy).

### Config Injection
- `server.js` dynamically injects `window.ENV_CONFIG` into `public/index.html` by replacing the `</head>` tag. **Never** remove the `</head>` tag from `index.html`.
- Injected values use `JSON.stringify()` escaping to prevent XSS via environment variable manipulation:
  ```javascript
  window.ENV_CONFIG = { OPENAI_MODEL: "gpt-4o-mini", OPENAI_ENABLE_THINKING: false };
  ```
- `/api/config` endpoint serves the same values for dynamic client-side access.

### AI API (OpenAI-Compatible)
- All AI calls go through `POST /api/ask-master`. The client never calls the AI provider directly.
- Uses OpenAI standard chat completions format (`/v1/chat/completions`).
- **Authentication**: JWT required (`authMiddleware`). Token passed as `Authorization: Bearer <token>` header from client.
- **Streaming**: Default mode is SSE (`text/event-stream`). Server proxies chunks from upstream with:
  - `X-Accel-Buffering: no` header (disables nginx buffering)
  - `res.flush()` after each write (forces past compression buffer)
  - `req.socket.setNoDelay(true)` (disables Nagle's algorithm)
  - 15-second connection timeout via `AbortController`
- **Non-streaming fallback**: When `stream: false`, buffers the full response with MD5-based caching (1-hour TTL via `node-cache`).
- **Thinking/Reasoning**: To enable, set `OPENAI_ENABLE_THINKING=true`. Adds `thinking: { type: 'enabled' }` to the upstream request. The client shows animated dots (not full text) during reasoning.
- **Reasoning effort**: Controlled by `OPENAI_REASONING_EFFORT` (default `high`). Passed as `reasoning_effort` in API request body.
- **Error handling**: Upstream API errors are logged server-side (truncated to 200 chars). Client receives generic message `"AI 服务暂时不可用，请稍后重试"`.

### Database
- **ORM**: Sequelize v6. Supports SQLite (dev) and PostgreSQL (production via Docker).
- **Sync behavior**:
  - Development: `sequelize.sync({ alter: true })` — auto-migrates schema.
  - Production (`NODE_ENV=production`): `sequelize.sync()` — no alter, avoids PM2 cluster race conditions.
  - SQLite: PRAGMA foreign_keys toggled around sync; stale backup tables auto-dropped; duplicate users deduplicated.
- **Connection pool (PostgreSQL)**: `max: 20, min: 2, acquire: 60000ms, idle: 30000ms` per worker. Postgres itself allows 100 connections.
- **Admin Bootstrap**: The first user registered via `/api/auth/register` is automatically granted the `admin` role.

### Indexes
| Table | Index | Purpose |
|-------|-------|---------|
| `Users` | UNIQUE `username` | Login lookup |
| `Users` | UNIQUE `email` | Login/check-register lookup |
| `Projects` | `userId` | User's project list |
| `Projects` | `(is_public, createdAt)` | Community listing: filter + sort coverage |
| `Likes` | `userId` | User's liked projects |
| `Likes` | `projectId` | Like count per project |
| `Likes` | UNIQUE `(userId, projectId)` | Prevent duplicate likes (DB-level enforcement) |

### Static Assets
- All libraries (Three.js, MediaPipe, Tailwind, Lucide) vendored in `public/lib/`. No CDN dependencies.
- Cache: `max-age=0` in dev, `max-age=86400` (1 day) in production.
- Total page weight: ~28.9 MB (MediaPipe 15MB + fonts 9.5MB + Three.js 1.5MB + UI libs 1MB).

### Resources
- 3D models (`.glb`, `.gltf`, `.obj`, `.stl`, `.3mf`, `.ply`, `.fbx`) stored as files in `uploads/`, referenced via `ModelResource` table.
- Carousel images (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`) stored as files in `uploads/`, referenced via `CarouselImage` table.
- File upload limit: 50MB. Extension-only validation. **`.svg` is explicitly blocked** (XSS vector).
- Thumbnails stored as Base64 `TEXT` in both `Project.thumbnail` and `ModelResource.thumbnail`.

## 🖥 VPS Deployment

### Docker Compose
- Two services: `web` (Node + PM2 cluster) and `db` (PostgreSQL 15 Alpine).
- PM2 config at `ecosystem.config.js` uses `instances: 'max'` in cluster mode with 512 MB memory limit.
- `web` waits for `db` healthcheck (`pg_isready`) before starting.

### Environment Variables (.env)
```
# Required
OPENAI_API_KEY=sk-your-key            # API key for OpenAI-compatible provider
JWT_SECRET=your-secret-string         # JWT signing secret

# Optional with defaults
OPENAI_API_URL=https://api.openai.com/v1   # Base URL (supports any OpenAI-compatible provider)
OPENAI_MODEL=gpt-4o-mini                   # Model name
OPENAI_ENABLE_THINKING=false               # Enable reasoning/thinking feature
OPENAI_REASONING_EFFORT=high               # Reasoning depth: low | medium | high
OPENAI_MAX_TOKENS=300                      # Max tokens per AI response
PORT=3179                                  # Server port
TRUST_PROXY=true|false                     # Trust X-Forwarded-For (default: true)
CORS_ORIGIN=*                              # CORS origin (default: *)

# Database (PostgreSQL for Docker)
DB_DIALECT=postgres
DB_HOST=db
DB_USER=postgres
DB_PASS=postgres_password
DB_NAME=huabobo
DB_PORT=5432

# HTTPS (local dev only)
USE_HTTPS=false
HTTPS_KEY_PATH=key.pem
HTTPS_CERT_PATH=cert.pem
```

### Nginx Reverse Proxy Configuration
```nginx
# Standard reverse proxy
location / {
    proxy_pass http://localhost:3179;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# SSE streaming endpoint — requires buffering disabled
location /api/ask-master {
    proxy_pass http://localhost:3179;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection '';
    proxy_read_timeout 60s;
}
```

### Firewall
Only expose ports 80/443. Do NOT expose 3179 or 5432 to the internet.

### Setup Flow
`git clone` → `cp .env.example .env` → edit `.env` (OPENAI_API_KEY, JWT_SECRET, DB creds) → `docker compose up -d --build`.

### Stop
`docker compose down` (add `-v` to wipe the postgres_data volume).

## 🐛 Dialog System — Critical Patterns
- **Timer lifecycle**: Every `setTimeout` used for hide animations (300ms) in `dismissDialog()`, `hideAccountSettings()`, and dialog button `onclick` handlers **must** be stored in a property (`_dismissTimer`, `_accountTimer`, `adminDismissTimer`). Before opening a new dialog, `clearTimeout()` the stale timer to prevent orphaned timers from adding `hidden` back to the fresh dialog.
- **CSS stacking**: Dialog overlays use an `absolute inset-0` backdrop div as a click-to-dismiss layer. The flex container wrapping the dialog card **must** have `relative z-10` so it renders above the absolute backdrop.

## 🤖 AI Master Dialog — Streaming Flow
```
User clicks "大师传艺点拨"
  → UI.setThinking(true)          — shows bouncing dots + "师傅正在审视作品，请稍候..."
  → Master.askMaster()
    → Three.js renders scene, captures PNG screenshot (full data URL)
    → POST /api/ask-master (Authorization: Bearer <jwt>, stream: true)
    → Server validates JWT via authMiddleware
    → Server forwards request to OPENAI_API_URL/chat/completions
    → SSE chunks proxied back to client with res.flush() after each write

Client SSE parsing (_handleStream):
  ├─ delta.reasoning_content → UI.showReasoningProgress() — updates text to "师傅正在深度思考..."
  ├─ delta.content (first chunk) → UI.streamingStart() — hides dots, clears text
  └─ delta.content (subsequent)  → UI.appendStreamText() — appends text in real-time

  finally → UI.setThinking(false) — hides dots, releases is-thinking guard
```

### UI Controller Methods (Master Dialog)
| Method | File:Line | Purpose |
|--------|-----------|---------|
| `setThinking(bool)` | `controller.js:1413` | Toggle dots + thinking text, guard double-request |
| `streamingStart()` | `controller.js:1455` | Clear text + hide dots for real-time streaming |
| `appendStreamText(text)` | `controller.js:1467` | Append streamed character chunks |
| `showReasoningProgress()` | `controller.js:1476` | Show "深度思考中" indicator |
| `updateSpeech(text)` | `controller.js:1430` | Typewriter effect (40ms/char) for non-streaming responses |
| `toggleMasterDialog()` | `controller.js:573` | Show/hide dialog with 300ms CSS transition |

## 🔒 Security Model

### Authentication
- JWT-based: `Bearer <token>` header, signed with HS256.
- Token payload: `{ userId, username, email, role }`, expires in 7 days.
- Stored in `localStorage` client-side (`huabobo_token` key).
- `/api/auth/login`: bcrypt comparison, cost factor 10.
- Registration: First user auto-admin. Password min length 6 characters.

### Protected Endpoints (authMiddleware required)
| Endpoint | Protection |
|----------|-----------|
| `POST /api/ask-master` | JWT + rate limit (100/15min per IP) |
| `GET /api/projects` | JWT |
| `POST /api/projects` | JWT |
| `DELETE /api/projects/:id` | JWT + ownership check |
| `POST /api/community/:id/like` | JWT |
| `PUT /api/auth/username` | JWT |
| `PUT /api/auth/email` | JWT |
| `PUT /api/auth/password` | JWT |
| `PUT /api/auth/account` | JWT |
| All `/api/admin/*` | JWT + admin role check |

### Rate Limiting
| Limiter | Window | Max | Applied To |
|---------|--------|-----|------------|
| `apiLimiter` | 15 min | 100 | `/api/ask-master` |
| `authLimiter` | 15 min | 30 | Auth login/register/check-register |

Uses `express-rate-limit` v7 with draft-7 standard headers. Real client IP is used thanks to `trust proxy`.

### Security Headers (Helmet v8)
```
Content-Security-Policy:
  default-src 'self'
  script-src 'self' 'unsafe-inline' blob:
  script-src-attr 'unsafe-inline'         ← required for onclick handlers
  style-src 'self' 'unsafe-inline'
  img-src 'self' data: blob:              ← required for canvas screenshots
  connect-src 'self'
  font-src 'self'
  worker-src 'self' blob:                 ← required for Draco workers
  media-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=15552000
Referrer-Policy: no-referrer
Cross-Origin-Resource-Policy: cross-origin  ← required for MediaPipe assets
Cross-Origin-Embedder-Policy: false         ← disabled for SharedArrayBuffer compat
```

### Error Message Policy
- **All 5xx errors** return generic `"服务器内部错误，请稍后重试"` to clients.
- **Actual error details** logged via `console.error('[Module]', e)` server-side only.
- **4xx errors** return specific business messages (e.g., `"用户名已存在"`, `"Invalid token"`).
- **Upstream AI errors** logged server-side (first 200 chars), client receives `"AI 服务暂时不可用，请稍后重试"`.

## 📊 Database Performance

### Query Patterns
| Endpoint | Queries | Index Used | Pagination |
|----------|---------|------------|------------|
| `GET /api/community` | 3 (1 project + 1 batch count + 1 user likes, parallel) | `(is_public, createdAt)` | `limit`/`offset` (default 20) |
| `GET /api/projects` | 1 | `userId` | `limit`/`offset` (default 50) |
| `POST /api/auth/login` | 1 (Op.or on username/email) | Both unique indexes | N/A |
| `GET /api/admin/stats` | 5 (3 COUNT + 2 GROUP BY) | Partial (missing `createdAt`) | N/A |
| `POST /api/community/:id/like` | 2 (find project + find like) | `projectId`, `(userId, projectId)` | N/A |

### Known Limitations
- Admin project/user listings have no pagination (acceptable for admin-only usage).
- `User.createdAt` and `Project.updatedAt` lack dedicated indexes (sort-by-date in admin stats uses filesort).
- Base64 thumbnails stored as TEXT may bloat database for large images.
- No database query caching beyond AI response cache.

## 🎨 Frontend Architecture

### Module Loading
- 7 ES modules loaded via `<script type="module">` in `index.html`:
  - `js/core/app.js` — 3D scene lifecycle, model loading, color presets, export
  - `js/ui/controller.js` — All UI dialogs, auth forms, community view, account settings
  - `js/modules/master.js` — AI master consultation dialog logic + streaming
  - `js/ui/carousel.js` — Community image carousel with touch gestures
  - `js/modules/hand-tracker.js` — MediaPipe hand gesture recognition
  - `js/modules/steamer.js` — Steaming animation sequence
  - `js/api/client.js` — API request helper with JWT header injection

### Vendor Libraries (12 synchronous scripts in `<head>`)
- Three.js + loaders (GLTFLoader, DRACOLoader, OBJLoader, OrbitControls, OBJExporter, STLExporter)
- MediaPipe (hands.js, camera_utils.js, drawing_utils.js)
- Tailwind CSS (browser runtime)
- Lucide Icons
- No bundler, no minification for app code, no code splitting (except 3MF exporter via dynamic `import()`)

### 3D Logic
- `public/js/core/app.js`: Scene lifecycle and state. Supports OBJ, STL, and 3MF exports.
- `public/js/modules/hand-tracker.js`: Maps MediaPipe gestures to 3D controls with EMA smoothing (8-frame window).
- Runs on main thread (no Web Workers for hand tracking). Camera feed failure is silently handled (gesture features degrade gracefully).

## 🚦 Operation & Constraints
- **Environment**: `.env` is required. `OPENAI_API_KEY` is mandatory.
- **Provider flexibility**: Change `OPENAI_API_URL` to switch between OpenAI, DeepSeek, or any compatible provider without code changes.
- **Thinking/Reasoning**: Requires provider support (DeepSeek, OpenAI o-series). Disable via `OPENAI_ENABLE_THINKING=false` if unsupported.
- **Security**: `server.js` auto-generates `JWT_SECRET` and writes it to `.env` if missing or default value.
- **Rate Limits**: `POST /api/ask-master` limited to 100 requests per 15 minutes per real client IP (thanks to `trust proxy`).
- **Schema sync**: In production (`NODE_ENV=production`), `sequelize.sync()` runs without `alter: true` to prevent PM2 cluster race conditions.
