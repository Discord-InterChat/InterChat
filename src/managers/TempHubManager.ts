import type { ChatGroup, ChannelPreferences } from '#types/TempHub.d.ts';
import getRedis from '#main/utils/Redis.js';
import { Redis } from 'ioredis';

export default class TempHubManager {
  private redis: Redis;
  private readonly CHAT_GROUPS_KEY = 'chat_groups';
  private readonly CHANNEL_MAP_KEY = 'channel_map';
  private readonly PREFS_KEY = 'preferences';

  constructor(redis = getRedis()) {
    this.redis = redis;
  }

  async getChatGroups(): Promise<ChatGroup[]> {
    const groups = await this.redis.get(this.CHAT_GROUPS_KEY);
    return groups ? JSON.parse(groups) : [];
  }

  async setChatGroups(groups: ChatGroup[]): Promise<void> {
    await this.redis.set(this.CHAT_GROUPS_KEY, JSON.stringify(groups));
  }

  async getChannelGroup(channelId: string): Promise<string | null> {
    return await this.redis.hget(this.CHANNEL_MAP_KEY, channelId);
  }

  async setChannelGroup(channelId: string, groupId: string): Promise<void> {
    await this.redis.hset(this.CHANNEL_MAP_KEY, channelId, groupId);
  }

  async removeServerGroup(channelId: string): Promise<void> {
    await this.redis.hdel(this.CHANNEL_MAP_KEY, channelId);
  }

  async getServerPreferences(channelId: string): Promise<ChannelPreferences> {
    const prefs = await this.redis.hget(this.PREFS_KEY, channelId);
    return prefs ? JSON.parse(prefs) : {};
  }

  async setChannelPreferences(channelId: string, prefs: ChannelPreferences): Promise<void> {
    await this.redis.hset(this.PREFS_KEY, channelId, JSON.stringify(prefs));
  }
}
