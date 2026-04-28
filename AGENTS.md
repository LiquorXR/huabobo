# Agent Guide: Hua Bobo DIY System

## 🛠 Critical Commands
- `npm run dev`: Starts the development server using nodemon (`nodemon server.js`). Primary command for local development.
- `node scripts/setup-https.js`: Required to generate local certificates if `USE_HTTPS=true` is set in `.env`. Do this before starting the server in HTTPS mode.
- `docker compose up -d --build`: Production deployment with PostgreSQL.

## 🏗 Architecture Context
- **Default Port**: `3179`
- **Config Injection**: `server.js` dynamically injects `window.ENV_CONFIG` into `public/index.html` by replacing the `</head>` tag. **Never** remove the `</head>` tag from `index.html`.
- **API Proxy**: All Gemini API calls must go through `POST /api/ask-master`. The client never calls Gemini directly. Enforced `maxOutputTokens: 100`.
- **Database**: Sequelize with `{ alter: true }` syncs schema on startup.
  - SQLite: Default, `database/dev.sqlite`. Contains logic to dedupe users and drop backup tables during sync.
  - PostgreSQL: Supported via `DB_DIALECT=postgres` (used in Docker).
- **Admin Bootstrap**: The first user registered via `/api/auth/register` is automatically granted the `admin` role.
- **Local Libs**: Core libraries (Three.js, MediaPipe) are vendored in `public/lib/`. Avoid external CDN links to ensure offline/exhibition reliability.
- **Resources**: 3D models and carousel images are stored as `BLOB` in the database (`ModelResource`, `CarouselImage` tables) and managed via Admin UI.

## 🖥 VPS Deployment
- **Docker Compose**: Two services — `web` (Node + PM2 cluster) and `db` (PostgreSQL 15 Alpine). PM2 config at `ecosystem.config.js` uses `instances: 'max'` in cluster mode with 512 MB memory limit.
- **Healthchecks**: Both `web` and `db` have Docker healthchecks. `web` waits for `db` to be healthy before starting.
- **HTTPS**: The app itself runs HTTP on port 3179. Use Nginx or Caddy as a TLS-terminating reverse proxy on the VPS. Rewrite client IP via `X-Forwarded-For` / `X-Real-IP` headers.
- **Firewall**: Only expose ports 80/443 on the VPS. Do not expose port 3179 or 5432 directly to the internet.
- **Setup flow**: `git clone` → `cp .env.example .env` → edit `.env` (GEMINI_API_KEY, JWT_SECRET, DB creds) → `docker compose up -d --build`.
- **Stop**: `docker compose down` (add `-v` to wipe the DB volume). Data persists in Docker named volume `postgres_data` unless `-v` is used.

## 🐛 Dialog System — Critical Patterns
- **Timer lifecycle**: Every `setTimeout` used for hide animations (300ms) in `dismissDialog()`, `hideAccountSettings()`, and dialog button `onclick` handlers **must** be stored in a property (`_dismissTimer`, `_accountTimer`, `adminDismissTimer`). Before opening a new dialog, `clearTimeout()` the stale timer to prevent orphaned timers from adding `hidden` back to the fresh dialog.
- **CSS stacking**: Dialog overlays use an `absolute inset-0` backdrop div as a click-to-dismiss layer. The flex container wrapping the dialog card **must** have `relative z-10` so it renders above the absolute backdrop. Without this, all clicks on dialog buttons are intercepted by the backdrop and dismissed immediately.

## 🤖 Operation & Constraints
- **Environment**: `.env` is required. `GEMINI_API_KEY` is mandatory.
- **Security**: `server.js` auto-generates `JWT_SECRET` and writes it to `.env` if missing or default (only when `NODE_ENV !== 'production'`).
- **Rate Limits**: `POST /api/ask-master` is limited to 100 requests per 15 minutes per IP.
- **3D Logic**:
  - `public/js/core/app.js`: Scene lifecycle and state. Supports OBJ, STL, and 3MF exports.
  - `public/js/modules/hand-tracker.js`: Maps MediaPipe gestures to 3D controls with EMA smoothing.
