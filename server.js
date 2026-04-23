const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const crypto = require('crypto');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Ensure JWT_SECRET is configured
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'huabobo_secret_key_change_in_prod') {
    const newSecret = crypto.randomBytes(32).toString('hex');
    process.env.JWT_SECRET = newSecret;
    if (process.env.NODE_ENV !== 'production') {
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
        }
    } else {
        console.warn('[SECURITY] JWT_SECRET missing in production; generated an in-memory fallback for this process only.');
    }
}

const { syncDatabase } = require('./src/models');
const authRoutes = require('./src/routes/auth').router;
const projectRoutes = require('./src/routes/projects');
const communityRoutes = require('./src/routes/community');
const adminRoutes = require('./src/routes/admin');
const resourceRoutes = require('./src/routes/resources');


const app = express();
const PORT = process.env.PORT || 3179;

// Initialize Database
syncDatabase().catch(err => console.error("DB Sync Error:", err));

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Security: Rate limiting for the Gemini API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
    standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    message: { error: { message: "Too many requests, please try again later." } }
});

// Configure API endpoint limits
app.use('/api/ask-master', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/resources', resourceRoutes);


app.get('/api/config', (req, res) => {
    res.json({
        GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview"
    });
});

app.post('/api/ask-master', async (req, res) => {
    try {
        const { model, contents, systemInstruction } = req.body;
        const key = process.env.GEMINI_API_KEY;

        if (!key) {
            return res.status(500).json({ error: { message: "GEMINI_API_KEY is not configured" } });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

        const apiResponse = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents,
                systemInstruction,
                generationConfig: {
                    maxOutputTokens: 100,
                    temperature: 0.7
                }
            })
        });

        const data = await apiResponse.json();
        return res.status(apiResponse.status).json(data);
    } catch (e) {
        return res.status(500).json({ error: { message: e.message } });
    }
});

// Dynamic Injection for index.html (like _middleware.js)
const publicDir = path.join(__dirname, 'public');

app.get(['/', '/index.html'], (req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
        return res.status(404).send('Index.html not found, please ensure build is completed.');
    }

    try {
        let html = fs.readFileSync(indexPath, 'utf-8');
        const modelName = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
        const injectedScript = `<script>window.ENV_CONFIG = { GEMINI_MODEL: "${modelName}" };</script>`;
        
        // Inject script right before </head>
        html = html.replace('</head>', `${injectedScript}</head>`);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (e) {
        console.error('Error processing index.html:', e);
        res.status(500).send('Internal Server Error');
    }
});

// Serve Static files from public dir
app.use(express.static(publicDir, {
    index: false // disable default index finding since we handle it manually above
}));


// SPA Fallback: Any other path goes to injected index.html
app.get('*', (req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
        return res.status(404).send('Index.html not found.');
    }
    
    try {
        let html = fs.readFileSync(indexPath, 'utf-8');
        const modelName = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
        const injectedScript = `<script>window.ENV_CONFIG = { GEMINI_MODEL: "${modelName}" };</script>`;
        html = html.replace('</head>', `${injectedScript}</head>`);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (e) {
        res.sendFile(indexPath);
    }
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
