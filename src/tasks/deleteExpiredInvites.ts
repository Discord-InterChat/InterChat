import db from '#main/utils/Db.js';

export default async () => {
  const olderThan1h = new Date(Date.now() - 60 * 60 * 1_000);
  await db.hubInvite.deleteMany({ where: { expires: { lte: olderThan1h } } }).catch(() => null);
};
