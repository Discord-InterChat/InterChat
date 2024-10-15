import { ConnectionMode } from '#main/config/Constants.js';
import BaseEventListener from '#main/core/BaseEventListener.js';
import HubSettingsManager from '#main/managers/HubSettingsManager.js';
import { generateJumpButton as getJumpButton } from '#utils/ComponentUtils.js';
import { getConnectionHubId, getHubConnections } from '#utils/ConnectedListUtils.js';
import db from '#utils/Db.js';
import { getAttachmentURL } from '#utils/ImageUtils.js';
import {
  buildNetworkEmbed,
  getReferredContent,
  getReferredMsgData,
} from '#utils/network/helpers.js';
import {
  getCompactMessageFormat,
  getEmbedMessageFormat,
  getReplyMention,
} from '#utils/network/messageFormatters.js';
import { runChecks } from '#utils/network/runChecks.js';
import storeMessageData, { NetworkWebhookSendResult } from '#utils/network/storeMessageData.js';
import type { BroadcastOpts, ReferredMsgData } from '#utils/network/Types.js';
import { censor } from '#utils/ProfanityUtils.js';
import { isHumanMessage, trimAndCensorBannedWebhookWords } from '#utils/Utils.js';
import { connectedList, Hub } from '@prisma/client';
import {
  ActionRowBuilder,
  ButtonBuilder,
  HexColorString,
  Message,
  WebhookClient,
  WebhookMessageCreateOptions,
} from 'discord.js';

export default class MessageCreate extends BaseEventListener<'messageCreate'> {
  readonly name = 'messageCreate';

  async execute(message: Message) {
    if (!this.isValidMessage(message)) return;

    const { connection, hubConnections } = await this.getConnectionAndHubConnections(message);
    if (!connection?.connected || !hubConnections) return;

    const hub = await this.getHub(connection.hubId);
    if (!hub) return;

    const settings = new HubSettingsManager(hub.id, hub.settings);
    const attachmentURL = await this.resolveAttachmentURL(message);

    if (
      !(await runChecks(message, hub, {
        settings,
        attachmentURL,
        totalHubConnections: hubConnections.length,
      }))
    ) {
      return;
    }

    await this.processMessage(message, hub, hubConnections, settings, connection, attachmentURL);
  }

  private isValidMessage(message: Message): message is Message<true> {
    return message.inGuild() && isHumanMessage(message);
  }

  private async getHub(hubId: string) {
    return await db.hub.findFirst({
      where: { id: hubId },
      include: { msgBlockList: true },
    });
  }

  private async processMessage(
    message: Message<true>,
    hub: Hub,
    hubConnections: connectedList[],
    settings: HubSettingsManager,
    connection: connectedList,
    attachmentURL: string | undefined,
  ) {
    message.channel.sendTyping().catch(() => null);

    const referredMessage = await this.fetchReferredMessage(message);
    const referredMsgData = await getReferredMsgData(referredMessage);

    const sendResult = await this.broadcastMessage(message, hub, hubConnections, settings, {
      attachmentURL,
      referredMsgData,
      embedColor: connection.embedColor as HexColorString,
    });

    await this.storeMessage(message, sendResult, connection, referredMsgData);
  }

  private async fetchReferredMessage(message: Message<true>): Promise<Message | null> {
    return message.reference ? await message.fetchReference().catch(() => null) : null;
  }

  private async storeMessage(
    message: Message<true>,
    sendResult: NetworkWebhookSendResult[],
    connection: connectedList,
    referredMsgData: ReferredMsgData,
  ) {
    await storeMessageData(
      message,
      sendResult,
      connection.hubId,
      connection.compact ? ConnectionMode.Compact : ConnectionMode.Embed,
      referredMsgData.dbReferrence,
    );
  }

  private async broadcastMessage(
    message: Message<true>,
    hub: Hub,
    hubConnections: connectedList[],
    settings: HubSettingsManager,
    opts: BroadcastOpts,
  ): Promise<NetworkWebhookSendResult[]> {
    const username = this.getUsername(settings, message);
    const censoredContent = censor(message.content);
    const referredContent = this.getReferredContent(opts.referredMsgData);

    return await Promise.all(
      hubConnections.map((connection) =>
        this.sendToConnection(message, hub, connection, {
          ...opts,
          username,
          censoredContent,
          referredContent,
        }),
      ),
    );
  }

