import { captureException } from '@sentry/node';
import db from '../../utils/Db.js';
import { deleteMsgsFromDb } from '../../utils/Utils.js';

// Delete all network messages from db that are older than 24 hours old.
const deleteOldMessages = async () => {
  const olderThan24h = Date.now() - 60 * 60 * 24_000;

  db.broadcastedMessages
    .findMany({ where: { createdAt: { lte: olderThan24h } } })
    .then(async (m) => deleteMsgsFromDb(m.map(({ messageId }) => messageId)))
    .catch(captureException);
};

export default deleteOldMessages;