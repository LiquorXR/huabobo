const express = require('express');
const { Project } = require('../models');
const { authMiddleware } = require('./auth');
const router = express.Router();

// Get current user's projects
router.get('/', authMiddleware, async (req, res) => {
    try {
        const projects = await Project.findAll({
            where: { userId: req.user.userId },
            order: [['updatedAt', 'DESC']]
        });
        res.json(projects);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Save or create a project
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { id, name, thumbnail, scene_data, is_public } = req.body;
        
        if (id) {
            // Update existing
            const project = await Project.findOne({ where: { id, userId: req.user.userId } });
            if (!project) return res.status(404).json({ error: "Project not found or unauthorized" });
            
            project.name = name || project.name;
            if (thumbnail) project.thumbnail = thumbnail;
            if (scene_data) project.scene_data = scene_data;
            if (is_public !== undefined) project.is_public = is_public;
            await project.save();
            return res.json(project);
        } else {
            // Create new
            const project = await Project.create({
                userId: req.user.userId,
                name: name || '未命名作品',
                thumbnail,
                scene_data,
                is_public: is_public || false
            });
            return res.json(project);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const result = await Project.destroy({ where: { id: req.params.id, userId: req.user.userId } });
        if (result === 0) return res.status(404).json({ error: "Project not found or unauthorized" });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
