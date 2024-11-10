// src/services/BroadcastService.ts
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

export class BroadcastService {
  async broadcastMessage(
    message: Message<true>,
    hub: Hub,
    hubConnections: connectedList[],
    settings: HubSettingsManager,
    connection: connectedList,
  ) {
    const attachmentURL = await this.resolveAttachmentURL(message);
    const referredMessage = await this.fetchReferredMessage(message);
    const referredMsgData = await getReferredMsgData(referredMessage);

    const username = this.getUsername(settings, message);
    const censoredContent = censor(message.content);
    const referredContent = this.getReferredContent(referredMsgData);

    const sendResult = await Promise.all(
      hubConnections.map((conn) =>
        this.sendToConnection(message, hub, conn, {
          attachmentURL,
          referredMsgData,
          embedColor: connection.embedColor as HexColorString,
          username,
          censoredContent,
          referredContent,
        }),
      ),
    );

    await storeMessageData(message, sendResult, connection.hubId, referredMsgData.dbReferrence);
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
      Logger.error(`Failed to send message to ${connection.channelId} in server ${connection.serverId}`, e);
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
    const jumpButton = this.getJumpButton(referredAuthor?.username ?? 'Unknown', connection, dbReferrence);
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
    const webhook = new WebhookClient({ url: webhookUrl });
    return await webhook.send(data);
  }
}

