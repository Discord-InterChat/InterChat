import ServerBlacklisManager from '#main/modules/ServerBlacklistManager.js';
import UserDbManager from '#main/modules/UserDbManager.js';
import { blacklistedServers, userData } from '@prisma/client';
import { Snowflake } from 'discord.js';

export const isBlacklisted = async (
  userOrServer: Snowflake | userData | blacklistedServers,
  hubId: string,
  manager: UserDbManager | ServerBlacklisManager,
) => {
  const blacklist =
    typeof userOrServer === 'string' ? await manager.fetchBlacklist(hubId, userOrServer) : userOrServer;
  return Boolean(blacklist?.blacklistedFrom.some((b) => b.hubId === hubId));
};
