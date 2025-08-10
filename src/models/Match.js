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
    defaultValue: '/uploads/default-team-logo.png',
    comment: 'Team A logo URL',
  },
  teamBLogo: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '/uploads/default-team-logo.png',
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
  time_start: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'Match start time (time only)',
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
  // Team Scorers
  teamAScorers: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Team A scorers with details [{ player: "Name", score: "4,8,15" }]',
  },
  teamBScorers: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Team B scorers with details [{ player: "Name", score: "4,8,15" }]',
  },
  // Match statistics
  teamAPossession: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'A Ball possession percentage',
  },
  teamBPossession: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'B Ball possession percentage',
  },
  teamAShots: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'team A shots',
  },
  teamBShots: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'team B shots',
  },
  teamAShotsOnTarget: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'team A Shots on target',
  },
  teamBShotsOnTarget: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'team B Shots on target',
  },
  teamACorners: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'team A Corner kicks',
  },
  teamBCorners: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'team B Corner kicks',
  },
  teamAFouls: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'A Fouls committed',
  },
  teamBFouls: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'B Fouls committed',
  },
  teamAFutsalFoul: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Futsal fouls committed',
  },
  teamBFutsalFoul: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Futsal fouls committed',
  },
  teamAOffsides: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Offside violations',
  },
  teamBOffsides: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Offside violations',
  },
  teamAYellowCards: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Yellow cards',
  },
  teamBYellowCards: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Yellow cards',
  },
  teamARedCards: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Red cards',
  },
  teamBRedCards: {
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

// New methods for scorers
Match.prototype.addScorer = function(team, playerName, minute) {
  const teamField = team === 'A' ? 'teamAScorers' : 'teamBScorers';
  
  if (!this[teamField]) {
    this[teamField] = [];
  }
  
  // Find existing player
  const existingPlayer = this[teamField].find(scorer => scorer.player === playerName);
  
  if (existingPlayer) {
    // Add minute to existing player's score
    const scores = existingPlayer.score ? existingPlayer.score.split(',') : [];
    scores.push(minute.toString());
    existingPlayer.score = scores.join(',');
  } else {
    // Add new player
    this[teamField].push({
      player: playerName,
      score: minute.toString()
    });
  }
  
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
Match.prototype.addScorer = function(team, playerName, minute) {
  const teamField = team === 'A' || team === 'teamA' ? 'teamAScorers' : 'teamBScorers';
  
  // Initialize if null or undefined
  if (!this[teamField]) {
    this[teamField] = [];
  }
  
  // Ensure it's an array (in case it was stored as string)
  if (typeof this[teamField] === 'string') {
    try {
      this[teamField] = JSON.parse(this[teamField]);
    } catch (e) {
      this[teamField] = [];
    }
  }
  
  // Find existing player
  const existingPlayer = this[teamField].find(scorer => scorer.player === playerName);
  
  if (existingPlayer) {
    // Add minute to existing player's score
    const scores = existingPlayer.score ? existingPlayer.score.split(',') : [];
    scores.push(minute.toString());
    existingPlayer.score = scores.join(',');
  } else {
    // Add new player
    this[teamField].push({
      player: playerName,
      score: minute.toString()
    });
  }
  
  // Mark as changed for Sequelize to detect the update
  this.changed(teamField, true);
  
  return this.save();
};

// Thêm method để xóa một bàn thắng
Match.prototype.removeScorer = function(team, playerName, minute) {
  const teamField = team === 'A' || team === 'teamA' ? 'teamAScorers' : 'teamBScorers';
  
  if (!this[teamField] || !Array.isArray(this[teamField])) {
    return this.save();
  }
  
  // Find the player
  const existingPlayer = this[teamField].find(scorer => scorer.player === playerName);
  
  if (existingPlayer) {
    const scores = existingPlayer.score ? existingPlayer.score.split(',') : [];
    const updatedScores = scores.filter(score => score !== minute.toString());
    
    if (updatedScores.length === 0) {
      // Remove player if no more scores
      this[teamField] = this[teamField].filter(scorer => scorer.player !== playerName);
    } else {
      // Update player's scores
      existingPlayer.score = updatedScores.join(',');
    }
    
    // Mark as changed for Sequelize
    this.changed(teamField, true);
  }
  
  return this.save();
};
module.exports = Match;