import LobbyManager from '#main/managers/LobbyManager.js';
import Logger from '#main/utils/Logger.js';
import type { ChatLobby, ChannelPreferences } from '#main/types/ChatLobby.js';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import getRedis from '#main/utils/Redis.js';
import db from '#main/utils/Db.js';
import { Snowflake } from 'discord.js';
import { RedisKeys } from '#main/utils/Constants.js';
import LobbyNotifier from '#main/modules/LobbyNotifier.js';

export const IDLE_TIMEOUT = 5 * 60 * 1000;
export const ACTIVITY_CHECK_INTERVAL = 60 * 1000;
export const QUEUE_CHECK_INTERVAL = 5 * 1000; // Reduced to 5 seconds for faster matching
export const MAX_LOBBY_SIZE = 3;

interface QueuedChannel {
  serverId: string;
  channelId: string;
  preferences: ChannelPreferences;
  timestamp: number;
  priority: number; // New: Priority level for weighted matching
}

interface MatchingPool {
  high: QueuedChannel[];
  medium: QueuedChannel[];
  low: QueuedChannel[];
}

export default class ChatLobbyService {
  private readonly manager: LobbyManager;
  private readonly redis: Redis;
  private readonly POOL_KEY = `${RedisKeys.MatchingPool}:`;
  private readonly lobbyNotifier: LobbyNotifier;
  private isProcessing = false;

  constructor(lobbyNotifier: LobbyNotifier) {
    this.redis = getRedis();
    this.manager = new LobbyManager();
    this.lobbyNotifier = lobbyNotifier;

    setInterval(() => this.checkIdleLobbies().catch(Logger.error), ACTIVITY_CHECK_INTERVAL);
    setInterval(() => this.processMatchingPool().catch(Logger.error), QUEUE_CHECK_INTERVAL);
  }

  private getPoolKey(tier: keyof MatchingPool): string {
    return `${this.POOL_KEY}${tier}`;
  }

  private async addToPool(tier: keyof MatchingPool, channel: QueuedChannel): Promise<void> {
    const key = this.getPoolKey(tier);
    await this.redis.zadd(key, channel.timestamp, JSON.stringify(channel));
  }

  private async removeFromPool(tier: keyof MatchingPool, channelId: string): Promise<boolean> {
    const key = this.getPoolKey(tier);
    const multi = this.redis.multi();

    const members = await this.redis.zrange(key, 0, -1);

    for (const member of members) {
      const channel = JSON.parse(member) as QueuedChannel;
      if (channel.channelId === channelId) {
        multi.zrem(key, member);
        const results = await multi.exec();
        return results !== null && results[0][1] === 1;
      }
    }
    return false;
  }

  private async getPoolMembers(tier: keyof MatchingPool): Promise<QueuedChannel[]> {
    const key = this.getPoolKey(tier);
    const members = await this.redis.zrange(key, 0, -1);
    return members.map((m) => JSON.parse(m) as QueuedChannel);
  }

  async connectChannel(
    serverId: string,
    channelId: string,
    preferences: ChannelPreferences = {},
  ): Promise<{ queued: boolean; lobby?: ChatLobby }> {
    const existingLobbyId = await this.manager.getChannelLobbyId(channelId);
    if (existingLobbyId) {
      throw new Error(`Channel ${channelId} is already connected to a lobby`);
    }

    await this.manager.setChannelPreferences(channelId, preferences);

    // Try immediate matching first
    const result = await this.tryImmediateMatch(serverId, channelId, preferences);
    if (result) {
      return { queued: false, lobby: result };
    }

    // Add to appropriate pool based on priority
    const priority = this.calculatePriority(preferences);
    const queuedChannel: QueuedChannel = {
      serverId,
      channelId,
      preferences,
      timestamp: Date.now(),
      priority,
    };

    // eslint-disable-next-line no-nested-ternary
    const tier = priority >= 8 ? 'high' : priority >= 4 ? 'medium' : 'low';
    await this.addToPool(tier, queuedChannel);

    return { queued: true };
  }

