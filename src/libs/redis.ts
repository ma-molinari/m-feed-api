import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis({
  port: parseInt(process.env.REDIS_PORT),
  host: process.env.REDIS_HOST,
  username: undefined,
  password: undefined,
});

/**
 * clear actions
 */
export const RedisClearAll = async () => {
  await redis.flushdb();
};

export const RedisClearKey = async (key: string) => {
  await redis.del(key);
};

export function RedisClearKeyByPattern(key) {
  const stream = redis.scanStream({
    match: key,
    count: 100,
  });

  stream.on("data", async (resultKeys) => {
    if (resultKeys.length) {
      await redis.unlink(resultKeys);
    }
  });
}

/**
 * Strings
 */
export const RedisSetStr = async (key: string, payload: string) => {
  const result = await redis.set(key, payload);
  return result === "OK";
};

export const RedisGetStr = async (key: string) => {
  try {
    const result = await redis.get(key);
    return result;
  } catch (error) {
    return null;
  }
};

export const RedisGetJson = async <T>(key: string) => {
  try {
    const result = await redis.get(key);
    return JSON.parse(result) as T;
  } catch (error) {
    return null;
  }
};

/**
 * Objects
 */
export const RedisSet = async (key: string, payload: object) => {
  const result = await redis.hmset(key, payload);
  return result === "OK";
};

export const RedisGet = async (key: string) => {
  try {
    const result = await redis.hgetall(key);
    return result;
  } catch (error) {
    return null;
  }
};

/**
 * Sorted List
 */
export const RedisAddList = async (
  key: string,
  payload: (string | number | Buffer)[],
) => {
  const result = await redis.zadd(key, ...payload);
  return result === 1;
};

export const RedisGetList = async (key: string) => {
  try {
    const result = await redis.zrange(key, 0, -1);
    return result;
  } catch (error) {
    return null;
  }
};

export const RedisRemoveFromList = async (
  key: string,
  payload: string | number,
) => {
  try {
    const result = await redis.zrem(key, payload);
    return result === 1;
  } catch (error) {
    return null;
  }
};

/**
 * Set TTL
 */
export const RedisSetTTL = async (
  key: string,
  payload: object | string,
  seconds = 300,
) => {
  const json = JSON.stringify(payload);
  const result = await redis.setex(key, seconds, json);
  return result === "OK";
};
