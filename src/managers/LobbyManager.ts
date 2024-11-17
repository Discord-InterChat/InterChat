import { EncryptionService } from '#main/services/EncryptionService.js';
import LobbyNotifier from '#main/services/LobbyNotifierService.js';
import getRedis from '#main/utils/Redis.js';
import type { LobbyData, LobbyServer, QueuedChannel, ServerPreferences } from '#types/ChatLobby.d.ts';
import crypto from 'crypto';
import { Redis } from 'ioredis';

export class LobbyManager {
  private readonly redis: Redis;
  private readonly encryption: EncryptionService;
  private readonly notifier: LobbyNotifier;
  constructor() {
    this.redis = getRedis();
    this.notifier = new LobbyNotifier(this);
    this.encryption = new EncryptionService();
  }

  async addToWaitingPool(
    server: Omit<LobbyServer, 'lastMessageTimestamp'>,
    preferences: ServerPreferences,
  ): Promise<void> {
    const data = JSON.stringify({ ...server, preferences, timestamp: Date.now() });
    await this.redis.zadd('waiting_pool', Date.now(), data);
  }

  async getChannelFromWaitingPool(serverId: string): Promise<QueuedChannel | null> {
    const members = await this.redis.zrange('waiting_pool', 0, -1);
    for (const member of members) {
      const data: QueuedChannel = JSON.parse(member);
      if (data.serverId === serverId) {
        return data;
      }
    }
    return null;
  }

  async removeChannelFromPool(channelId: string): Promise<void> {
    const members = await this.redis.zrange('waiting_pool', 0, -1);
    for (const member of members) {
      const data: QueuedChannel = JSON.parse(member);
      if (data.channelId === channelId) {
        await this.redis.zrem('waiting_pool', member);
        break;
      }
    }
  }

  async storeLobbyMessage(lobbyId: string, serverId: string, message: string): Promise<void> {
    const messageData = {
      serverId,
      content: message,
      timestamp: Date.now(),
    };
    const encrypted = this.encryption.encrypt(JSON.stringify(messageData));
    await this.redis.rpush(`lobby:${lobbyId}:messages`, encrypted);
    await this.redis.expire(`lobby:${lobbyId}:messages`, 86400); // 24 hours retention
  }

  async updateLastMessageTimestamp(lobbyId: string, serverId: string): Promise<void> {
    const lobby = await this.getLobby(lobbyId);
    if (lobby) {
      const serverIndex = lobby.servers.findIndex((s) => s.serverId === serverId);
      if (serverIndex !== -1) {
        lobby.servers[serverIndex].lastMessageTimestamp = Date.now();
        await this.redis.set(`lobby:${lobbyId}`, JSON.stringify(lobby));
      }
    }
  }

  async getLobby(lobbyId: string): Promise<LobbyData | null> {
    const data = await this.redis.get(`lobby:${lobbyId}`);
    return data ? JSON.parse(data) : null;
  }

  async createLobby(servers: Omit<LobbyServer, 'lastMessageTimestamp'>[]): Promise<string> {
    const lobbyId = crypto.randomBytes(16).toString('hex');
    const lobbyData: LobbyData = {
      id: lobbyId,
      servers: servers.map((s) => ({ ...s, lastMessageTimestamp: Date.now() })),
      createdAt: Date.now(),
    };

    // Store the lobby data
    await this.redis.set(`lobby:${lobbyId}`, JSON.stringify(lobbyData));

    // Create channel to lobby mapping for each channel
    for (const server of servers) {
      // remove from pool
      await this.removeChannelFromPool(server.channelId);

      await this.redis.set(`channel:${server.channelId}:lobby`, lobbyId);
      this.notifier.notifyLobbyCreate(server.channelId, lobbyData);
    }

    return lobbyId;
  }

  async getLobbyByChannelId(channelId: string): Promise<LobbyData | null> {
    // Get the lobby ID associated with this channel
    const lobbyId = await this.redis.get(`channel:${channelId}:lobby`);
    if (!lobbyId) return null;

    // Get the actual lobby data
    return this.getLobby(lobbyId);
  }

  async removeLobby(lobbyId: string): Promise<void> {
    const lobby = await this.getLobby(lobbyId);
    if (lobby) {
      // Remove channel to lobby mappings
      for (const server of lobby.servers) {
        await this.redis.del(`channel:${server.channelId}:lobby`);
        this.notifier.notifyLobbyDelete(server.channelId);
      }

      // Remove the lobby itself
      await this.redis.del(`lobby:${lobbyId}`);
      // Remove lobby messages
      // TODO: This should be done in a background job
      await this.redis.del(`lobby:${lobbyId}:messages`);
    }
  }

  async removeServerFromLobby(lobbyId: string, serverId: string): Promise<void> {
    const lobby = await this.getLobby(lobbyId);
    if (!lobby) return;

    const serverToRemove = lobby.servers.find((s) => s.serverId === serverId);
    if (!serverToRemove) return;

    // Remove the channel to lobby mapping
    await this.redis.del(`channel:${serverToRemove.channelId}:lobby`);

    // Update the lobby with remaining servers
    const remainingServers = lobby.servers.filter((s) => s.serverId !== serverId);

    if (remainingServers.length <= 1) {
      // If only one or no servers remain, remove the entire lobby
      await this.removeLobby(lobbyId);
    }
    else {
      // Update the lobby with remaining servers
      lobby.servers = remainingServers;
      await this.redis.set(`lobby:${lobbyId}`, JSON.stringify(lobby));
    }

    // Notify other servers in the lobby
    remainingServers.forEach((server) => {
      this.notifier.notifyChannelDisconnect(lobby, server.channelId);
    });
  }
}
