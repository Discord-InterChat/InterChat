import type { Message } from 'discord.js';
import type { Redis } from 'ioredis';
import getRedis from '#main/utils/Redis.js';

export default class AntiSpamManager {
  private config: SpamConfig;
  private redis: Redis;

  constructor(config: SpamConfig, redis = getRedis()) {
    this.redis = redis;
    this.config = config;
  }

  public async handleMessage(message: Message): Promise<UserMessageInfo | undefined> {
    const userId = message.author.id;
    const currentTime = Date.now();
    const key = `spam:${userId}`;

    const userInfo = await this.getUserInfo(key);

    if (currentTime - userInfo.lastMessage < this.config.timeWindow) {
      userInfo.messageCount++;
      if (userInfo.messageCount >= this.config.spamThreshold) {
        userInfo.lastMessage = currentTime;
        await this.incrementSpamCount(message.author.id);
        await this.setUserInfo(key, userInfo);
        return userInfo;
      }
    }
    else {
      userInfo.messageCount = 1;
    }

    userInfo.lastMessage = currentTime;
    await this.setUserInfo(key, userInfo);
  }

  private async getUserInfo(key: string): Promise<UserMessageInfo> {
    const data = await this.redis.hgetall(key);
    return {
      messageCount: Number.parseInt(data.messageCount || '0', 10),
      lastMessage: Number.parseInt(data.lastMessage || '0', 10),
    };
  }

  private async setUserInfo(key: string, info: UserMessageInfo): Promise<void> {
    await this.redis.hmset(key, {
      messageCount: info.messageCount.toString(),
      lastMessage: info.lastMessage.toString(),
    });
    await this.redis.expire(key, this.config.timeWindow / 1000);
  }

  private async incrementSpamCount(userId: string): Promise<void> {
    const key = `spamcount:${userId}`;
    await this.redis.incr(key);
    await this.redis.expire(key, this.config.spamCountExpirySecs);
  }

  public async getSpamCount(userId: string): Promise<number> {
    const key = `spamcount:${userId}`;
    const count = await this.redis.get(key);
    return Number.parseInt(count || '0', 10);
  }
}

interface UserMessageInfo {
  messageCount: number;
  lastMessage: number;
}

interface SpamConfig {
  spamThreshold: number;
  timeWindow: number;
  spamCountExpirySecs: number;
}
