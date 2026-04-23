const { DataTypes, QueryTypes } = require('sequelize');
const { sequelize, dialect } = require('../db/connection');

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


const dedupeSQLiteUsers = async () => {
    if (dialect !== 'sqlite') return;

    const duplicateGroups = await sequelize.query(
        `SELECT username
         FROM Users
         WHERE username IS NOT NULL
         GROUP BY username
         HAVING COUNT(*) > 1`,
        { type: QueryTypes.SELECT }
    );

    if (duplicateGroups.length === 0) return;

    for (const { username } of duplicateGroups) {
        const users = await sequelize.query(
            `SELECT id
             FROM Users
             WHERE username = :username
             ORDER BY datetime(createdAt) ASC, id ASC`,
            {
                replacements: { username },
                type: QueryTypes.SELECT
            }
        );

        const [keeper, ...duplicates] = users;
        if (!keeper || duplicates.length === 0) continue;

        for (const duplicate of duplicates) {
            await sequelize.query(
                `UPDATE Projects SET userId = :keeperId WHERE userId = :duplicateId`,
                {
                    replacements: { keeperId: keeper.id, duplicateId: duplicate.id },
                    type: QueryTypes.UPDATE
                }
            );

            await sequelize.query(
                `UPDATE Likes SET userId = :keeperId WHERE userId = :duplicateId`,
                {
                    replacements: { keeperId: keeper.id, duplicateId: duplicate.id },
                    type: QueryTypes.UPDATE
                }
            );

            await sequelize.query(
                `DELETE FROM Users WHERE id = :duplicateId`,
                {
                    replacements: { duplicateId: duplicate.id },
                    type: QueryTypes.DELETE
                }
            );
        }

        console.warn(`[DB] Removed ${duplicates.length} duplicate user record(s) for username "${username}" before sync.`);
    }
};

const dropSQLiteBackupTables = async () => {
    if (dialect !== 'sqlite') return;

    const backupTables = await sequelize.query(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table' AND name LIKE '%\\_backup' ESCAPE '\\'`,
        { type: QueryTypes.SELECT }
    );

    for (const { name } of backupTables) {
        await sequelize.query(`DROP TABLE IF EXISTS \`${name}\``);
        console.warn(`[DB] Dropped stale SQLite backup table "${name}" before sync.`);
    }
};

const syncDatabase = async () => {
    await dropSQLiteBackupTables();

    // SQLite + alter rebuilds tables and can fail on historical duplicate usernames.
    await dedupeSQLiteUsers();

    // Note: Use force:false to avoid dropping tables in prod. In a real scenario, use migrations.
    if (dialect === 'sqlite') {
        await sequelize.query('PRAGMA foreign_keys = OFF');
    }

    try {
        await sequelize.sync({ alter: true });
    } finally {
        if (dialect === 'sqlite') {
            await sequelize.query('PRAGMA foreign_keys = ON');
        }
    }

    console.log("Database models synchronized.");
};

module.exports = { User, Project, Like, ModelResource, CarouselImage, syncDatabase, sequelize };
