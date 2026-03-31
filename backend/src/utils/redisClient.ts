import Redis from 'ioredis';

// Redis client for caching and job queues
export const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

// Dedicated Redis connection for BullMQ (requires maxRetriesPerRequest: null)
export const bullmqConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Handle connection events
redisClient.on('connect', () => {
  console.log('📦 Redis connected');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redisClient.on('close', () => {
  console.log('📦 Redis connection closed');
});

// Cache helper functions
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

export const cacheSet = async (key: string, value: any, ttlSeconds?: number): Promise<boolean> => {
  try {
    const stringValue = JSON.stringify(value);
    if (ttlSeconds) {
      await redisClient.setex(key, ttlSeconds, stringValue);
    } else {
      await redisClient.set(key, stringValue);
    }
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
};

export const cacheDelete = async (key: string): Promise<boolean> => {
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
};

export const cacheDeletePattern = async (pattern: string): Promise<number> => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    return keys.length;
  } catch (error) {
    console.error('Cache delete pattern error:', error);
    return 0;
  }
};

export default redisClient;