const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlayerList = sequelize.define('PlayerList', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  accessCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Mã truy cập để xác định phòng',
    index: true
  },
  teamType: {
    type: DataTypes.ENUM('teamA', 'teamB'),
    allowNull: false,
    comment: 'Xác định đội A hay đội B',
  },
  players: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: 'Danh sách cầu thủ dạng JSON',
    validate: {
      isValidPlayers(value) {
        if (!Array.isArray(value)) {
          throw new Error('Players must be an array');
        }
        
        const validPlayerCounts = [2, 4, 5, 6, 7, 8, 9, 10, 11];
        if (!validPlayerCounts.includes(value.length)) {
          throw new Error('Số lượng cầu thủ phải là 2, 4, 5, 6, 7, 8, 9, 10, 11');
        }

        for (const player of value) {
          if (!player.name || typeof player.name !== 'string' || player.name.trim() === '') {
            throw new Error('Mỗi cầu thủ phải có tên');
          }
          if (player.number && typeof player.number !== 'number' && typeof player.number !== 'string') {
            throw new Error('Số áo phải là số hoặc chuỗi (ví dụ: GK)');
          }
        }
      }
    }
  }
}, {
  timestamps: true,
  tableName: 'PlayerLists',
  indexes: [
    {
      fields: ['accessCode'],
      name: 'idx_playerlist_accesscode'
    }
  ]
});

PlayerList.prototype.addPlayer = function(player) {
  const players = [...this.players];
  players.push(player);
  this.players = players;
  return this.save();
};

PlayerList.prototype.removePlayer = function(playerName) {
  const players = this.players.filter(p => p.name !== playerName);
  this.players = players;
  return this.save();
};

PlayerList.prototype.updatePlayer = function(playerName, updates) {
  const players = this.players.map(player => {
    if (player.name === playerName) {
      return { ...player, ...updates };
    }
    return player;
  });
  this.players = players;
  return this.save();
};

PlayerList.findByAccessCode = function(accessCode, teamType) {
  return this.findOne({
    where: { 
      accessCode,
      ...(teamType && { teamType })
    }
  });
};

module.exports = PlayerList;
