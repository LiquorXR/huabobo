const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { ModelResource, CarouselImage } = require('../models');

// GET /api/resources/models - List all models (metadata only)
router.get('/models', async (req, res) => {
    try {
        const models = await ModelResource.findAll({
            attributes: ['id', 'name', 'file_name', 'mime_type', 'file_path', 'thumbnail', 'metadata', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });

        res.json(models);
    } catch (e) {
        console.error('[Resources]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});

// GET /api/resources/models/:id - Get raw model file
router.get('/models/:id', async (req, res) => {
    try {
        const model = await ModelResource.findByPk(req.params.id);
        if (!model) return res.status(404).json({ error: "Model not found" });

        const absolutePath = path.join(process.cwd(), model.file_path);

        res.setHeader('Content-Type', model.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(model.file_name)}"`);
        const readStream = fs.createReadStream(absolutePath);
        readStream.on('error', () => {
            if (!res.headersSent) {
                res.status(404).json({ error: "Model file not found on server" });
            }
        });
        readStream.pipe(res);
    } catch (e) {
        console.error('[Resources]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});

// GET /api/resources/carousel - List all carousel images (metadata only)
router.get('/carousel', async (req, res) => {
    try {
        const images = await CarouselImage.findAll({
            attributes: ['id', 'order', 'file_name', 'mime_type', 'file_path', 'createdAt'],
            order: [['order', 'ASC'], ['createdAt', 'DESC']]
        });
        res.json(images);
    } catch (e) {
        console.error('[Resources]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});

// GET /api/resources/carousel/:id - Get raw image file
router.get('/carousel/:id', async (req, res) => {
    try {
        const image = await CarouselImage.findByPk(req.params.id);
        if (!image) return res.status(404).json({ error: "Image not found" });

        const absolutePath = path.join(process.cwd(), image.file_path);

        res.setHeader('Content-Type', image.mime_type || 'image/jpeg');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(image.file_name)}"`);
        const readStream = fs.createReadStream(absolutePath);
        readStream.on('error', () => {
            if (!res.headersSent) {
                res.status(404).json({ error: "Image file not found on server" });
            }
        });
        readStream.pipe(res);
    } catch (e) {
        console.error('[Resources]', e); res.status(500).json({ error: "服务器内部错误，请稍后重试" });
    }
});

module.exports = router;
