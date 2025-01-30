import { type Snowflake, WebhookClient } from 'discord.js';
import { type Broadcast, deleteMessageCache } from '#src/utils/network/messageUtils.js';
import { getHubConnections } from '#utils/ConnectedListUtils.js';
import { RedisKeys } from '#utils/Constants.js';
import getRedis from '#utils/Redis.js';

export const setDeleteLock = async (messageId: string) => {
  const redis = getRedis();
  const key = `${RedisKeys.msgDeleteInProgress}:${messageId}` as const;
  const alreadyLocked = await redis.get(key);
  if (alreadyLocked !== 't') await redis.set(key, 't', 'EX', 900); // 15 mins
};

export const deleteMessageFromHub = async (
  hubId: string,
  originalMsgId: string,
  dbMessagesToDelete: Broadcast[],
) => {
  await setDeleteLock(originalMsgId);

  let deletedCount = 0;
  const hubConnections = await getHubConnections(hubId);
  const hubConnectionsMap = new Map(hubConnections?.map((c) => [c.channelId, c]));

  for await (const dbMsg of Object.values(dbMessagesToDelete)) {
    const connection = hubConnectionsMap.get(dbMsg.channelId);
    if (!connection) continue;

    const webhook = new WebhookClient({ url: connection.webhookURL });
    const threadId = connection.parentId ? connection.channelId : undefined;
    await webhook.deleteMessage(dbMsg.messageId, threadId).catch(() => null);
    deletedCount++;
  }

  await getRedis().del(`${RedisKeys.msgDeleteInProgress}:${originalMsgId}`);
  deleteMessageCache(originalMsgId);
  return { deletedCount };
};

export const isDeleteInProgress = async (originalMsgId: Snowflake) => {
  const res = await getRedis().get(`${RedisKeys.msgDeleteInProgress}:${originalMsgId}`);
  return res === 't';
};
