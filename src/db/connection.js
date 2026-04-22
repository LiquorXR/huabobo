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

const testConnection = async (retries = 5) => {
    while (retries > 0) {
        try {
            await sequelize.authenticate();
            console.log(`[DB] Connection (${dialect}) has been established successfully.`);
            return;
        } catch (error) {
            retries--;
            console.error(`[DB] Connection failed. Retries left: ${retries}. Error:`, error.message);
            if (retries === 0) {
                console.error("[DB] Max retries reached. Exiting.");
                process.exit(1);
            }
            // Wait 5 seconds before retrying
            await new Promise(res => setTimeout(res, 5000));
        }
    }
};

module.exports = { sequelize, testConnection, dialect };
