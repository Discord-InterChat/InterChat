import BlacklistManager from '#main/modules/BlacklistManager.js';
import ServerInfractionManager from '#main/modules/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/modules/InfractionManager/UserInfractionManager.js';
import { isBlacklisted } from '#main/utils/moderation/blacklistUtils.js';

/**
 * Checks if a user or server is blacklisted in a given hub.
 * @param hubId - The ID of the hub to check in.
 * @param guildId - The ID of the guild to check for blacklist.
 * @param userId - The ID of the user to check for blacklist.
 * @returns An object containing whether the user and/or server is blacklisted in the hub.
 */
export const checkBlacklists = async (
  hubId: string,
  guildId: string,
  userId: string,
) => {
  const userBlacklistManager = new BlacklistManager(new UserInfractionManager(userId));
  const guildBlacklistManager = new BlacklistManager(new ServerInfractionManager(guildId));

  const userBlacklist = await userBlacklistManager.fetchBlacklist(hubId);
  const serverBlacklist = await guildBlacklistManager.fetchBlacklist(hubId);

  return {
    userBlacklisted: isBlacklisted(userBlacklist),
    serverBlacklisted: isBlacklisted(serverBlacklist),
  };
};
