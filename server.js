const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const crypto = require('crypto');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const NodeCache = require('node-cache');
require('dotenv').config();

// Create AI response cache (std TTL: 1 hour)
const aiCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Ensure JWT_SECRET is configured
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'huabobo_secret_key_change_in_prod') {
    const newSecret = crypto.randomBytes(32).toString('hex');
    process.env.JWT_SECRET = newSecret;
    const envPath = path.join(__dirname, '.env');
    try {
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf-8');
            if (content.includes('JWT_SECRET=')) {
                content = content.replace(/JWT_SECRET=.*/, `JWT_SECRET=${newSecret}`);
            } else {
                content += `\nJWT_SECRET=${newSecret}`;
            }
            fs.writeFileSync(envPath, content);
            console.log('[SECURITY] Generated and persisted new JWT_SECRET to .env');
        } else {
            fs.writeFileSync(envPath, `JWT_SECRET=${newSecret}\n`);
            console.log('[SECURITY] Created .env and persisted new JWT_SECRET');
        }
    } catch (err) {
        console.warn('[SECURITY] Generated new JWT_SECRET but failed to persist to .env:', err.message);
        console.warn('[SECURITY] JWT_SECRET (save this to your .env):', newSecret);
    }
}

const { syncDatabase, runMigrations } = require('./src/models');
const { router: authRoutes, authMiddleware } = require('./src/routes/auth');
const projectRoutes = require('./src/routes/projects');
const communityRoutes = require('./src/routes/community');
const adminRoutes = require('./src/routes/admin');
const resourceRoutes = require('./src/routes/resources');


const app = express();
const PORT = process.env.PORT || 3179;

// Initialize Database, then start server
runMigrations()
    .then(() => syncDatabase())
    .then(() => startServer())
    .catch(err => {
        console.error("DB Init Error:", err);
        startServer();
    });

// Middleware
app.use(compression());

// Set explicit MIME types for MediaPipe and 3D assets
express.static.mime.define({
    'application/wasm': ['wasm'],
    'application/octet-stream': ['tflite', 'data', 'binarypb', '3mf'],
    'model/gltf-binary': ['glb'],
    'model/gltf+json': ['gltf'],
    'font/ttf': ['ttf']
});

const corsOrigin = process.env.CORS_ORIGIN || '*';
if (corsOrigin === '*' && process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY] CORS is open to all origins. Set CORS_ORIGIN in .env to restrict.');
}
app.use(cors({ origin: corsOrigin }));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "blob:", "'wasm-unsafe-eval'", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "blob:", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'"],
            workerSrc: ["'self'", "blob:"],
            mediaSrc: ["'self'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            objectSrc: ["'none'"],
        },
        useDefaults: false,
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

if (process.env.TRUST_PROXY !== 'false') {
    app.set('trust proxy', 1);
}


// Security: Rate limiting for the AI API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
    standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    message: { error: { message: "Too many requests, please try again later." } }
});

// Auth rate limiting: stricter limits for login/register
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { message: "Too many requests, please try again later." } }
});

// Configure API endpoint limits
app.use('/api/ask-master', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/check-register', authLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/resources', resourceRoutes);

app.get('/api/health', async (req, res) => {
    const { sequelize } = require('./src/db/connection');
    try {
        await sequelize.authenticate();
        res.json({ status: 'ok', db: 'connected' });
    } catch (e) {
        console.error('[Health] DB check failed:', e.message);
        res.status(503).json({ status: 'error', db: 'disconnected', message: 'Database connection failed' });
    }
});

app.get('/api/config', (req, res) => {
    res.json({
        OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o-mini",
        OPENAI_ENABLE_THINKING: process.env.OPENAI_ENABLE_THINKING === 'true'
    });
});

