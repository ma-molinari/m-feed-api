import logger from "@libs/logger";
import {
  RedisAddList,
  RedisClearKey,
  RedisGetJson,
  RedisGetList,
  RedisRemoveFromList,
  RedisSetTTL,
} from "@libs/redis";
import {
  keyUserFollowers,
  keyUserFollowing,
  keyUserPosts,
  keyUserProfile,
} from "./keys";
import { User } from "@prisma/client";

/**
 * User Detail
 */
export async function setUserCache(
  userId: number | string,
  user: Partial<User>,
) {
  try {
    await RedisSetTTL(keyUserProfile(userId), user, 86400); // 1 day in seconds.
  } catch (error) {
    logger.error("An error occurred while setting the user cache.");
  }
}

export async function getUserCache(userId: number | string): Promise<User> {
  try {
    return await RedisGetJson(keyUserProfile(userId));
  } catch (error) {
    logger.error("An error occurred while getting the user cache.");
  }
}

export async function invalidateUserCache(userId: number | string) {
  try {
    await RedisClearKey(keyUserProfile(userId));
    await RedisClearKey(keyUserPosts(userId));
  } catch (error) {
    logger.error("An error occurred while clearing the user's cache.");
  }
}

/**
 * Follower
 */
export async function setUserFollowerCache(
  meId: number | string,
  userId: number | string,
) {
  try {
    await RedisAddList(keyUserFollowing(meId), [Date.now(), userId]);
    await RedisAddList(keyUserFollowers(userId), [Date.now(), meId]);
  } catch (error) {
    logger.error("An error occurred while setting the user's followers cache.");
  }
}

export async function getFollowersCache(userId: number | string) {
  try {
    const followerIds = await RedisGetList(keyUserFollowers(userId));
    return followerIds.map(Number);
  } catch (error) {
    logger.error("An error occurred while getting the cached followers.");
  }
}

export async function getFollowingCache(userId: number | string) {
  try {
    const followingIds = await RedisGetList(keyUserFollowing(userId));
    return followingIds.map(Number);
  } catch (error) {
    logger.error("An error occurred while getting followed users.");
  }
}

export async function invalidateUserFollowerCache(
  meId: number | string,
  userId: number | string,
) {
  try {
    await RedisRemoveFromList(keyUserFollowing(meId), userId);
    await RedisRemoveFromList(keyUserFollowers(userId), meId);
  } catch (error) {
    logger.error(
      "An error occurred while clearing the user's followers cache.",
    );
  }
}
