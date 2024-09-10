import BaseEventListener from '#main/core/BaseEventListener.js';
import {
  buildNetworkEmbed,
  getReferredContent,
  getReferredMsgData,
  trimAndCensorBannedWebhookWords,
} from '#main/scripts/network/helpers.js';
import type { BroadcastOpts, ReferredMsgData } from '#main/scripts/network/Types.d.ts';
import { runChecks } from '#main/scripts/network/runChecks.js';
import storeMessageData, {
  NetworkWebhookSendResult,
} from '#main/scripts/network/storeMessageData.js';
import { HubSettingsBitField } from '#main/utils/BitFields.js';
import { getConnectionHubId, getHubConnections } from '#main/utils/ConnectedList.js';
import db from '#main/utils/Db.js';
import { censor } from '#main/utils/Profanity.js';
import { generateJumpButton, getAttachmentURL, isHumanMessage } from '#main/utils/Utils.js';
import { connectedList, hubs } from '@prisma/client';
import { HexColorString, Message, WebhookClient, WebhookMessageCreateOptions } from 'discord.js';
import {
  getCompactMessageFormat,
  getEmbedMessageFormat,
  getReplyMention,
} from '#main/scripts/network/messageFormatters.js';

export default class MessageCreate extends BaseEventListener<'messageCreate'> {
  readonly name = 'messageCreate';

  async execute(message: Message) {
    if (!message.inGuild() || !isHumanMessage(message)) return;

    const { connection, hubConnections } = await this.getConnectionAndHubConnections(message);
    if (!connection || !hubConnections) return;

    const hub = await db.hubs.findFirst({ where: { id: connection.hubId } });
    if (!hub) return;

    const settings = new HubSettingsBitField(hub.settings);
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
    await storeMessageData(message, sendResult, connection.hubId, referredMsgData.dbReferrence);
  }

  private async broadcastMessage(
    message: Message<true>,
    hub: hubs,
    hubConnections: connectedList[],
    settings: HubSettingsBitField,
    opts: BroadcastOpts,
  ) {
    const { referredMsgData } = opts;

    const referredContent = this.getReferredContent(referredMsgData);
    const censoredContent = censor(message.content);
    const username = this.getUsername(settings, message);

    const results: NetworkWebhookSendResult[] = await Promise.all(
      hubConnections.map(async (connection) => {
        try {
          const author = { username, avatarURL: message.author.displayAvatarURL() };
          const reply =
            referredMsgData.dbReferrence?.broadcastMsgs.find(
              (m) => m.channelId === connection.channelId,
            ) ?? referredMsgData.dbReferrence;

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

          const replyMention = getReplyMention(referredMsgData.dbReferredAuthor);
          const { dbReferrence } = referredMsgData;

          // NOTE: If multiple connections to same hub is possible in the future, checking for serverId only won't be enough
          if (replyMention && connection.serverId === dbReferrence?.serverId) {
            messageFormat.content = `${replyMention}, ${messageFormat.content ?? ''}`;
            messageFormat.allowedMentions = {
              ...messageFormat.allowedMentions,
              users: [...(messageFormat.allowedMentions?.users ?? []), dbReferrence.authorId],
            };
          }

          const messageRes = await this.sendMessage(connection.webhookURL, messageFormat);
          return { messageRes, webhookURL: connection.webhookURL };
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
    return data?.referredMessage && data.dbReferrence
      ? getReferredContent(data.referredMessage)
      : undefined;
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
      else filteredHubConnections.push(conn);
    });

    return {
      connection,
      hubConnections: filteredHubConnections.length > 0 ? filteredHubConnections : null,
    };
  }

  private getUsername(settings: HubSettingsBitField, message: Message<true>): string {
    return trimAndCensorBannedWebhookWords(
      settings.has('UseNicknames')
        ? (message.member?.displayName ?? message.author.displayName)
        : message.author.username,
    );
  }

  private async sendMessage(webhookUrl: string, data: WebhookMessageCreateOptions) {
    const webhook = new WebhookClient({ url: webhookUrl });
    return await webhook.send(data);
  }
}
