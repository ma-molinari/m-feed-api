
import Redis from "ioredis";

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
export const RedisSetZADD = async (key: string, payload: (string | number | Buffer)[]) => {
	const result = await redis.zadd(key, ...payload);
	return result === 1;
};

export const RedisGetZADD = async (key: string) => {
	try {
		const result = await redis.hgetall(key);
		return result;
	} catch (error) {
		return null;
	}
};