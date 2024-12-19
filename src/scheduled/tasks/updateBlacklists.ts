import BlacklistManager from '#main/managers/BlacklistManager.js';
import HubManager from '#main/managers/HubManager.js';
import db from '#utils/Db.js';
import { logServerUnblacklist, logUserUnblacklist } from '#utils/hub/logger/ModLogs.js';
import type { Client } from 'discord.js';

export default async (client: Client) => {
  const allInfractions = await db.infraction.findMany({
    where: { status: 'ACTIVE', expiresAt: { not: null, lte: new Date() } },
    include: { hub: true },
  });

  allInfractions?.forEach(async (infrac) => {
    const type = infrac.userId ? 'user' : 'server';
    const targetId = infrac.userId ?? infrac.serverId!;

    const blacklistManager = new BlacklistManager(type, targetId);
    await blacklistManager.removeBlacklist(infrac.hubId);

    if (client.user) {
      const opts = {
        id: targetId,
        mod: client.user,
        reason: 'Blacklist duration expired.',
      };
      if (type === 'user') {
        await logUserUnblacklist(client, new HubManager(infrac.hub), opts);
      }
      else if (type === 'server') {
        await logServerUnblacklist(client, new HubManager(infrac.hub), opts);
      }
    }
  });
};
