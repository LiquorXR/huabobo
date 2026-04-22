const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connection');

const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: 'user' }
});

const Project = sequelize.define('Project', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    thumbnail: { type: DataTypes.TEXT }, // Base64 or URL
    scene_data: { type: DataTypes.TEXT }, // JSON stringified data
    is_public: { type: DataTypes.BOOLEAN, defaultValue: false },
    views: { type: DataTypes.INTEGER, defaultValue: 0 },
    userId: { type: DataTypes.UUID, allowNull: true } // Explicitly defined foreign key
});


const Like = sequelize.define('Like', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true }
});

const ModelResource = sequelize.define('ModelResource', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    file_name: { type: DataTypes.STRING },
    mime_type: { type: DataTypes.STRING },
    data: { type: DataTypes.BLOB('long'), allowNull: false },
    thumbnail: { type: DataTypes.TEXT }, // Base64 preview
    metadata: { type: DataTypes.TEXT } // JSON string
});


const CarouselImage = sequelize.define('CarouselImage', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    order: { type: DataTypes.INTEGER, defaultValue: 0 },
    file_name: { type: DataTypes.STRING },
    mime_type: { type: DataTypes.STRING },
    data: { type: DataTypes.BLOB('long'), allowNull: false }
});


// Relationships
User.hasMany(Project, { foreignKey: 'userId' });
Project.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Like, { foreignKey: 'userId' });
Like.belongsTo(User, { foreignKey: 'userId' });

Project.hasMany(Like, { foreignKey: 'projectId', onDelete: 'CASCADE' });
Like.belongsTo(Project, { foreignKey: 'projectId' });


const syncDatabase = async () => {
    // Note: Use force:false to avoid dropping tables in prod. In a real scenario, use migrations.
    await sequelize.sync({ alter: true });
    console.log("Database models synchronized.");
};

module.exports = { User, Project, Like, ModelResource, CarouselImage, syncDatabase, sequelize };
