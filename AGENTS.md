# Agent Guide: Hua Bobo DIY System

## 🛠 Critical Commands
- `npm run dev`: Starts the development server using nodemon (`nodemon server.js`). This is the primary command for local development.
- `node scripts/setup-https.js`: Required to generate local certificates if `USE_HTTPS=true` is set in the `.env` file. Do this before attempting to start the server in HTTPS mode.
- `npm run build`: Scans the `public/models/` folder and generates `manifest.json`. This is required to automatically register new 3D models added to the system.

## 🏗 Architecture Context
- **Config Injection**: `server.js` dynamically injects `window.ENV_CONFIG` into `public/index.html` on every request by replacing the `</head>` tag. **Never** remove the `</head>` tag from `index.html`.
- **API Proxy**: All Gemini API calls from the frontend must go through the proxy at `POST /api/ask-master`. The client never calls Gemini directly.
- **Database**: The system uses Sequelize with `{ alter: true }` which automatically synchronizes the database schema on server startup. The default database is `database/dev.sqlite`.
- **Local Libs**: Core libraries like Three.js and MediaPipe are vendored locally in `public/lib/`. Avoid adding external CDN links to ensure the app works in offline/weak-network exhibition environments.
- **3D & Gesture Logic**:
  - `public/js/core/app.js`: Handles 3D scene initialization and state management.
  - `public/js/modules/hand-tracker.js`: Maps MediaPipe gestures to 3D controls, utilizing Exponential Moving Average (EMA) for smoothing.

## 🤖 Operation & Constraints
- **Resource Management**: 3D models and carousel images are managed via the Admin UI and their metadata is stored in the database.
- **AI Constraints**: The server rate-limits the Gemini API proxy to 100 requests per 15 minutes per IP. The proxy also enforces a `maxOutputTokens` limit of 100.
- **Environment Requirements**: Ensure `.env` is configured. `GEMINI_API_KEY` is required. If `JWT_SECRET` is missing or default, `server.js` will automatically generate and inject a new one on startup.
