const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, Project, Like, ModelResource, CarouselImage, sequelize } = require('../models');
const { authMiddleware } = require('./auth');
const multer = require('multer');
const router = express.Router();

// Multer setup for disk storage
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
});

const allowedExtensions = ['.glb', '.gltf', '.obj', '.stl', '.3mf', '.ply', '.fbx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${ext} is not allowed. Accepted: ${allowedExtensions.join(', ')}`));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter
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
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const [userTrend, projectTrend] = await Promise.all([
            User.findAll({
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where: { createdAt: { [Op.gte]: sevenDaysAgo } },
                group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
                order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
            }),
            Project.findAll({
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where: { createdAt: { [Op.gte]: sevenDaysAgo } },
                group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
                order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
            })
        ]);

        const userMap = {};
        userTrend.forEach(r => { userMap[r.get('date')] = parseInt(r.get('count'), 10); });
        const projectMap = {};
        projectTrend.forEach(r => { projectMap[r.get('date')] = parseInt(r.get('count'), 10); });

        const trendData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            trendData.push({
                date: date.toLocaleDateString(),
                users: userMap[dateStr] || 0,
                projects: projectMap[dateStr] || 0
            });
        }

        res.json({
            userCount,
            projectCount,
            likeCount,
            trendData
        });
    } catch (e) {
        console.error('[Admin]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
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
        console.error('[Admin]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
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
        console.error('[Admin]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
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
        console.error('[Admin]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});

router.delete('/user/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const userId = req.params.id;
        if (userId === req.user.userId) {
            return res.status(400).json({ error: "Cannot delete your own admin account." });
        }

        await sequelize.transaction(async (t) => {
            const projects = await Project.findAll({ where: { userId }, transaction: t });
            const projectIds = projects.map(p => p.id);
            
            if (projectIds.length > 0) {
                await Like.destroy({ where: { projectId: { [Op.in]: projectIds } }, transaction: t });
            }
            
            await Like.destroy({ where: { userId }, transaction: t });
            await Project.destroy({ where: { userId }, transaction: t });
            await User.destroy({ where: { id: userId }, transaction: t });
        });
        
        res.json({ success: true });
    } catch (e) {
        console.error('[Admin]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
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
        console.error('[Admin]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});

router.post('/resources/models', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { name, metadata, thumbnail } = req.body;
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Fix encoding for filenames (Multer defaults to latin1)
        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        
        // Relative path for database
        const filePath = `/uploads/${req.file.filename}`;

        const model = await ModelResource.create({
            name: name || originalName,
            file_name: originalName,
            mime_type: req.file.mimetype,
            file_path: filePath,
            thumbnail: thumbnail || null,
            metadata: metadata || '{}'
        });

        res.json({ success: true, id: model.id });
    } catch (e) {
        if (req.file) fs.unlinkSync(req.file.path);
        console.error('[Admin]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});

router.delete('/resources/models/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const model = await ModelResource.findByPk(req.params.id);
        if (model) {
            if (model.file_path) {
                const absolutePath = path.join(process.cwd(), model.file_path);
                try {
                    if (fs.existsSync(absolutePath)) {
                        fs.unlinkSync(absolutePath);
                    }
                } catch (_) { /* file already gone */ }
            }
            await model.destroy();
        }
        res.json({ success: true });
    } catch (e) {
        console.error('[Admin]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
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
        console.error('[Admin]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});

router.post('/resources/carousel', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { order } = req.body;
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Fix encoding for filenames (Multer defaults to latin1)
        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

        // Relative path for database
        const filePath = `/uploads/${req.file.filename}`;

        const image = await CarouselImage.create({
            order: parseInt(order) || 0,
            file_name: originalName,
            mime_type: req.file.mimetype,
            file_path: filePath
        });

        res.json({ success: true, id: image.id });
    } catch (e) {
        if (req.file) fs.unlinkSync(req.file.path);
        console.error('[Admin]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});

router.delete('/resources/carousel/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const image = await CarouselImage.findByPk(req.params.id);
        if (image) {
            if (image.file_path) {
                const absolutePath = path.join(process.cwd(), image.file_path);
                try {
                    if (fs.existsSync(absolutePath)) {
                        fs.unlinkSync(absolutePath);
                    }
                } catch (_) { /* file already gone */ }
            }
            await image.destroy();
        }
        res.json({ success: true });
    } catch (e) {
        console.error('[Admin]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});


module.exports = router;
