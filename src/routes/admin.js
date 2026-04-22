const express = require('express');
const { Op } = require('sequelize');
const { User, Project, Like, ModelResource, CarouselImage, sequelize } = require('../models');
const { authMiddleware } = require('./auth');
const multer = require('multer');
const router = express.Router();

// Multer setup for memory storage (for DB BLOB)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});


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
        
        // Fetch last 7 days trend
        const trendData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const start = new Date(date.setHours(0, 0, 0, 0));
            const end = new Date(date.setHours(23, 59, 59, 999));
            
            const users = await User.count({
                where: {
                    createdAt: { [Op.between]: [start, end] }
                }
            });
            const projects = await Project.count({
                where: {
                    createdAt: { [Op.between]: [start, end] }
                }
            });
            
            trendData.push({
                date: start.toLocaleDateString(),
                users,
                projects
            });
        }

        res.json({
            userCount,
            projectCount,
            likeCount,
            trendData
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/projects', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const projects = await Project.findAll({
            order: [['createdAt', 'DESC']],
            include: [{ model: User, attributes: ['username'] }]
        });
        res.json(projects);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/project/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const projectId = req.params.id;
        // Manual cleanup of likes
        await Like.destroy({ where: { projectId } });
        // Delete project
        await Project.destroy({ where: { id: projectId } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// User Management APIs
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'role', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/user/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const userId = req.params.id;
        // Don't allow admin to delete themselves
        if (userId === req.user.userId) {
            return res.status(400).json({ error: "Cannot delete your own admin account." });
        }

        // Deep cleanup:
        // 1. Find all projects of this user
        const projects = await Project.findAll({ where: { userId } });
        const projectIds = projects.map(p => p.id);
        
        // 2. Delete all likes for these projects
        if (projectIds.length > 0) {
            await Like.destroy({ where: { projectId: { [Op.in]: projectIds } } });
        }
        
        // 3. Delete all likes GIVEN by this user
        await Like.destroy({ where: { userId } });
        
        // 4. Delete user's projects
        await Project.destroy({ where: { userId } });

        // 5. Finally delete the user
        await User.destroy({ where: { id: userId } });
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// Resource Management APIs - Models
router.get('/resources/models', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const models = await ModelResource.findAll({
            attributes: ['id', 'name', 'file_name', 'mime_type', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json(models);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/resources/models', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { name, metadata, thumbnail } = req.body;
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Fix encoding for filenames (Multer defaults to latin1)
        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

        const model = await ModelResource.create({
            name: name || originalName,
            file_name: originalName,
            mime_type: req.file.mimetype,
            data: req.file.buffer,
            thumbnail: thumbnail || null,
            metadata: metadata || '{}'
        });



        res.json({ success: true, id: model.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/resources/models/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await ModelResource.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Resource Management APIs - Carousel
router.get('/resources/carousel', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const images = await CarouselImage.findAll({
            attributes: ['id', 'order', 'file_name', 'mime_type', 'createdAt'],
            order: [['order', 'ASC']]
        });
        res.json(images);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/resources/carousel', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { order } = req.body;
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Fix encoding for filenames (Multer defaults to latin1)
        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

        const image = await CarouselImage.create({
            order: parseInt(order) || 0,
            file_name: originalName,
            mime_type: req.file.mimetype,
            data: req.file.buffer
        });


        res.json({ success: true, id: image.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/resources/carousel/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await CarouselImage.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


module.exports = router;