app.post('/api/ask-master', authMiddleware, async (req, res) => {
    try {
        const { model, messages, stream: useStream, enableThinking } = req.body;
        const apiKey = process.env.OPENAI_API_KEY;
        const apiUrl = (process.env.OPENAI_API_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const resolvedModel = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 300;

        if (!apiKey) {
            return res.status(500).json({ error: { message: "OPENAI_API_KEY is not configured" } });
        }

        const requestBody = {
            model: resolvedModel,
            messages,
            max_tokens: maxTokens,
            temperature: 0.7,
            stream: !!useStream
        };

        if (enableThinking || process.env.OPENAI_ENABLE_THINKING === 'true') {
            requestBody.thinking = { type: 'enabled' };
        }

        const reasoningEffort = process.env.OPENAI_REASONING_EFFORT;
        if (reasoningEffort) {
            requestBody.reasoning_effort = reasoningEffort;
        }

        if (!useStream) {
            const cacheKey = crypto.createHash('md5').update(JSON.stringify({ model: resolvedModel, messages })).digest('hex');

            const cachedResponse = aiCache.get(cacheKey);
            if (cachedResponse) {
                console.log('[CACHE] Serving AI response from cache');
                return res.status(200).json(cachedResponse);
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const apiResponse = await fetch(`${apiUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeout);

            const data = await apiResponse.json();

            if (apiResponse.ok && data.choices && data.choices.length > 0) {
                aiCache.set(cacheKey, data);
                return res.json(data);
            }

            console.error('[AskMaster] Upstream API error (non-streaming):', JSON.stringify(data).slice(0, 200));
            return res.status(502).json({ error: { message: "AI 服务暂时不可用，请稍后重试" } });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const streamController = new AbortController();
        const streamTimeout = setTimeout(() => streamController.abort(), 15000);

        const apiResponse = await fetch(`${apiUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: streamController.signal
        });

        clearTimeout(streamTimeout);

        if (!apiResponse.ok) {
            const errorData = await apiResponse.text();
            console.error('[AskMaster] Upstream API error (streaming):', errorData.slice(0, 200));
            res.write(`data: ${JSON.stringify({ error: { message: "AI 服务暂时不可用，请稍后重试" } })}\n\n`);
            res.end();
            return;
        }

        req.socket?.setNoDelay?.(true);
        const reader = apiResponse.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value, { stream: true }));
            if (typeof res.flush === 'function') res.flush();
        }

        res.end();
    } catch (e) {
        console.error('[AskMaster] Stream error:', e);
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: { message: "AI 服务暂时不可用，请稍后重试" } })}\n\n`);
            res.end();
        } else {
            return res.status(500).json({ error: { message: "AI 服务暂时不可用，请稍后重试" } });
        }
    }
});

// Dynamic Injection for index.html (like _middleware.js)
const publicDir = path.join(__dirname, 'public');
const indexPath = path.join(publicDir, 'index.html');

let cachedIndexHtml = null;
try {
    if (fs.existsSync(indexPath)) {
        const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const enableThinking = process.env.OPENAI_ENABLE_THINKING === 'true';
        const injectedScript = `<script>window.ENV_CONFIG = { OPENAI_MODEL: ${JSON.stringify(modelName).replace(/</g, '\\x3c')}, OPENAI_ENABLE_THINKING: ${enableThinking} };</script>`;
        cachedIndexHtml = fs.readFileSync(indexPath, 'utf-8').replace('</head>', `${injectedScript}</head>`);
        console.log('[INIT] index.html cached in memory');
    }
} catch (e) {
    console.error('[INIT] Failed to cache index.html:', e.message);
}

app.get(['/', '/index.html'], (req, res) => {
    if (!cachedIndexHtml) return res.status(404).send('Index.html not found, please ensure build is completed.');
    res.setHeader('Content-Type', 'text/html');
    res.send(cachedIndexHtml);
});

// Serve Static files from public dir
app.use(express.static(publicDir, {
    index: false,
    setHeaders: (res, filePath) => {
        // 核心库和字体设置较长缓存，减少重复下载 (1年)
        if (filePath.match(/\.(js|css|wasm|tflite|data|ttf|woff2|png|jpg|jpeg|svg|binarypb)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=0');
        }
    }
}));

// Serve uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
try {
    const testFile = path.join(uploadDir, '.write-test');
    fs.writeFileSync(testFile, '');
    fs.unlinkSync(testFile);
} catch (err) {
    console.error('[ERROR] Uploads directory is not writable:', uploadDir);
    console.error('[ERROR]', err.message);
    console.error('[ERROR] File uploads will fail. Check directory permissions.');
}
app.use('/uploads', express.static(uploadDir));


// SPA Fallback: Any other path goes to injected index.html
app.get('*', (req, res) => {
    if (!cachedIndexHtml) return res.status(404).send('Index.html not found.');
    res.setHeader('Content-Type', 'text/html');
    res.send(cachedIndexHtml);
});

// Helper to get local IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '0.0.0.0';
}

// Start server
function startServer() {
    const localIP = getLocalIP();

    if (process.env.USE_HTTPS === 'true') {
        try {
            const keyPath = path.join(__dirname, process.env.HTTPS_KEY_PATH || 'key.pem');
            const certPath = path.join(__dirname, process.env.HTTPS_CERT_PATH || 'cert.pem');
            
            if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
                throw new Error(`HTTPS certificates not found at ${keyPath} or ${certPath}. Please run "node scripts/setup-https.js" first.`);
            }

            const options = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath)
            };

            https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
                console.log(`🚀 Secure Server is running on:`);
                console.log(`   - Local:    https://localhost:${PORT}`);
                console.log(`   - Network:  https://${localIP}:${PORT}`);
            });
        } catch (err) {
            console.error("Failed to start HTTPS server:", err.message);
            console.log("Falling back to HTTP...");
            app.listen(PORT, '0.0.0.0', () => {
                console.log(`Server is running on:`);
                console.log(`   - Local:    http://localhost:${PORT}`);
                console.log(`   - Network:  http://${localIP}:${PORT}`);
            });
        }
    } else {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on:`);
            console.log(`   - Local:    http://localhost:${PORT}`);
            console.log(`   - Network:  http://${localIP}:${PORT}`);
        });
    }
}
