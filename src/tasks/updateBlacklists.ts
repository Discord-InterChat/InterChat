// import type ServerInfractionManager from '#main/modules/InfractionManager/ServerInfractionManager.js';
// import type UserInfractionManager from '#main/modules/InfractionManager/UserInfractionManager.js';
// import db from '#main/utils/Db.js';
// import { type ServerInfraction, type UserInfraction } from '@prisma/client';
// import { ClusterManager } from 'discord-hybrid-sharding';
// import { Client } from 'discord.js';

// type ExtractedEntityInfo = {
//   id: string;
//   hubId: string;
//   moderatorId: string | null;
// };

// const extractEntityInfo = (
//   entities: (UserInfraction | ServerInfraction)[] | null,
// ): ExtractedEntityInfo[] | undefined =>
//   entities?.map((infrac) => ({
//     id: 'userId' in infrac ? infrac.userId : infrac.serverId,
//     hubId: infrac.hubId,
//     moderatorId: infrac.moderatorId,
//   }));

// export default async (manager: ClusterManager) => {
//   const query = {
//     where: { expiresAt: { not: null, lte: new Date(), gte: new Date(Date.now() - 90 * 1000) } },
//   } as const;

//   // find blacklists that expired in the past 1.5 minutes
//   const allUsers = await db.userInfraction.findMany(query);
//   const allServers = await db.serverInfraction.findMany(query);

// manager.broadcastEval(
//   async (client: Client, { users, servers }) => {
//     console.log('current dir', process.cwd());
//     const userInfracManager =
//       // eslint-disable-next-line @typescript-eslint/no-require-imports
//       require('./build/modules/UserInfractionManager.js') as typeof UserInfractionManager;

//     const serverInfracManager =
//       // eslint-disable-next-line @typescript-eslint/no-require-imports
//       require('./build/modules/ServerBlacklistManager.js') as typeof ServerInfractionManager;


//     const notifyUnblacklist = async (infrac: ExtractedEntityInfo, type: 'user' | 'server') => {
//       const blacklistManager =
//         type === 'user' ? new userInfracManager(infrac.id) : new serverInfracManager(infrac.id);

//       if (client.user) {
//         await blacklistManager.logUnblacklist(client, infrac.hubId, infrac.id, {
//           mod: client.user,
//           reason: 'Blacklist expired.',
//         });
//       }
//     };

//     users?.forEach(async (infrac) => await notifyUnblacklist(infrac, 'user'));
//     servers?.forEach(async (infrac) => await notifyUnblacklist(infrac, 'server'));
//   },
//   {
//     shard: 1,
//     context: { users: extractEntityInfo(allUsers), servers: extractEntityInfo(allServers) },
//   },
// );
// };
