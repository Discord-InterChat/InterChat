import TempHubManager from '#main/managers/TempHubManager.js';
import Logger from '#main/utils/Logger.js';
import type { ChatGroup, ChannelPreferences } from '#types/TempHub.d.ts';
import { v4 as uuidv4 } from 'uuid';

export const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
export const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check every minute

export class TempHubService {
  private manager: TempHubManager;

  constructor() {
    this.manager = new TempHubManager();
    setInterval(() => {
      this.checkIdleGroups().catch(Logger.error);
    }, ACTIVITY_CHECK_INTERVAL);
  }

  async connectChannel(
    serverId: string,
    channelId: string,
    preferences: ChannelPreferences = {},
  ): Promise<ChatGroup> {
    const existingGroupId = await this.manager.getChannelGroup(channelId);
    if (existingGroupId) {
      throw new Error('Server is already connected to a chat group');
    }

    // Save preferences
    await this.manager.setChannelPreferences(channelId, preferences);

    const groups = await this.manager.getChatGroups();
    const currentTime = Date.now();

    // Try to find best matching group
    let group = this.findBestGroup(groups, preferences, currentTime);

    if (!group) {
      group = {
        id: uuidv4(),
        connections: [],
        lastActivity: currentTime,
        activityLevel: 0,
      };
      groups.push(group);
    }

    // Add server to group
    group.connections.push({ serverId, channelId, lastActivity: currentTime });

    await this.manager.setChatGroups(groups);
    await this.manager.setChannelGroup(channelId, group.id);

    return group;
  }

  async updateActivity(groupId: string, channelId: string): Promise<void> {
    const groups = await this.manager.getChatGroups();
    const group = groups.find((g) => g.id === groupId);

    if (!group) return;

    const currentTime = Date.now();

    // Update timestamps
    group.lastActivity = currentTime;
    const server = group.connections.find((s) => s.channelId === channelId);
    if (server) {
      server.lastActivity = currentTime;
    }

    // Update activity level (messages in last 5 minutes)
    group.activityLevel = (group.activityLevel || 0) + 1;

    await this.manager.setChatGroups(groups);
  }

  async checkIdleGroups(): Promise<void> {
    const groups = await this.manager.getChatGroups();
    const currentTime = Date.now();
    let modified = false;

    groups.forEach((group) => {
      const originalLength = group.connections.length;

      // Check for idle servers within group
      group.connections = group.connections.filter((server) => {
        const isActive = currentTime - server.lastActivity < IDLE_TIMEOUT;
        if (!isActive) this.manager.removeServerGroup(server.channelId);
        return isActive;
      });

      // Set modified to true if the number of connections has changed
      if (group.connections.length !== originalLength) modified = true;

      // Recalculate group activity level
      group.activityLevel = Math.max(0, group.activityLevel - 1);
    });

    // Remove empty groups
    const activeGroups = groups.filter((group) => group.connections.length > 0);

    if (modified || activeGroups.length !== groups.length) {
      await this.manager.setChatGroups(activeGroups);
    }
  }
  async disconnectChannel(channelId: string): Promise<void> {
    const groupId = await this.manager.getChannelGroup(channelId);
    if (!groupId) {
      throw new Error('Server is not connected to any chat group');
    }

    const groups = await this.manager.getChatGroups();
    const groupIndex = groups.findIndex((g) => g.id === groupId);

    if (groupIndex === -1) {
      throw new Error('Chat group not found');
    }

    // Remove server from group
    groups[groupIndex].connections = groups[groupIndex].connections.filter(
      (s) => s.channelId !== channelId,
    );

    // Remove empty groups
    if (groups[groupIndex].connections.length === 0) {
      groups.splice(groupIndex, 1);
    }

    // Update Redis
    await this.manager.setChatGroups(groups);
    await this.manager.removeServerGroup(channelId);
  }

  async getChannelGroup(channelId: string): Promise<ChatGroup | null> {
    const groupId = await this.manager.getChannelGroup(channelId);
    if (!groupId) return null;

    const groups = await this.manager.getChatGroups();
    return groups.find((g) => g.id === groupId) || null;
  }

  protected findBestGroup(
    groups: ChatGroup[],
    prefs: ChannelPreferences,
    currentTime: number,
  ): ChatGroup | null {
    const activeGroups = groups.filter((group) => {
      const isActive = currentTime - group.lastActivity < IDLE_TIMEOUT;
      const hasSpace = group.connections.length < (prefs.maxServers || 3);
      const meetsActivity = group.activityLevel >= (prefs.minActivityLevel || 0);
      const serverNotInGroup = !group.connections.some((s) => s.serverId === prefs.serverId);
      console.log(group.connections, prefs.serverId);
      return isActive && hasSpace && meetsActivity && serverNotInGroup;
    });

    if (activeGroups.length === 0) return null;

    // Sort by best match (activity level and available space)
    return activeGroups.sort((a, b) => {
      const aScore = a.activityLevel * (3 - a.connections.length);
      const bScore = b.activityLevel * (3 - b.connections.length);
      return bScore - aScore;
    })[0];
  }
}
