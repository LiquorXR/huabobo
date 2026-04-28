const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User } = require('../models');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'huabobo_secret_key_change_in_prod';

const normalizeUsername = (value) => typeof value === 'string' ? value.trim() : '';
const normalizeEmail = (value) => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
};
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const buildUserPayload = (user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
});
const getRegisterAvailability = async (username, email) => {
    const [existingUsername, existingEmail] = await Promise.all([
        username ? User.findOne({ where: { username } }) : null,
        email ? User.findOne({ where: { email } }) : null
    ]);

    return {
        usernameAvailable: !existingUsername,
        emailAvailable: email ? !existingEmail : true
    };
};
const signToken = (user) => jwt.sign(
    { userId: user.id, username: user.username, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
);

router.post('/check-register', async (req, res) => {
    try {
        const username = normalizeUsername(req.body.username);
        const email = normalizeEmail(req.body.email);

        if (!username) return res.status(400).json({ error: '请输入用户名' });
        if (email && !isValidEmail(email)) return res.status(400).json({ error: '邮箱格式不正确' });

        const availability = await getRegisterAvailability(username, email);
        res.json(availability);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/register', async (req, res) => {
    try {
        const username = normalizeUsername(req.body.username);
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;
        if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
        if (email && !isValidEmail(email)) return res.status(400).json({ error: '邮箱格式不正确' });
        
        const availability = await getRegisterAvailability(username, email);
        if (!availability.usernameAvailable) return res.status(400).json({ error: '当前用户名已被注册' });
        if (email && !availability.emailAvailable) return res.status(400).json({ error: '当前邮箱已被注册' });

        const password_hash = await bcrypt.hash(password, 10);
        
        // Admin Bootstrap: If this is the first user, make them an admin
        const userCount = await User.count();
        const role = userCount === 0 ? 'admin' : 'user';
        
        const user = await User.create({ username, email, password_hash, role });
        if (userCount === 0) console.log(`[AUTH] Admin Bootstrap: First user '${username}' created as ADMIN.`);
        
        const token = signToken(user);
        res.json({ token, user: buildUserPayload(user) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const identifier = normalizeUsername(req.body.username || req.body.identifier);
        const normalizedEmail = normalizeEmail(identifier);
        const { password } = req.body;
        if (!identifier || !password) return res.status(400).json({ error: '请输入账号或邮箱和密码' });

        const user = await User.findOne({
            where: normalizedEmail
                ? { [Op.or]: [{ username: identifier }, { email: normalizedEmail }] }
                : { username: identifier }
        });
        if (!user) return res.status(401).json({ error: '账号或密码错误' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: '账号或密码错误' });

        const token = signToken(user);
        res.json({ token, user: buildUserPayload(user) });
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
        const newUsername = normalizeUsername(req.body.newUsername);
        if (!newUsername) return res.status(400).json({ error: "New username required" });
        
        const existing = await User.findOne({ where: { username: newUsername } });
        if (existing) return res.status(400).json({ error: "Username already exists" });
        
        const user = await User.findByPk(req.user.userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        
        user.username = newUsername;
        await user.save();
        
        // Return new token with updated username
        const token = signToken(user);
        res.json({ success: true, token, user: buildUserPayload(user) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/email', authMiddleware, async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (email && !isValidEmail(email)) return res.status(400).json({ error: "Invalid email address" });

        const user = await User.findByPk(req.user.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        if (email) {
            const existing = await User.findOne({ where: { email } });
            if (existing && existing.id !== user.id) {
                return res.status(400).json({ error: "Email already exists" });
            }
        }

        user.email = email;
        await user.save();

        const token = signToken(user);
        res.json({ success: true, token, user: buildUserPayload(user) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/password', authMiddleware, async (req, res) => {
    try {
        const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
        const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: '请输入当前密码和新密码' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: '新密码至少需要 6 位' });
        }

        const user = await User.findByPk(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!valid) {
            return res.status(400).json({ error: '当前密码不正确' });
        }

        const sameAsCurrent = await bcrypt.compare(newPassword, user.password_hash);
        if (sameAsCurrent) {
            return res.status(400).json({ error: '新密码不能与当前密码相同' });
        }

        user.password_hash = await bcrypt.hash(newPassword, 10);
        await user.save();

        const token = signToken(user);
        res.json({ success: true, token, user: buildUserPayload(user) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/account', authMiddleware, async (req, res) => {
    try {
        const requestedUsername = typeof req.body.newUsername === 'string' ? normalizeUsername(req.body.newUsername) : '';
        const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
        const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

        const user = await User.findByPk(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const usernameChanged = !!requestedUsername && requestedUsername !== user.username;
        const wantsPasswordChange = !!currentPassword || !!newPassword;

        if (usernameChanged) {
            const existing = await User.findOne({ where: { username: requestedUsername } });
            if (existing && existing.id !== user.id) {
                return res.status(400).json({ error: '当前用户名已被注册' });
            }
        }

        if (wantsPasswordChange) {
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: '请输入当前密码和新密码' });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ error: '新密码至少需要 6 位' });
            }

            const valid = await bcrypt.compare(currentPassword, user.password_hash);
            if (!valid) {
                return res.status(400).json({ error: '当前密码不正确' });
            }

            const sameAsCurrent = await bcrypt.compare(newPassword, user.password_hash);
            if (sameAsCurrent) {
                return res.status(400).json({ error: '新密码不能与当前密码相同' });
            }
        }

        if (!usernameChanged && !wantsPasswordChange) {
            return res.status(400).json({ error: '未检测到需要保存的更改' });
        }

        if (usernameChanged) {
            user.username = requestedUsername;
        }

        if (wantsPasswordChange) {
            user.password_hash = await bcrypt.hash(newPassword, 10);
        }

        await user.save();

        const token = signToken(user);
        res.json({ success: true, token, user: buildUserPayload(user) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = { router, authMiddleware };
