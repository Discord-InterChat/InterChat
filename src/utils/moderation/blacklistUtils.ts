import ServerBlacklisManager from '#main/modules/ServerBlacklistManager.js';
import UserDbManager from '#main/modules/UserDbManager.js';
import { userData } from '@prisma/client';
import { Snowflake } from 'discord.js';

export const isBlacklisted = async (
  user: Snowflake | userData,
  hubId: string,
  manager: UserDbManager | ServerBlacklisManager,
) => {
  const blacklist =
    typeof user === 'string' ? await manager.fetchBlacklist(hubId, user) : user;
  return Boolean(blacklist?.blacklistedFrom.some((b) => b.hubId === hubId));
};
