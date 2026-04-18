const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dialect = process.env.DB_DIALECT || 'sqlite'; // Default to sqlite for easy local testing

let sequelize;

if (dialect === 'postgres') {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'huabobo',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || 'postgres_password',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
    }
  );
} else {
  // SQLite fallback
  const dbDir = path.join(__dirname, '../../database');
  if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
  }
  
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(dbDir, 'dev.sqlite'),
    logging: false
  });
}

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log(`Database connection (${dialect}) has been established successfully.`);
    } catch (error) {
        console.error(`Unable to connect to the ${dialect} database:`, error);
    }
};

module.exports = { sequelize, testConnection, dialect };
