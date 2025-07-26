const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient;

const initializeRedis = async () => {
  try {
    redisClient = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
    });

    redisClient.on('error', (err) => {
      logger.error(`Redis error: ${err}`);
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error(`Redis connection error: ${error.message}`);
    process.exit(1);
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedis first.');
  }
  return redisClient;
};

module.exports = { initializeRedis, getRedisClient };
