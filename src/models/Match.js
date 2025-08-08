const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  teamAName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Team A',
    comment: 'Team A name',
  },  
  teamBName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Team B',
    comment: 'Team B name',
  },
  teamALogo: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '/images/default-team-logo.png',
    comment: 'Team A logo URL',
  },
  teamBLogo: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '/images/default-team-logo.png',
    comment: 'Team B logo URL',
  },
  tournamentName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Tournament name',
  },
  tournamentLogo: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Tournament logo URL',
  },
  matchDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Match start time',
  },
  typeMatch: {
    type: DataTypes.ENUM('soccer', 'pickleball', 'other', 'futsal'),
    defaultValue: 'soccer',
    allowNull: false,
    comment: 'Match type',
    field: 'type_match'
  },
  status: {
    type: DataTypes.ENUM('upcoming', 'live', 'halftime', 'finished', 'postponed', 'cancelled'),
    defaultValue: 'upcoming',
    allowNull: false,
  },
  // Score
  homeScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  awayScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  teamAScoreSet: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of sets won by Team A',
  },
  teamBScoreSet: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of sets won by Team B',
  },
  // Match statistics
  possession: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Ball possession percentage',
  },
  shots: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Total shots',
  },
  shotsOnTarget: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Shots on target',
  },
  corners: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Corner kicks',
  },
  fouls: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Fouls committed',
  },
  offsides: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Offside violations',
  },
  yellowCards: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Yellow cards',
  },
  redCards: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Red cards',
  },
  // Match details
  venue: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Match venue',
  },
  referee: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Main referee name',
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Địa điểm tổ chức trận đấu',
  },
  match_title: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Tên giải/trận đấu',
  },
  teamAkitcolor: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Màu áo đội A',
  },
  teamBkitcolor: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Màu áo đội B',
  },
  teamA2kitcolor: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Màu quần đội A',
  },
  teamB2kitcolor: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Màu quần đội B',
  },
  live_unit: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Đơn vị live',
  },
  attendance: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of attendees',
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional information in JSON format',
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
}, {
  timestamps: true,
  tableName: 'Matches',
  indexes: [
    {
      fields: ['matchDate'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['createdBy'],
    },
    {
      fields: ['teamAName', 'teamBName', 'matchDate'],
    },
  ],
  getterMethods: {
    matchName() {
      return `${this.teamAName} - ${this.teamBName}`;
    }
  },
  setterMethods: {
    matchName(value) {
      throw new Error('Do not set matchName directly');
    }
  }
});

// Instance methods
Match.prototype.updateScore = function(homeScore, awayScore) {
  this.homeScore = homeScore;
  this.awayScore = awayScore;
  return this.save();
};

Match.prototype.updateStatus = function(status) {
  this.status = status;
  return this.save();
};

Match.prototype.updatePossession = function(home, away) {
  if (!this.possession) {
    this.possession = { home: 50, away: 50 }; // Default 50-50
  }
  
  if (home !== undefined) this.possession.home = home;
  if (away !== undefined) this.possession.away = away;
  
  // Ensure total is 100%
  const total = this.possession.home + this.possession.away;
  if (total > 0) {
    this.possession.home = Math.round((this.possession.home / total) * 100);
    this.possession.away = 100 - this.possession.home;
  }
  
  return this.save();
};

Match.prototype.updateShots = function(home, away) {
  if (!this.shots) this.shots = { home: 0, away: 0 };
  if (home !== undefined) this.shots.home = home;
  if (away !== undefined) this.shots.away = away;
  return this.save();
};

Match.prototype.updateShotsOnTarget = function(home, away) {
  if (!this.shotsOnTarget) this.shotsOnTarget = { home: 0, away: 0 };
  if (home !== undefined) this.shotsOnTarget.home = home;
  if (away !== undefined) this.shotsOnTarget.away = away;
  return this.save();
};

Match.getLiveMatches = function() {
  return this.findAll({
    where: {
      status: 'live',
    },
    order: [['matchDate', 'ASC']],
  });
};

Match.getUpcomingMatches = function(limit = 10) {
  return this.findAll({
    where: {
      status: 'upcoming',
      matchDate: {
        [Op.gte]: new Date(),
      },
    },
    order: [['matchDate', 'ASC']],
    limit,
  });
};

module.exports = Match;