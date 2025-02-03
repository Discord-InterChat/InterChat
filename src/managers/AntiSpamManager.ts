/*
 * Copyright (C) 2025 InterChat
 *
 * InterChat is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * InterChat is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with InterChat.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { Message } from 'discord.js';
import type { Redis } from 'ioredis';
import getRedis from '#src/utils/Redis.js';

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