  private calculatePriority(preferences: ChannelPreferences): number {
    let priority = 5; // Base priority

    // Adjust based on preferences
    if (preferences.premium) priority += 3;
    if (preferences.minActivityLevel && preferences.minActivityLevel > 5) priority += 2;
    if (preferences.maxWaitTime && preferences.maxWaitTime < 60000) priority += 2;

    return priority;
  }

  private async tryImmediateMatch(
    serverId: string,
    channelId: string,
    preferences: ChannelPreferences,
  ): Promise<ChatLobby | null> {
    const lobbies = await this.manager.getChatLobby();
    const currentTime = Date.now();

    // Find best matching lobby with weighted scoring
    const matchingLobby =
      lobbies
        .filter((lobby) => {
          const isActive = currentTime - lobby.lastActivity < IDLE_TIMEOUT;
          const hasSpace = lobby.connections.length < (preferences.maxServers || MAX_LOBBY_SIZE);
          const meetsActivity = lobby.activityLevel >= (preferences.minActivityLevel || 0);
          const serverNotInLobby = !lobby.connections.some((s) => s.serverId === serverId);

          return isActive && hasSpace && meetsActivity && serverNotInLobby;
        })
        .map((lobby) => ({
          lobby,
          score: this.calculateMatchScore(lobby, preferences),
        }))
        .sort((a, b) => b.score - a.score)
        .find((match) => match.score > 0.7)?.lobby || null;

    if (matchingLobby) {
      matchingLobby.connections.push({
        serverId,
        channelId,
        lastActivity: currentTime,
      });

      await this.manager.setChatLobbies(lobbies);
      await this.manager.setChannelLobby(channelId, matchingLobby.id);

      this.lobbyNotifier.notifychannelConnect(channelId, matchingLobby);
      return matchingLobby;
    }

    return null;
  }

  private calculateMatchScore(lobby: ChatLobby, preferences: ChannelPreferences): number {
    let score = 0;

    // Size match (0-0.4)
    const idealSize = preferences.idealLobbySize || 3;
    const sizeDiff = Math.abs(lobby.connections.length + 1 - idealSize);
    score += 0.4 * (1 - sizeDiff / MAX_LOBBY_SIZE);

    // Activity match (0-0.3)
    const activityMatch = lobby.activityLevel >= (preferences.minActivityLevel || 0);
    score += activityMatch ? 0.3 : 0;

    // Recency match (0-0.3)
    const recency = 1 - (Date.now() - lobby.lastActivity) / IDLE_TIMEOUT;
    score += 0.3 * recency;

    return score;
  }

