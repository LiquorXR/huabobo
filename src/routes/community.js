const express = require('express');
const { Project, User, Like, sequelize } = require('../models');
const { Op } = require('sequelize');
const { authMiddleware, softAuthMiddleware } = require('./auth');
const router = express.Router();

router.get('/', softAuthMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const projects = await Project.findAll({
            where: { is_public: true },
            include: [
                { model: User, attributes: ['id', 'username'] }
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        const projectIds = projects.map(p => p.id);

        const [likesCounts, userLikes] = await Promise.all([
            projectIds.length > 0
                ? Like.findAll({
                    attributes: ['projectId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                    where: { projectId: { [Op.in]: projectIds } },
                    group: ['projectId']
                })
                : [],
            (async () => {
                if (!req.user || projectIds.length === 0) return [];
                const likes = await Like.findAll({
                    where: { userId: req.user.userId, projectId: { [Op.in]: projectIds } }
                });
                return likes.map(l => l.projectId);
            })()
        ]);

        const likeCountMap = {};
        likesCounts.forEach(r => {
            likeCountMap[r.projectId] = parseInt(r.get('count'), 10);
        });

        const results = projects.map(p => ({
            id: p.id,
            name: p.name,
            thumbnail: p.thumbnail,
            author: p.User ? p.User.username : 'Unknown',
            createdAt: p.createdAt,
            likeCount: likeCountMap[p.id] || 0,
            hasLiked: userLikes.includes(p.id)
        }));

        res.json(results);
    } catch (e) {
        console.error('[Community]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});

router.post('/:id/like', authMiddleware, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.userId;

        const project = await Project.findOne({ where: { id: projectId, is_public: true } });
        if (!project) return res.status(404).json({ error: "Project not found" });

        const existingLike = await Like.findOne({ where: { userId, projectId } });
        if (existingLike) {
            await existingLike.destroy();
            res.json({ liked: false });
        } else {
            await Like.create({ userId, projectId });
            res.json({ liked: true });
        }
    } catch (e) {
        if (e.name === 'SequelizeUniqueConstraintError') {
            return res.json({ liked: true });
        }
        console.error('[Community]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});

module.exports = router;
