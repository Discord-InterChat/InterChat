import { RedisKeys } from '#main/config/Constants.js';
import cacheClient from '#main/utils/cache/cacheClient.js';
import { cacheData, getCachedData } from '#main/utils/cache/cacheUtils.js';
import { getHubConnections } from '#main/utils/ConnectedList.js';
import { broadcastedMessages } from '@prisma/client';
import { Snowflake, WebhookClient } from 'discord.js';

export const setDeleteLock = async (messageId: string) => {
  const key = `${RedisKeys.msgDeleteInProgress}:${messageId}` as const;
  const alreadyLocked = await getCachedData(key);
  if (!alreadyLocked.data) await cacheData(key, 't', 900); // 15 mins
};

export const deleteMessageFromHub = async (
  hubId: string,
  originalMsgId: string,
  dbMessagesToDelete: broadcastedMessages[],
) => {
  await setDeleteLock(originalMsgId);

  let deletedCount = 0;
  const hubConnections = await getHubConnections(hubId);
  const hubConnectionsMap = new Map(hubConnections?.map((c) => [c.channelId, c]));

  for await (const dbMsg of dbMessagesToDelete) {
    const connection = hubConnectionsMap.get(dbMsg.channelId);
    if (!connection) continue;

    const webhook = new WebhookClient({ url: connection.webhookURL });
    const threadId = connection.parentId ? connection.channelId : undefined;
    await webhook.deleteMessage(dbMsg.messageId, threadId).catch(() => null);
    deletedCount++;
  }

  await cacheClient.del(`${RedisKeys.msgDeleteInProgress}:${originalMsgId}`);
  return { deletedCount };
};

export const isDeleteInProgress = async (originalMsgId: Snowflake) => {
  const res = await getCachedData(`${RedisKeys.msgDeleteInProgress}:${originalMsgId}`);
  return res.data === 't';
};
