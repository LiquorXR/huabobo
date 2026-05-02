# Agent Guide: Hua Bobo DIY System

## Commands
- `npm run dev` — nodemon hot-reload (`nodemon server.js`). Primary dev command.
- `node scripts/setup-https.js` — generate self-signed certs before starting with `USE_HTTPS=true`.
- `docker compose up -d --build` — full production stack (Node + PostgreSQL).
- `npm run start:prod` — PM2 cluster mode (`pm2-runtime ecosystem.config.js`). Note that DB `sequelize.sync()` uses `alter: true` in dev but is deliberately called without `alter: true` in prod to avoid PM2 cluster race conditions.
- **No test/lint/typecheck scripts exist** in `package.json`. No CI config found.

## Architecture

### No Bundler, No CDN
- **No build process or bundlers are configured or expected.**
- All 12 vendor libs (Three.js, MediaPipe, Tailwind, Lucide) loaded via sync `<script>` tags from `public/lib/`. No npm build step.
- 7 app ES modules (`<script type="module">`) in `public/js/{core,modules,ui,api}/`. Bound to `window.*` for inline `onclick` handlers.
- Static lib files get `Cache-Control: public, max-age=31536000, immutable`. Everything else `max-age=0`.

### Config Injection
- `server.js:321` replaces `</head>` in `index.html` with `<script>window.ENV_CONFIG = {…}</script>`. **Never remove `</head>` from `index.html`.**
- Same values served via `GET /api/config`.

### AI API (`POST /api/ask-master`)
- JWT required (`Bearer <token>`). Client never calls AI provider directly.
- SSE streaming: `X-Accel-Buffering: no`, `res.flush()`, `req.socket.setNoDelay(true)`, 15s `AbortController` timeout.
- Non-streaming: MD5-based cache with 1hr TTL (`node-cache`).
- Thinking/reasoning: `OPENAI_ENABLE_THINKING=true` adds `thinking: { type: 'enabled' }` to upstream request.
- Error: upstream errors logged server-side (truncated 200 chars). Client always gets `"AI 服务暂时不可用，请稍后重试"`.

### Database (Sequelize v6)
- **Dev**: `sqlite` (default) in `database/dev.sqlite`, or `postgres` via `DB_DIALECT`.
- **Production Docker**: PostgreSQL. `sequelize.sync()` without `alter: true` to avoid PM2 cluster race conditions.
- **Dev**: `sequelize.sync({ alter: true })` — auto-migrates schema.
- **First registered user** gets `role: admin`.
- `runMigrations()` runs `ALTER TABLE … ADD COLUMN IF NOT EXISTS` for production upgrades. Idempotent.

### Security Headers (Helmet v8)
- `script-src-attr 'unsafe-inline'` — required for inline `onclick` handlers.
- `img-src 'self' data: blob:` — required for canvas screenshots.
- `crossOriginResourcePolicy: cross-origin` — required for MediaPipe assets.
- `crossOriginEmbedderPolicy: false` — disabled for SharedArrayBuffer compat.
- CSP also includes `'wasm-unsafe-eval'` and `https://cdn.jsdelivr.net`.

### Error Message Policy
- **All 5xx** → generic `"服务器内部错误，请稍后重试"`. Real errors logged via `console.error('[Module]', e)`.
- **4xx** → specific business messages (e.g., `"用户名已存在"`).

### Static Assets & Uploads
- `.svg` uploads explicitly blocked (XSS vector).
- Upload limit: 50MB. Extension-only validation.
- Thumbnails stored as Base64 `TEXT` in `Project.thumbnail` and `ModelResource.thumbnail`.
- `uploads/` directory writability checked at startup (`server.js:353`).

### JWT Secret Auto-Generation
- If `JWT_SECRET` is missing or default value, `server.js:18` generates a random 32-byte hex secret and persists it to `.env`.

## Frontend Isomorphic Quirks

### Dialog Timer Lifecycle
- Every `setTimeout` used for hide animations (300ms) **must** be stored in a property (`_dismissTimer`, `_accountTimer`, `adminDismissTimer`).
- Before opening a new dialog, `clearTimeout()` the stale timer to prevent orphaned timers from re-adding `hidden` class to the fresh dialog.

### CSS Stacking
- Dialog overlays: `absolute inset-0` backdrop div as click-to-dismiss. The flex container wrapping the dialog card **must** have `relative z-10` to render above the absolute backdrop.

## Operation Constraints
- `.env` required with at least `OPENAI_API_KEY`.
- `trust proxy` enabled by default. Set `TRUST_PROXY=false` in `.env` for direct access.
- Rate limits: `/api/ask-master` 100/15min, auth endpoints 30/15min.
- No pagination on admin project/user listings (acceptable for admin-only).
- **Testing:** No test suites, linting, or type checking exist in this repository. Verify changes manually by running `npm run dev` and testing via browser.
