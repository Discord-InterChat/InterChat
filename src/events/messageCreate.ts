import BaseEventListener from '#main/core/BaseEventListener.js';
import HubSettingsManager from '#main/modules/HubSettingsManager.js';
import { getConnectionHubId, getHubConnections } from '#main/utils/ConnectedList.js';
import { ConnectionMode } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import {
  buildNetworkEmbed,
  getReferredContent,
  getReferredMsgData,
  trimAndCensorBannedWebhookWords,
} from '#main/utils/network/helpers.js';
import {
  getCompactMessageFormat,
  getEmbedMessageFormat,
  getReplyMention,
} from '#main/utils/network/messageFormatters.js';
import { runChecks } from '#main/utils/network/runChecks.js';
import storeMessageData, {
  NetworkWebhookSendResult,
} from '#main/utils/network/storeMessageData.js';
import type { BroadcastOpts, ReferredMsgData } from '#main/utils/network/Types.js';
import { censor } from '#main/utils/Profanity.js';
import { generateJumpButton, getAttachmentURL, isHumanMessage } from '#main/utils/Utils.js';
import { connectedList, hubs } from '@prisma/client';
import { HexColorString, Message, WebhookClient, WebhookMessageCreateOptions } from 'discord.js';

export default class MessageCreate extends BaseEventListener<'messageCreate'> {
  readonly name = 'messageCreate';

  async execute(message: Message) {
    if (!message.inGuild() || !isHumanMessage(message)) return;

    const { connection, hubConnections } = await this.getConnectionAndHubConnections(message);
    if (!connection || !hubConnections) return;

    const hub = await db.hubs.findFirst({ where: { id: connection.hubId } });
    if (!hub) return;

    const settings = new HubSettingsManager(hub.id, hub.settings);
    const attachmentURL = await this.resolveAttachmentURL(message);

    // run checks on the message to determine if it can be sent in the network
    const checksPassed = await runChecks(message, hub, {
      settings,
      attachmentURL,
      totalHubConnections: hubConnections.length,
    });

    if (!checksPassed) return;

    message.channel.sendTyping().catch(() => null);

    // fetch the message being replied-to from discord
    const referredMessage = message.reference
      ? await message.fetchReference().catch(() => null)
      : null;

    const referredMsgData = await getReferredMsgData(referredMessage);
    const sendResult = await this.broadcastMessage(message, hub, hubConnections, settings, {
      attachmentURL,
      referredMsgData,
      embedColor: connection.embedColor as HexColorString,
    });

    // store the message in the db
    const mode = connection.compact ? ConnectionMode.Compact : ConnectionMode.Embed;
    await storeMessageData(
      message,
      sendResult,
      connection.hubId,
      mode,
      referredMsgData.dbReferrence,
    );
  }

  private async broadcastMessage(
    message: Message<true>,
    hub: hubs,
    hubConnections: connectedList[],
    settings: HubSettingsManager,
    opts: BroadcastOpts,
  ) {
    const username = this.getUsername(settings, message);
    const censoredContent = censor(message.content);
    const referredContent = this.getReferredContent(opts.referredMsgData);
    const { dbReferrence } = opts.referredMsgData;

    const results: NetworkWebhookSendResult[] = await Promise.all(
      hubConnections.map(async (connection) => {
        try {
          const author = { username, avatarURL: message.author.displayAvatarURL() };
          const reply = dbReferrence?.broadcastMsgs.get(connection.channelId) ?? dbReferrence;

          const jumpButton = reply
            ? [
              generateJumpButton(author.username, {
                channelId: connection.channelId,
                serverId: connection.serverId,
                messageId: reply.messageId,
              }),
            ]
            : undefined;

          let messageFormat;

          if (connection.compact) {
            const contents = {
              normal: message.content,
              referred: referredContent,
              censored: censoredContent,
            };

            messageFormat = getCompactMessageFormat(connection, opts, {
              servername: trimAndCensorBannedWebhookWords(message.guild.name),
              totalAttachments: message.attachments.size,
              contents,
              author,
              jumpButton,
            });
          }
          else {
            const embeds = buildNetworkEmbed(message, username, censoredContent, {
              attachmentURL: opts.attachmentURL,
              referredContent,
              embedCol: opts.embedColor,
            });

            messageFormat = getEmbedMessageFormat(connection, hub, { jumpButton, embeds });
          }

          const replyMention = getReplyMention(opts.referredMsgData.dbReferredAuthor);

          // NOTE: If multiple connections to same hub will be a feature in the future,
          // checking for only serverId will not be enough
          if (replyMention && connection.serverId === dbReferrence?.serverId) {
            messageFormat.content = `${replyMention}, ${messageFormat.content ?? ''}`;
            messageFormat.allowedMentions = {
              ...messageFormat.allowedMentions,
              users: [...(messageFormat.allowedMentions?.users ?? []), dbReferrence.authorId],
            };
          }

          const messageRes = await this.sendMessage(connection.webhookURL, messageFormat);
          const mode = connection.compact ? ConnectionMode.Compact : ConnectionMode.Embed;

          return { messageRes, webhookURL: connection.webhookURL, mode };
        }
        catch (e) {
          return { error: e.message, webhookURL: connection.webhookURL };
        }
      }),
    );

    return results;
  }

  private async resolveAttachmentURL(message: Message) {
    return message.attachments.first()?.url ?? (await getAttachmentURL(message.content));
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
    // check if the message was sent in a network channel
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
