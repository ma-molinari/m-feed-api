import logger from "@libs/logger";
import { RedisGetStr, RedisSetTTL } from "@libs/redis";
import { keyFileBuffer } from "./keys";

export async function setFileCache(filename: string, file: Buffer) {
  try {
    await RedisSetTTL(keyFileBuffer(filename), file.toString("base64"), 604800); // 7 day in seconds.
  } catch (error) {
    logger.error("An error occurred while setting the file cache.");
  }
}

export async function getFileCache(filename: string): Promise<Buffer> {
  try {
    const fileStr = await RedisGetStr(keyFileBuffer(filename));
    return Buffer.from(fileStr, "base64");
  } catch (error) {
    logger.error("An error occurred while getting the file cache.");
  }
}
