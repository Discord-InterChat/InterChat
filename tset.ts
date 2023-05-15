import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// replace old connectedList with new connectedList (do this in prod code (old one), the schema file here wont work)
(async () => {
  const idk = await db.connectedList.findMany();

  idk.forEach(async c => {
    const svr = await db.setup.findFirst({ where: { guildId: c.serverId } });
    Object.assign(svr, { serverId: svr.guildId, connected: true });
    delete svr.guildId;

    await db.connectedList.create({ data: svr });
  });
})();