  private async processMatchingPool(): Promise<void> {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;
      // Process high priority first
      await this.processPoolTier('high');

      // Check if high pool is empty before processing medium
      const highCount = await this.redis.zcard(this.getPoolKey('high'));
      if (highCount === 0) {
        await this.processPoolTier('medium');
      }

      // Check if both pools are empty before processing low
      const mediumCount = await this.redis.zcard(this.getPoolKey('medium'));
      if (highCount === 0 && mediumCount === 0) {
        await this.processPoolTier('low');
      }
    }
    catch (error) {
      Logger.error('Error processing matching pool:', error);
    }
    finally {
      this.isProcessing = false;
    }
  }

  private async processPoolTier(tier: keyof MatchingPool): Promise<void> {
    let pool = await this.getPoolMembers(tier);
    if (pool.length < 2) return;

    // Process matches in batches
    while (pool.length >= 2) {
      const channel1 = pool[0];
      let bestMatch: { channel: QueuedChannel; score: number; index: number } | null = null;

      // Find best match for the first channel in pool
      for (let j = 1; j < pool.length; j++) {
        const channel2 = pool[j];
        const matchScore = this.calculateChannelMatchScore(channel1, channel2);
        if (matchScore > (bestMatch?.score || 0.7)) {
          bestMatch = { channel: channel2, score: matchScore, index: j };
        }
      }

      if (bestMatch) {
        // Create lobby and remove from Redis
        await this.createLobbyFromMatch(channel1, bestMatch.channel);
        await Promise.all([
          this.removeFromPool(tier, channel1.channelId),
          this.removeFromPool(tier, bestMatch.channel.channelId),
        ]);

        // Refresh pool data after successful match
        pool = await this.getPoolMembers(tier);
      }
      else {
        // If no match found for first channel, remove it from our working set
        pool.shift();
      }
    }
  }
  private calculateChannelMatchScore(channel1: QueuedChannel, channel2: QueuedChannel): number {
    if (channel1.serverId === channel2.serverId) return 0;

    let score = 0.5; // Base score for valid match

    // Preference alignment (0-0.3)
    const prefsMatch = this.preferencesAlign(channel1.preferences, channel2.preferences);
    score += prefsMatch ? 0.3 : 0;

    // Wait time factor (0-0.2)
    const maxWaitTime = Math.max(
      channel1.preferences.maxWaitTime || 300000,
      channel2.preferences.maxWaitTime || 300000,
    );
    const longestWait = Math.max(Date.now() - channel1.timestamp, Date.now() - channel2.timestamp);
    score += 0.2 * Math.min(longestWait / maxWaitTime, 1);

    return score;
  }

  private preferencesAlign(prefs1: ChannelPreferences, prefs2: ChannelPreferences): boolean {
    // Check basic compatibility
    if (
      (prefs1.maxServers && prefs1.maxServers < 2) ||
      (prefs2.maxServers && prefs2.maxServers < 2)
    ) {
      return false;
    }

    // Activity level compatibility
    const activityMatch =
      Math.abs((prefs1.minActivityLevel || 0) - (prefs2.minActivityLevel || 0)) <= 2;

    return activityMatch;
  }

  private async createLobbyFromMatch(
    channel1: QueuedChannel,
    channel2: QueuedChannel,
  ): Promise<void> {
    const currentTime = Date.now();
    const newLobby: ChatLobby = {
      id: uuidv4(),
      connections: [
        {
          serverId: channel1.serverId,
          channelId: channel1.channelId,
          lastActivity: currentTime,
        },
        {
          serverId: channel2.serverId,
          channelId: channel2.channelId,
          lastActivity: currentTime,
        },
      ],
      lastActivity: currentTime,
      activityLevel: 0,
    };

    const lobbys = await this.manager.getChatLobby();
    lobbys.push(newLobby);

    await this.manager.setChannelLobby(channel1.channelId, newLobby.id);
    await this.manager.setChannelLobby(channel2.channelId, newLobby.id);
    await this.manager.setChatLobbies(lobbys);

    // Emit events for both channels that were matched
    this.lobbyNotifier.notifylobbyCreate(channel1.channelId, newLobby);
    this.lobbyNotifier.notifylobbyCreate(channel2.channelId, newLobby);
  }

  async storeChatHistory(
    lobbyId: string,
    serverId: Snowflake,
    channelId: Snowflake,
    users: string[],
  ): Promise<void> {
    const exists = await db.lobbyChatHistory.findFirst({
      where: { serverId, lobbyId, channelId },
    });

    if (exists) {
      const newUsers = [...new Set([...exists.users, ...users])];
      await db.lobbyChatHistory.update({
        where: { id: exists.id },
        data: { users: { set: newUsers } },
      });
    }
    else {
      await db.lobbyChatHistory.create({ data: { serverId, channelId, lobbyId, users } });
    }
  }

  async updateActivity(lobbyId: string, channelId: string): Promise<void> {
    const lobbys = await this.manager.getChatLobby();
    const lobby = lobbys.find((g) => g.id === lobbyId);

    if (!lobby) {
      Logger.warn(`Attempted to update activity for non-existent lobby: ${lobbyId}`);
      return;
    }

    const currentTime = Date.now();
    lobby.lastActivity = currentTime;

    const connection = lobby.connections.find((s) => s.channelId === channelId);
    if (connection) {
      connection.lastActivity = currentTime;
      // Increment activity level with a cap
      lobby.activityLevel = Math.min((lobby.activityLevel || 0) + 1, 10);
    }
    else {
      Logger.warn(`Channel ${channelId} not found in lobby ${lobbyId}`);
    }

    await this.manager.setChatLobbies(lobbys);
  }

  async checkIdleLobbies(): Promise<void> {
    const lobbys = await this.manager.getChatLobby();
    const currentTime = Date.now();
    let modified = false;

    for (const lobby of lobbys) {
      const originalLength = lobby.connections.length;
      const activeConnections = [];
      const inactiveConnections = [];

      // Separate active and inactive connections
      for (const connection of lobby.connections) {
        if (currentTime - connection.lastActivity < IDLE_TIMEOUT) {
          activeConnections.push(connection);
        }
        else {
          inactiveConnections.push(connection);
          await this.manager.removeChannelFromLobby(connection.channelId);
          Logger.info(`Removed idle channel ${connection.channelId} from lobby ${lobby.id}`);
        }
      }

      // Update lobby connections
      lobby.connections = activeConnections;

      if (activeConnections.length !== originalLength) {
        modified = true;
      }

      // Decay activity level
      lobby.activityLevel = Math.max(0, lobby.activityLevel - 1);

      // Notify remaining members about disconnections
      if (inactiveConnections.length > 0) {
        inactiveConnections.forEach((c) =>
          this.lobbyNotifier.notifychannelDisconnect(lobby, c.channelId),
        );
      }
    }

    // Filter out empty lobbys
    const activeLobbies = lobbys.filter((lobby) => lobby.connections.length > 0);

    if (modified || activeLobbies.length !== lobbys.length) {
      await this.manager.setChatLobbies(activeLobbies);
    }
  }

  async disconnectChannel(channelId: string): Promise<void> {
    // Check if in any matching pool
    const tiers: (keyof MatchingPool)[] = ['high', 'medium', 'low'];
    for (const tier of tiers) {
      if (await this.removeFromPool(tier, channelId)) {
        Logger.info(`Removed channel ${channelId} from ${tier} priority pool`);
        return;
      }
    }

    // If not in pools, check active lobbys
    const lobbyId = await this.manager.getChannelLobbyId(channelId);
    if (!lobbyId) {
      throw new Error('Channel is not connected to any chat lobby');
    }

    const lobbys = await this.manager.getChatLobby();
    const lobbyIndex = lobbys.findIndex((g) => g.id === lobbyId);

    if (lobbyIndex === -1) {
      throw new Error('Chat lobby not found');
    }

    const lobby = lobbys[lobbyIndex];
    const originalLength = lobby.connections.length;

    // Remove the channel from the lobby
    lobby.connections = lobby.connections.filter((s) => s.channelId !== channelId);

    // If lobby is only left with one channel, remove the lobby
    if (lobby.connections.length === 1) {
      const lastConnection = lobby.connections[0];
      // Remove the last channel from the lobby
      this.manager.removeChannelFromLobby(lastConnection.channelId);
      lobbys.splice(lobbyIndex, 1);

      // Notify the remaining channel about disconnection
      this.lobbyNotifier.notifyLobbyDelete(lastConnection.channelId);
      Logger.info(`Removed empty lobby ${lobbyId}`);
    }
    else if (lobby.connections.length !== originalLength) {
      // If channel was actually removed, update the lobby
      lobbys[lobbyIndex] = lobby;
      Logger.info(`Removed channel ${channelId} from lobby ${lobbyId}`);
    }

    await this.manager.setChatLobbies(lobbys);
    await this.manager.removeChannelFromLobby(channelId);

    // Notify other channels in the lobby
    this.lobbyNotifier.notifychannelDisconnect(lobby, channelId);
  }

  public async getChannelLobby(channelId: string): Promise<ChatLobby | null> {
    const lobbyId = await this.manager.getChannelLobbyId(channelId);
    if (!lobbyId) return null;

    const lobbys = await this.manager.getChatLobby();
    return lobbys.find((g) => g.id === lobbyId) || null;
  }

  public async removeFromPoolByChannelId(channelId: string): Promise<void> {
    const tiers: (keyof MatchingPool)[] = ['high', 'medium', 'low'];
    for (const tier of tiers) {
      await this.removeFromPool(tier, channelId);
    }
  }

  public async getPoolInfo(channelId: string): Promise<{
    position: number | null;
    estimatedWaitTime: number | null;
    priority: string | null;
  }> {
    try {
      // Check each priority tier
      const tiers: (keyof MatchingPool)[] = ['high', 'medium', 'low'];

      for (const tier of tiers) {
        const members = await this.getPoolMembers(tier);
        const index = members.findIndex((ch) => ch.channelId === channelId);

        if (index !== -1) {
          // Calculate estimated wait time based on position and historical data
          const estimatedWaitTime = await this.calculateEstimatedWaitTime(index, tier);

          return {
            position: index + 1,
            estimatedWaitTime,
            priority: tier,
          };
        }
      }

      // Channel not found in any queue
      return {
        position: null,
        estimatedWaitTime: null,
        priority: null,
      };
    }
    catch (error) {
      Logger.error('Error getting queue info:', error);
      throw error;
    }
  }

  private async calculateEstimatedWaitTime(
    position: number,
    tier: keyof MatchingPool,
  ): Promise<number> {
    // Base wait times per tier (in milliseconds)
    const baseWaitTimes = {
      high: 15000, // 15 seconds
      medium: 30000, // 30 seconds
      low: 60000, // 1 minute
    };
    try {
      // Get current pool size from Redis
      const poolSize = await this.redis.zcard(this.getPoolKey(tier));

      // Factor in position (each position adds some time)
      const positionFactor = Math.ceil(position / 2) * 5000; // 5 seconds per pair

      // Factor in current pool congestion
      const poolSizeFactor = Math.max(
        0,
        (poolSize - 2) * 2000, // 2 seconds per additional user in pool
      );

      // Get historical wait times for this tier from Redis
      const historicalKey = `${this.POOL_KEY}${tier}:historical`;
      const historicalWaitTimes = await this.redis.lrange(historicalKey, 0, 9); // Last 10 matches

      // Calculate historical adjustment
      let historicalFactor = 0;
      if (historicalWaitTimes.length > 0) {
        const avgHistorical =
          historicalWaitTimes.map(Number).reduce((sum, time) => sum + time, 0) /
          historicalWaitTimes.length;
        historicalFactor = Math.max(0, avgHistorical * 0.2); // 20% weight to historical data
      }

      return baseWaitTimes[tier] + positionFactor + poolSizeFactor + historicalFactor;
    }
    catch (error) {
      Logger.error('Error calculating wait time:', error);
      // Return base estimate if Redis fails
      return baseWaitTimes[tier] + position * 5000;
    }
  }

  // Helper method to record actual wait times
  private async recordActualWaitTime(tier: keyof MatchingPool, waitTime: number): Promise<void> {
    try {
      const historicalKey = `${this.POOL_KEY}${tier}:historical`;
      await this.redis.lpush(historicalKey, waitTime);
      await this.redis.ltrim(historicalKey, 0, 9); // Keep last 10 entries
    }
    catch (error) {
      Logger.error('Error recording wait time:', error);
    }
  }

  public async getStats(): Promise<{
    activeLobbies: number;
    queuedChannels: number;
    averageWaitTime: number;
    priorityDistribution: Record<string, number>;
  }> {
    try {
      // Get lobby count
      const lobbies = await this.manager.getChatLobby();

      // Get counts from Redis
      const [highCount, mediumCount, lowCount] = await Promise.all([
        this.redis.zcard(this.getPoolKey('high')),
        this.redis.zcard(this.getPoolKey('medium')),
        this.redis.zcard(this.getPoolKey('low')),
      ]);

      const queuedChannels = highCount + mediumCount + lowCount;

      // Calculate wait times from Redis
      const currentTime = Date.now();
      const [highPool, mediumPool, lowPool] = await Promise.all([
        this.getPoolMembers('high'),
        this.getPoolMembers('medium'),
        this.getPoolMembers('low'),
      ]);

      const allWaitTimes = [...highPool, ...mediumPool, ...lowPool].map(
        (channel) => currentTime - channel.timestamp,
      );

      const averageWaitTime =
        allWaitTimes.length > 0
          ? allWaitTimes.reduce((sum, time) => sum + time, 0) / allWaitTimes.length
          : 0;

      return {
        activeLobbies: lobbies.length,
        queuedChannels,
        averageWaitTime,
        priorityDistribution: {
          high: Number(highCount),
          medium: Number(mediumCount),
          low: Number(lowCount),
        },
      };
    }
    catch (error) {
      Logger.error('Error getting stats:', error);
      throw error;
    }
  }
}
