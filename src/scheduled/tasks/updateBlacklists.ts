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

    const blacklistManager =
      type === 'user'
        ? new BlacklistManager('user', infrac.id)
        : new BlacklistManager('server', infrac.id);

    await blacklistManager.removeBlacklist(infrac.hubId);

    if (client.user) {
      if (type === 'user') {
        await logUserUnblacklist(client, new HubManager(infrac.hub), {
          id: infrac.id,
          mod: client.user,
          reason: 'Blacklist duration expired.',
        });
      }
      else if (type === 'server') {
        await logServerUnblacklist(client, new HubManager(infrac.hub), {
          id: infrac.id,
          mod: client.user,
          reason: 'Blacklist duration expired.',
        });
      }
    }
  });
};
