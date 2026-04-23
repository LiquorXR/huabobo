# Agent Guide: Hua Bobo DIY System

## 🛠 Critical Commands
- `npm run dev`: Starts the development server using nodemon (`nodemon server.js`). Primary command for local development.
- `node scripts/setup-https.js`: Required to generate local certificates if `USE_HTTPS=true` is set in `.env`. Do this before starting the server in HTTPS mode.

## 🏗 Architecture Context
- **Config Injection**: `server.js` dynamically injects `window.ENV_CONFIG` into `public/index.html` by replacing the `</head>` tag. **Never** remove the `</head>` tag from `index.html`.
- **API Proxy**: All Gemini API calls must go through `POST /api/ask-master`. The client never calls Gemini directly. Enforced `maxOutputTokens: 100`.
- **Database**: Sequelize with `{ alter: true }` syncs schema on startup.
  - SQLite: Default, `database/dev.sqlite`. Contains logic to dedupe users and drop backup tables during sync.
  - PostgreSQL: Supported via `DB_DIALECT=postgres` (used in Docker).
- **Admin Bootstrap**: The first user registered via `/api/auth/register` is automatically granted the `admin` role.
- **Local Libs**: Core libraries (Three.js, MediaPipe) are vendored in `public/lib/`. Avoid external CDN links to ensure offline/exhibition reliability.
- **Resources**: 3D models and carousel images are stored as `BLOB` in the database (`ModelResource`, `CarouselImage` tables) and managed via Admin UI.

## 🤖 Operation & Constraints
- **Environment**: `.env` is required. `GEMINI_API_KEY` is mandatory.
- **Security**: `server.js` auto-generates `JWT_SECRET` and writes it to `.env` if missing or default.
- **Rate Limits**: `POST /api/ask-master` is limited to 100 requests per 15 minutes per IP.
- **3D Logic**:
  - `public/js/core/app.js`: Scene lifecycle and state.
  - `public/js/modules/hand-tracker.js`: Maps MediaPipe gestures to 3D controls with EMA smoothing.
