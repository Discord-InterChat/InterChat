import db from '#main/utils/Db.js';
import ServerInfractionManager from '#main/managers/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import { type ServerInfraction, type UserInfraction } from '@prisma/client';
import type { Client } from 'discord.js';
import BlacklistManager from '#main/managers/BlacklistManager.js';
import { logServerUnblacklist, logUserUnblacklist } from '#main/utils/HubLogger/ModLogs.js';

type ExtractedEntityInfo = {
  id: string;
  hubId: string;
  moderatorId: string | null;
};

const unblacklistEntity = async (
  client: Client,
  infrac: ExtractedEntityInfo,
  type: 'user' | 'server',
) => {
  if (client.user) {
    if (type === 'user') {
      await logUserUnblacklist(client, infrac.hubId, {
        id: infrac.id,
        mod: client.user,
        reason: 'Blacklist duration expired.',
      });
    }
    else if (type === 'server') {
      await logServerUnblacklist(client, infrac.hubId, {
        id: infrac.id,
        mod: client.user,
        reason: 'Blacklist duration expired.',
      });
    }
  }

  const blacklistManager =
    type === 'user'
      ? new BlacklistManager(new UserInfractionManager(infrac.id))
      : new BlacklistManager(new ServerInfractionManager(infrac.id));

  await blacklistManager.removeBlacklist(infrac.hubId);
};

const extractEntityInfo = (
  entities: (UserInfraction | ServerInfraction)[] | null,
): ExtractedEntityInfo[] | undefined =>
  entities?.map((infrac) => ({
    id: 'userId' in infrac ? infrac.userId : infrac.serverId,
    hubId: infrac.hubId,
    moderatorId: infrac.moderatorId,
  }));

export default async (client: Client) => {
  const query = {
    where: { status: 'ACTIVE', expiresAt: { not: null, lte: new Date() } },
  } as const;

  // find blacklists that expired in the past 1.5 minutes
  const allUsers = await db.userInfraction.findMany(query);
  const allServers = await db.serverInfraction.findMany(query);

  extractEntityInfo(allUsers)?.forEach(
    async (infrac) => await unblacklistEntity(client, infrac, 'user'),
  );
  extractEntityInfo(allServers)?.forEach(
    async (infrac) => await unblacklistEntity(client, infrac, 'server'),
  );
};
