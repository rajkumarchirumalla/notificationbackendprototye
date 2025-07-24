const { Sequelize, DataTypes } = require('sequelize');

// Connect using your DB credentials
const sequelize = new Sequelize('fcm_db', 'fcm_user', 'fcm_password', {
  host: 'localhost',
  dialect: 'mysql',
});

// Define Device model
const Device = sequelize.define('Device', {
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: true,
});

module.exports = { sequelize, Device };
