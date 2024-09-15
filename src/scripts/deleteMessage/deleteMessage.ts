import cacheClient from '#main/utils/cache/cacheClient.js';
import { cacheData, getCachedData } from '#main/utils/cache/cacheUtils.js';
import { getHubConnections } from '#main/utils/ConnectedList.js';
import { RedisKeys } from '#main/utils/Constants.js';
import { broadcastedMessages } from '@prisma/client';
import { Snowflake, WebhookClient } from 'discord.js';

export const deleteMessageFromAllNetworks = async (
  hubId: string,
  originalMsgId: string,
  dbMessagesToDelete: broadcastedMessages[],
) => {
  await cacheData(`${RedisKeys.msgDeleteInProgress}:${originalMsgId}`, 't', 60);

  let deletedCount = 0;
  const hubConnections = await getHubConnections(hubId);
  const hubConnectionsMap = new Map(hubConnections?.map((c) => [c.channelId, c]));
  console.log(hubConnections?.length, hubConnectionsMap.size);

  for await (const dbMsg of dbMessagesToDelete) {
    const connection = hubConnectionsMap?.get(dbMsg.channelId);
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
  return res.data === 't' ? true : false;
};
