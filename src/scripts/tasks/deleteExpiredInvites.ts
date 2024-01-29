import db from '../../utils/Db.js';

const deleteExpiredInvites = async () => {
  const olderThan1h = new Date(Date.now() - 60 * 60 * 1_000);
  await db.hubInvites.deleteMany({ where: { expires: { lte: olderThan1h } } }).catch(() => null);
};
export default deleteExpiredInvites;