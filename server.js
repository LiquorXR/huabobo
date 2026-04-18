const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const { syncDatabase } = require('./src/models');
const authRoutes = require('./src/routes/auth').router;
const projectRoutes = require('./src/routes/projects');
const communityRoutes = require('./src/routes/community');
const adminRoutes = require('./src/routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
syncDatabase().catch(err => console.error("DB Sync Error:", err));

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());

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

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