  private async sendToConnection(
    message: Message<true>,
    hub: Hub,
    connection: connectedList,
    opts: BroadcastOpts & {
      referredMsgData: ReferredMsgData;
      username: string;
      censoredContent: string;
      referredContent: string | undefined;
    },
  ): Promise<NetworkWebhookSendResult> {
    try {
      const messageFormat = this.getMessageFormat(message, connection, hub, opts);
      const messageRes = await this.sendMessage(connection.webhookURL, messageFormat);
      const mode = connection.compact ? ConnectionMode.Compact : ConnectionMode.Embed;

      return { messageRes, webhookURL: connection.webhookURL, mode };
    }
    catch (e) {
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
    const { dbReferrence } = opts.referredMsgData;
    const author = { username: opts.username, avatarURL: message.author.displayAvatarURL() };
    const jumpButton = this.getJumpButton(author.username, connection, dbReferrence);

    const messageFormat = connection.compact
      ? this.getCompactFormat(message, connection, opts, author, jumpButton)
      : this.getEmbedFormat(message, connection, hub, opts, jumpButton);

    return this.addReplyMention(messageFormat, connection, opts.referredMsgData);
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

  private getCompactFormat(
    message: Message<true>,
    connection: connectedList,
    opts: BroadcastOpts & {
      username: string;
      censoredContent: string;
      referredContent: string | undefined;
    },
    author: { username: string; avatarURL: string },
    jumpButton?: ActionRowBuilder<ButtonBuilder>[],
  ): WebhookMessageCreateOptions {
    const contents = {
      normal: message.content,
      referred: opts.referredContent,
      censored: opts.censoredContent,
    };

    return getCompactMessageFormat(connection, opts, {
      servername: trimAndCensorBannedWebhookWords(message.guild.name),
      totalAttachments: message.attachments.size,
      contents,
      author,
      jumpButton,
    });
  }

  private getEmbedFormat(
    message: Message<true>,
    connection: connectedList,
    hub: Hub,
    opts: BroadcastOpts & {
      username: string;
      censoredContent: string;
      referredContent: string | undefined;
    },
    jumpButton?: ActionRowBuilder<ButtonBuilder>[],
  ): WebhookMessageCreateOptions {
    const embeds = buildNetworkEmbed(message, opts.username, opts.censoredContent, {
      attachmentURL: opts.attachmentURL,
      referredContent: opts.referredContent,
      embedCol: opts.embedColor,
    });

    return getEmbedMessageFormat(connection, hub, { jumpButton, embeds });
  }

  private addReplyMention(
    messageFormat: WebhookMessageCreateOptions,
    connection: connectedList,
    referredMsgData?: ReferredMsgData,
  ): WebhookMessageCreateOptions {

    if (referredMsgData && connection.serverId === referredMsgData.dbReferrence?.guildId) {
      const { dbReferredAuthor, dbReferrence } = referredMsgData;
      const replyMention = `${getReplyMention(dbReferredAuthor)}`;

      messageFormat.content = `${replyMention} ${messageFormat.content ?? ''}`;
      messageFormat.allowedMentions = {
        ...messageFormat.allowedMentions,
        users: [...(messageFormat.allowedMentions?.users ?? []), dbReferrence.authorId],
      };
    }

    return messageFormat;
  }

  private async resolveAttachmentURL(message: Message) {
    return (
      message.attachments.first()?.url ?? (await getAttachmentURL(message.content)) ?? undefined
    );
  }

  private getReferredContent(data: ReferredMsgData) {
    if (data.referredMessage && data.dbReferrence) {
      const messagesRepliedTo =
        data.dbReferrence.broadcastMsgs.get(data.referredMessage.channelId) ?? data.dbReferrence;

      return getReferredContent(data.referredMessage, messagesRepliedTo.mode);
    }
  }

  private async getConnectionAndHubConnections(message: Message): Promise<{
    connection: connectedList | null;
    hubConnections: connectedList[] | null;
  }> {
    const connectionHubId = await getConnectionHubId(message.channelId);
    if (!connectionHubId) return { connection: null, hubConnections: null };

    const hubConnections = await getHubConnections(connectionHubId);

    let connection: connectedList | null = null;
    const filteredHubConnections: connectedList[] = [];

    hubConnections?.forEach((conn) => {
      if (conn.channelId === message.channelId) connection = conn;
      else if (conn.connected) filteredHubConnections.push(conn);
    });

    return {
      connection,
      hubConnections: filteredHubConnections.length > 0 ? filteredHubConnections : null,
    };
  }

  private getUsername(settings: HubSettingsManager, message: Message<true>): string {
    return trimAndCensorBannedWebhookWords(
      settings.getSetting('UseNicknames')
        ? (message.member?.displayName ?? message.author.displayName)
        : message.author.username,
    );
  }

  private async sendMessage(webhookUrl: string, data: WebhookMessageCreateOptions) {
    const webhook = new WebhookClient({ url: webhookUrl });
    return await webhook.send(data);
  }
}
