import { Message, WebhookClient, WebhookMessageCreateOptions, HexColorString } from 'discord.js';
import { Hub, connectedList } from '@prisma/client';
import HubSettingsManager from '#main/managers/HubSettingsManager.js';
import { getAttachmentURL } from '#utils/ImageUtils.js';
import { getReferredContent, getReferredMsgData } from '#utils/network/utils.js';
import storeMessageData, { NetworkWebhookSendResult } from '#utils/network/storeMessageData.js';
import MessageFormattingService from '#main/services/MessageFormattingService.js';
import Logger from '#main/utils/Logger.js';
import { generateJumpButton as getJumpButton } from '#utils/ComponentUtils.js';
import { ConnectionMode } from '#utils/Constants.js';
import { censor } from '#utils/ProfanityUtils.js';
import { trimAndCensorBannedWebhookWords } from '#utils/Utils.js';
import { ReferredMsgData, BroadcastOpts } from '#main/utils/network/Types.js';

const BATCH_SIZE = 15;
const CONCURRENCY_LIMIT = 10;

export class BroadcastService {
  private webhookClients: Map<string, WebhookClient> = new Map();

  constructor() {
    setInterval(() => this.cleanupWebhookClients(), 5 * 60 * 1000); // 5 minutes
  }

  private getWebhookClient(webhookURL: string): WebhookClient {
    let client = this.webhookClients.get(webhookURL);
    if (!client) {
      client = new WebhookClient({ url: webhookURL });
      this.webhookClients.set(webhookURL, client);
    }
    return client;
  }

  private cleanupWebhookClients() {
    this.webhookClients.forEach((client, url) => {
      client.destroy();
      this.webhookClients.delete(url);
    });
  }

  async broadcastMessage(
    message: Message<true>,
    hub: Hub,
    hubConnections: connectedList[],
    settings: HubSettingsManager,
    connection: connectedList,
  ) {
    const attachmentURL = await this.resolveAttachmentURL(message);
    const username = this.getUsername(settings, message);
    const censoredContent = censor(message.content);
    const referredMessage = await this.fetchReferredMessage(message);
    const referredMsgData = await getReferredMsgData(referredMessage);
    const referredContent = this.getReferredContent(referredMsgData);

    // Sort connections by last active first
    const sortedHubConnections = hubConnections.sort(
      (a, b) => b.lastActive.getTime() - a.lastActive.getTime(),
    );

    Logger.debug(`Broadcasting message to ${sortedHubConnections.length} connections`);

    // Split connections into batches
    const batches = this.chunkArray(sortedHubConnections, BATCH_SIZE);
    const allResults: NetworkWebhookSendResult[] = [];

    // Process batches with concurrency limit
    for (const batch of batches) {
      const batchPromises = batch.map((conn) =>
        this.sendToConnection(message, hub, conn, {
          attachmentURL,
          referredMsgData,
          embedColor: connection.embedColor as HexColorString,
          username,
          censoredContent,
          referredContent,
        }),
      );

      Logger.debug(`Sending batch of ${batch.length} messages`);
      const batchResults = await this.processWithConcurrency(batchPromises, CONCURRENCY_LIMIT);
      allResults.push(...batchResults);
      Logger.debug(`Sent batch of ${batch.length} messages`);
    }

    // Batch store message data
    await storeMessageData(message, allResults, connection.hubId, referredMsgData.dbReferrence);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async processWithConcurrency<T>(
    promises: Promise<T>[],
    concurrency: number,
  ): Promise<T[]> {
    const results: T[] = [];
    let index = 0;

    async function next(): Promise<void> {
      const currentIndex = index++;
      if (currentIndex >= promises.length) return;

      try {
        const result = await promises[currentIndex];
        results[currentIndex] = result;
      }
      catch (error) {
        results[currentIndex] = error;
      }

      await next();
    }

    // Start initial batch of promises
    const initialPromises = Array(Math.min(concurrency, promises.length))
      .fill(null)
      .map(() => next());

    await Promise.all(initialPromises);
    return results;
  }
  async resolveAttachmentURL(message: Message) {
    return (
      message.attachments.first()?.url ?? (await getAttachmentURL(message.content)) ?? undefined
    );
  }

  private async fetchReferredMessage(message: Message<true>): Promise<Message | null> {
    return message.reference ? await message.fetchReference().catch(() => null) : null;
  }

  private getReferredContent(data: ReferredMsgData) {
    if (data.referredMessage && data.dbReferrence) {
      const mode =
        data.dbReferrence.broadcastMsgs.get(data.referredMessage.channelId)?.mode ??
        ConnectionMode.Compact;
      return getReferredContent(data.referredMessage, mode);
    }
  }

  private getUsername(settings: HubSettingsManager, message: Message<true>): string {
    return trimAndCensorBannedWebhookWords(
      settings.getSetting('UseNicknames')
        ? (message.member?.displayName ?? message.author.displayName)
        : message.author.username,
    );
  }

  private async sendToConnection(
    message: Message<true>,
    hub: Hub,
    connection: connectedList,
    opts: BroadcastOpts & {
      username: string;
      censoredContent: string;
      referredContent: string | undefined;
      referredMsgData: ReferredMsgData;
    },
  ): Promise<NetworkWebhookSendResult> {
    try {
      const messageFormat = this.getMessageFormat(message, connection, hub, opts);
      const messageRes = await this.sendMessage(connection.webhookURL, messageFormat);
      const mode = connection.compact ? ConnectionMode.Compact : ConnectionMode.Embed;

      return { messageRes, webhookURL: connection.webhookURL, mode };
    }
    catch (e) {
      Logger.error(
        `Failed to send message to ${connection.channelId} in server ${connection.serverId}`,
        e,
      );
      return { error: e.message, webhookURL: connection.webhookURL };
    }
  }

  private getMessageFormat(
    message: Message<true>,
    connection: connectedList,
    hub: Hub,
    opts: BroadcastOpts & {
      username: string;
      censoredContent: string;
      referredContent: string | undefined;
      referredMsgData: ReferredMsgData;
    },
  ): WebhookMessageCreateOptions {
    const { dbReferrence, referredAuthor } = opts.referredMsgData;
    const author = { username: opts.username, avatarURL: message.author.displayAvatarURL() };
    const jumpButton = this.getJumpButton(
      referredAuthor?.username ?? 'Unknown',
      connection,
      dbReferrence,
    );
    const servername = trimAndCensorBannedWebhookWords(message.guild.name);

    const messageFormatter = new MessageFormattingService(connection);
    return messageFormatter.format(message, {
      ...opts,
      hub,
      author,
      servername,
      jumpButton,
    });
  }

  private getJumpButton(
    username: string,
    { channelId, serverId }: connectedList,
    dbReferrence: ReferredMsgData['dbReferrence'],
  ) {
    const reply = dbReferrence?.broadcastMsgs.get(channelId) ?? dbReferrence;
    return reply?.messageId
      ? [getJumpButton(username, { channelId, serverId, messageId: reply.messageId })]
      : undefined;
  }

  private async sendMessage(webhookUrl: string, data: WebhookMessageCreateOptions) {
    const webhook = this.getWebhookClient(webhookUrl);
    return await webhook.send(data);
  }
}
