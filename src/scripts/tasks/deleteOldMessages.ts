import db from '../../utils/Db.js';

// Delete all network messages from db that are older than 24 hours old.
export default async () => {
  const olderThan24h = Date.now() - 60 * 60 * 24_000;

  const data = await db.broadcastedMessages.findMany({
    where: { createdAt: { lte: olderThan24h } },
  });
  await db.broadcastedMessages.deleteMany({ where: { createdAt: { lte: olderThan24h } } });

  await db.originalMessages.deleteMany({
    where: { messageId: { in: data.map((d) => d.originalMsgId) } },
  });
};
