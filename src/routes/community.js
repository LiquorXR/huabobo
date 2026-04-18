const express = require('express');
const { Project, User, Like, sequelize } = require('../models');
const { authMiddleware } = require('./auth');
const router = express.Router();

// Get public community posts (with like counts and author info)
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const projects = await Project.findAll({
            where: { is_public: true },
            include: [{
                model: User,
                attributes: ['id', 'username']
            }],
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM "Likes" AS "like"
                            WHERE
                                "like"."projectId" = "Project"."id"
                        )`),
                        'likeCount'
                    ]
                ]
            },
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });
        
        // Also check if current user liked if token provided
        let userLikes = [];
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            if (token) {
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'huabobo_secret_key_change_in_prod';
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    const likes = await Like.findAll({ where: { userId: decoded.userId } });
                    userLikes = likes.map(l => l.projectId);
                } catch(e) {} // ignore invalid token here
            }
        }

        // Format response
        const results = projects.map(p => {
            const plain = p.get({ plain: true });
            return {
                id: plain.id,
                name: plain.name,
                thumbnail: plain.thumbnail,
                author: plain.User ? plain.User.username : 'Unknown',
                likeCount: parseInt(plain.likeCount, 10) || 0,
                hasLiked: userLikes.includes(plain.id)
            };
        });

        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Like/Unlike a post
router.post('/:id/like', authMiddleware, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.userId;

        const project = await Project.findOne({ where: { id: projectId, is_public: true } });
        if (!project) return res.status(404).json({ error: "Project not found" });

        const existingLike = await Like.findOne({ where: { userId, projectId } });
        if (existingLike) {
            await existingLike.destroy(); // Unlike
            res.json({ liked: false });
        } else {
            await Like.create({ userId, projectId }); // Like
            res.json({ liked: true });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
