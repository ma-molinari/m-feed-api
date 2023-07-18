import logger from "@libs/logger";
import {
  RedisAddList,
  RedisClearKey,
  RedisGetJson,
  RedisGetList,
  RedisRemoveFromList,
  RedisSetTTL,
} from "@libs/redis";
import { keyPostDetail, keyPostLikes, keyUserPostLikes } from "./keys";
import { Post } from "@prisma/client";

/**
 * Post Detail
 */
export async function setPostCache(postId: number | string, post: Post) {
  try {
    await RedisSetTTL(keyPostDetail(postId), post, 86400); // 1 day in seconds.
  } catch (error) {
    logger.error("An error occurred while setting the post cache.");
  }
}

export async function getPostCache(postId: number | string): Promise<Post> {
  try {
    return await RedisGetJson(keyPostDetail(postId));
  } catch (error) {
    logger.error("An error occurred while getting the post cache.");
  }
}

export async function invalidatePostCache(postId: number | string) {
  try {
    await RedisClearKey(keyPostDetail(postId));
  } catch (error) {
    logger.error("There was an error clearing post cache.");
  }
}

/**
 * Post Likes
 */
export async function setPostLikesCache(userId: number, postId: number) {
  try {
    await RedisAddList(keyUserPostLikes(userId), [Date.now(), postId]);
    await RedisAddList(keyPostLikes(postId), [Date.now(), userId]);
  } catch (error) {
    logger.error("An error occurred while setting the post likes cache.");
  }
}

export async function getPostLikesCache(postId: number | string) {
  try {
    const postIds = await RedisGetList(keyPostLikes(postId));
    return postIds.map(Number);
  } catch (error) {
    logger.error(
      "An error occurred on getting the cache of likes on the post."
    );
  }
}

export async function getUserLikesPostCache(userId: number | string) {
  try {
    const postIds = await RedisGetList(keyUserPostLikes(userId));
    return postIds.map(Number);
  } catch (error) {
    logger.error(
      "An error occurred on getting the user's cache of likes on the post."
    );
  }
}

export async function invalidatePostLikesCache(userId: number, postId: number) {
  try {
    await RedisRemoveFromList(keyUserPostLikes(userId), postId);
    await RedisRemoveFromList(keyPostLikes(postId), userId);
  } catch (error) {
    logger.error("An error occurred while clearing the cache of likes.");
  }
}
