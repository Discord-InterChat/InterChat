import { PrismaClient } from '@prisma/client';
import { isArray } from 'lodash';

const db = new PrismaClient();

(async () => {
  const idk = await db.connectedList.findRaw({ filter: {} });

  if (isArray(idk)) {
    idk.forEach(async c => {
      console.log({ id: c._id.$oid, webhook: c.webhook.url });
      await db.connectedList.update({ where: { id: c._id.$oid }, data: { webhookURL: c.webhook.url } });
    });
  }
})();