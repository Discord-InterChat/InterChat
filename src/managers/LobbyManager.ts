import type { ChannelPreferences, ChatLobby } from '#types/ChatLobby.d.ts';
import { RedisKeys } from '#main/utils/Constants.js';
import getRedis from '#main/utils/Redis.js';
import { Redis } from 'ioredis';

export default class LobbyManager {
  private readonly redis: Redis;
  private readonly CHAT_LOBBY_KEY = RedisKeys.ChatLobby;
  private readonly CHANNEL_MAP_KEY = RedisKeys.ChannelMap;
  private readonly PREFS_KEY = RedisKeys.ChannelPrefs;

  constructor(redis = getRedis()) {
    this.redis = redis;
  }

  async getChatLobby(): Promise<ChatLobby[]> {
    const groups = await this.redis.get(this.CHAT_LOBBY_KEY);
    return groups ? JSON.parse(groups) : [];
  }

  async setChatLobbies(lobbies: ChatLobby[]): Promise<void> {
    await this.redis.set(this.CHAT_LOBBY_KEY, JSON.stringify(lobbies));
  }

  async getChannelLobbyId(channelId: string): Promise<string | null> {
    return await this.redis.hget(this.CHANNEL_MAP_KEY, channelId);
  }

  async setChannelLobby(channelId: string, groupId: string): Promise<void> {
    await this.redis.hset(this.CHANNEL_MAP_KEY, channelId, groupId);
  }

  async removeChannelFromLobby(channelId: string): Promise<void> {
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
