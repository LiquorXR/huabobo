# Agent Guide: Hua Bobo DIY System

## 🛠 Critical Commands
- `npm run build`: **Required** after adding/removing files in `public/models/`. Updates `public/models/manifest.json`.
- `npm run dev`: Recommended for local work. Runs build then starts `nodemon server.js`.
- `npm run start`: Production entrypoint via `server.js`.

## 🏗 Architecture Notes
- **Static vs. Dynamic**: The app is a SPA served from `public/`. `server.js` (Express) injects `window.ENV_CONFIG` into `index.html` at runtime.
- **Database**: Uses Sequelize with SQLite (`database/dev.sqlite`). `syncDatabase()` uses `{ alter: true }` on startup.
- **3D Entrypoint**: `public/js/core/app.js` (Three.js scene) and `public/js/modules/hand-tracker.js` (MediaPipe mapping).
- **Local Libs**: MediaPipe and Three.js are vendored in `public/lib/`. Avoid using external CDNs.

## 🤖 AI & Environment
- **API Proxy**: Frontend must use `POST /api/ask-master`. The server enforces a 100-token limit and 0.7 temperature.
- **Config**: Requires `GEMINI_API_KEY` in `.env`. `GEMINI_MODEL` defaults to `gemini-3.1-flash-lite-preview`.
- **Injection**: `server.js` replaces `</head>` in `index.html` with a config script. Ensure `</head>` exists in `index.html`.

## 📦 Model Management
- Supported formats: `.obj`, `.stl`, `.glb`.
- Assets directory: `public/models/`.
- **Manifest**: `public/models/manifest.json` is auto-generated; do not edit manually.

## 🌐 Deployment
- **Container**: `Dockerfile` and `docker-compose.yml` are configured for Node.js/Express.
- **Auth**: JWT-based authentication is implemented in `src/routes/auth.js`.
