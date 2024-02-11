import db from '../../utils/Db.js';

export default async () => {
  const olderThan1h = Date.now() - 60 * 60 * 1_000;
  await db.hubInvites.deleteMany({ where: { expiresAt: { lte: olderThan1h } } }).catch(() => null);
};
