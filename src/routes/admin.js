const express = require('express');
const { User, Project, Like, sequelize } = require('../models');
const { authMiddleware } = require('./auth');
const router = express.Router();

// Admin middleware
const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Access denied. Admin only." });
    }
    next();
};

router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const userCount = await User.count();
        const projectCount = await Project.count();
        const likeCount = await Like.count();
        const latestProjects = await Project.findAll({
            limit: 10,
            order: [['createdAt', 'DESC']],
            include: [{ model: User, attributes: ['username'] }]
        });

        res.json({
            userCount,
            projectCount,
            likeCount,
            latestProjects
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/project/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await Project.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
