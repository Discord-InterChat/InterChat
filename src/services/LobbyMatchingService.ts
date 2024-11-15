import type { QueuedChannel, ServerPreferences } from '#types/ChatLobby.d.ts';
import db from '#main/utils/Db.js';
import getRedis from '#main/utils/Redis.js';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

export class MatchingService {
  private readonly db: PrismaClient;
  private readonly redis: Redis;

  constructor() {
    this.db = db;
    this.redis = getRedis();
  }

  async findMatch(serverId: string, preferences: ServerPreferences): Promise<QueuedChannel | null> {
    const serverHistory = await this.db.serverHistory.findUnique({
      where: { serverId },
    });

    const recentLobbyIds =
      serverHistory?.recentLobbies
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 3)
        .map((l) => l.lobbyId) || [];

    const waitingServers = await this.redis.zrange('waiting_pool', 0, -1);

    for (const serverData of waitingServers) {
      const data: QueuedChannel = JSON.parse(serverData);
      if (data.serverId === serverId) continue;

      const otherServerHistory = await this.db.serverHistory.findUnique({
        where: { serverId: data.serverId },
      });

      // Check if in the past 2 calls they have been in a lobby together
      const hasRecentInteraction = recentLobbyIds.some((lobbyId, i) =>
        i <= 2 && otherServerHistory?.recentLobbies.some((l) => l.lobbyId === lobbyId),
      );

      if (!hasRecentInteraction) {
        // Check premium status and preferences
        if (preferences.premiumStatus || data.preferences.premium) {
          // Premium users get priority matching
          return data;
        }

        // Regular matching
        if (preferences.maxServersInLobby === data.preferences.maxServersInLobby) {
          // TODO: make it possible for servers to join already created lobbies later if they don't match immediately
          return data;
        }
      }
    }

    return null;
  }
}
