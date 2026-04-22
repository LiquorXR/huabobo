const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'huabobo_secret_key_change_in_prod';

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Username and password required" });
        
        const existing = await User.findOne({ where: { username } });
        if (existing) return res.status(400).json({ error: "Username already exists" });

        const password_hash = await bcrypt.hash(password, 10);
        
        // Admin Bootstrap: If this is the first user, make them an admin
        const userCount = await User.count();
        const role = userCount === 0 ? 'admin' : 'user';
        
        const user = await User.create({ username, password_hash, role });
        if (userCount === 0) console.log(`[AUTH] Admin Bootstrap: First user '${username}' created as ADMIN.`);
        
        const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Username and password required" });

        const user = await User.findOne({ where: { username } });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Middleware to verify JWT token
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Malformed token" });
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Invalid token" });
        req.user = decoded;
        next();
    });
};

router.put('/username', authMiddleware, async (req, res) => {
    try {
        const { newUsername } = req.body;
        if (!newUsername) return res.status(400).json({ error: "New username required" });
        
        const existing = await User.findOne({ where: { username: newUsername } });
        if (existing) return res.status(400).json({ error: "Username already exists" });
        
        const user = await User.findByPk(req.user.userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        
        user.username = newUsername;
        await user.save();
        
        // Return new token with updated username
        const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = { router, authMiddleware };

