import UserBlacklistManager from '../../managers/UserBlacklistManager.js';
import ServerBlacklisManager from '../../managers/ServerBlacklistManager.js';
import { blacklistedServers, userData } from '@prisma/client';

export default async (blacklists: (blacklistedServers | userData)[]) => {
  if (blacklists.length === 0) return;

  const userBlacklists = new UserBlacklistManager();
  const serverBlacklists = new ServerBlacklisManager();

  for (const blacklist of blacklists) {
    const manager = 'username' in blacklist ? userBlacklists : serverBlacklists;

    for (const { hubId, expires } of blacklist.blacklistedFrom) {
      if (expires && expires < new Date()) {
        await manager.removeBlacklist(hubId, blacklist.id);
      }
      continue;
    }
  }
};
