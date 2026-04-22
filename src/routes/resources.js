const express = require('express');
const router = express.Router();
const { ModelResource, CarouselImage } = require('../models');

// GET /api/resources/models - List all models (metadata only)
router.get('/models', async (req, res) => {
    try {
        const models = await ModelResource.findAll({
            attributes: ['id', 'name', 'file_name', 'mime_type', 'thumbnail', 'metadata', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });

        res.json(models);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/resources/models/:id - Get raw model file
router.get('/models/:id', async (req, res) => {
    try {
        const model = await ModelResource.findByPk(req.params.id);
        if (!model) return res.status(404).json({ error: "Model not found" });

        res.setHeader('Content-Type', model.mime_type || 'application/octet-stream');
        res.send(model.data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/resources/carousel - List all carousel images (metadata only)
router.get('/carousel', async (req, res) => {
    try {
        const images = await CarouselImage.findAll({
            attributes: ['id', 'order', 'file_name', 'mime_type', 'createdAt'],
            order: [['order', 'ASC'], ['createdAt', 'DESC']]
        });
        res.json(images);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/resources/carousel/:id - Get raw image file
router.get('/carousel/:id', async (req, res) => {
    try {
        const image = await CarouselImage.findByPk(req.params.id);
        if (!image) return res.status(404).json({ error: "Image not found" });

        res.setHeader('Content-Type', image.mime_type || 'image/jpeg');
        res.send(image.data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
