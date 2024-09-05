import BaseEventListener from '#main/core/BaseEventListener.js';
import {
  buildNetworkEmbed,
  getReferredContent,
  getReferredMsgData,
  trimAndCensorBannedWebhookWords,
} from '#main/scripts/network/helpers.js';
import { runChecks } from '#main/scripts/network/runChecks.js';
import storeMessageData, {
  NetworkWebhookSendResult,
} from '#main/scripts/network/storeMessageData.js';
import { HubSettingsBitField } from '#main/utils/BitFields.js';
import { getConnectionHubId, getHubConnections } from '#main/utils/ConnectedList.js';
import Constants from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { censor } from '#main/utils/Profanity.js';
import { generateJumpButton, getAttachmentURL, isHumanMessage } from '#main/utils/Utils.js';
import { broadcastedMessages, connectedList, hubs, originalMessages } from '@prisma/client';
import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  HexColorString,
  Message,
  User,
  WebhookClient,
  WebhookMessageCreateOptions,
} from 'discord.js';

type BroadcastOpts = {
  embedColor?: HexColorString | null;
  attachmentURL?: string | null;
  referredMessage: Message | null;
  dbReferrence: (originalMessages & { broadcastMsgs: broadcastedMessages[] }) | null;
  referredAuthor: User | null;
};

type CompactFormatOpts = {
  servername: string;
  referredAuthorName: string;
  totalAttachments: number;
  author: {
    username: string;
    avatarURL: string;
  };
  contents: {
    normal: string;
    censored: string;
    referred: string | undefined;
  };
  jumpButton?: ActionRowBuilder<ButtonBuilder>[];
};

type EmbedFormatOpts = {
  hub: hubs;
  embeds: { normal: EmbedBuilder; censored: EmbedBuilder };
  jumpButton?: ActionRowBuilder<ButtonBuilder>[];
};

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

    // fetch the referred message  (message being replied to) from discord
    const referredMessage = message.reference
      ? await message.fetchReference().catch(() => null)
      : null;

    const { dbReferrence, referredAuthor } = await getReferredMsgData(referredMessage);
    const sendResult = await this.broadcastMessage(message, hub, hubConnections, settings, {
      attachmentURL,
      dbReferrence,
      referredAuthor,
      referredMessage,
      embedColor: connection.embedColor as HexColorString,
    });

    // store the message in the db
    await storeMessageData(message, sendResult, connection.hubId, dbReferrence);
  }

  private async resolveAttachmentURL(message: Message) {
    return message.attachments.first()?.url ?? (await getAttachmentURL(message.content));
  }

  private async broadcastMessage(
    message: Message<true>,
    hub: hubs,
    hubConnections: connectedList[],
    settings: HubSettingsBitField,
    opts: BroadcastOpts,
  ) {
    const censoredContent = censor(message.content);
    const referredContent =
      opts.referredMessage && opts.dbReferrence
        ? getReferredContent(opts.referredMessage)
        : undefined;

    const username = this.getUsername(settings, message);
    const { embed, censoredEmbed } = buildNetworkEmbed(message, username, censoredContent, {
      attachmentURL: opts.attachmentURL,
      referredContent,
      embedCol: opts.embedColor ?? undefined,
    });

    const results: NetworkWebhookSendResult[] = await Promise.all(
      hubConnections.map(async (connection) => {
        try {
          const author = { username, avatarURL: message.author.displayAvatarURL() };
          const reply =
            opts.dbReferrence?.broadcastMsgs.find(
              (msg) => msg.channelId === connection.channelId,
            ) ?? opts.dbReferrence;
          const jumpButton = reply
            ? [
              generateJumpButton(author.username, {
                channelId: connection.channelId,
                serverId: connection.serverId,
                messageId: reply.messageId,
              }),
            ]
            : undefined;

          const messageFormat = connection.compact
            ? this.getCompactMessageFormat(connection, opts, {
              servername: trimAndCensorBannedWebhookWords(message.guild.name),
              referredAuthorName: opts.referredAuthor?.username.slice(0, 30) ?? 'Unknown User',
              totalAttachments: message.attachments.size,
              contents: {
                normal: message.content,
                referred: referredContent,
                censored: censoredContent,
              },
              author,
              jumpButton,
            })
            : this.getEmbedMessageFormat(connection, {
              hub,
              jumpButton,
              embeds: { normal: embed, censored: censoredEmbed },
            });

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

  private async getConnectionAndHubConnections(message: Message) {
    // check if the message was sent in a network channel
    const connectionHubId = await getConnectionHubId(message.channelId);
    if (!connectionHubId) return {};

    const hubConnections = await getHubConnections(connectionHubId);
    const connection = hubConnections?.find(({ channelId }) => channelId === message.channelId);

    return {
      connection,
      hubConnections: hubConnections?.filter((c) => c.channelId !== message.channelId),
    };
  }

  private getUsername(settings: HubSettingsBitField, message: Message<true>): string {
    return trimAndCensorBannedWebhookWords(
      settings.has('UseNicknames')
        ? (message.member?.displayName ?? message.author.displayName)
        : message.author.username,
    );
  }

  private getEmbedMessageFormat(
    connection: connectedList,
    { hub, embeds, jumpButton }: EmbedFormatOpts,
  ): WebhookMessageCreateOptions {
    return {
      components: jumpButton,
      embeds: [connection.profFilter ? embeds.censored : embeds.normal],
      username: `${hub.name}`,
      avatarURL: hub.iconUrl,
      threadId: connection.parentId ? connection.channelId : undefined,
      allowedMentions: { parse: [] },
    };
  }

  private getCompactMessageFormat(
    connection: connectedList,
    opts: BroadcastOpts,
    {
      author,
      contents,
      servername,
      jumpButton,
      totalAttachments,
      referredAuthorName,
    }: CompactFormatOpts,
  ): WebhookMessageCreateOptions {
    const replyContent =
      connection.profFilter && contents.referred ? censor(contents.referred) : contents.referred;
    const replyEmbed = replyContent
      ? [
        new EmbedBuilder()
          .setDescription(replyContent)
          .setAuthor({
            name: referredAuthorName,
            iconURL: opts.referredAuthor?.displayAvatarURL(),
          })
          .setColor(Constants.Colors.invisible),
      ]
      : undefined;

    // compact mode doesn't need new attachment url for tenor and direct image links
    // we can just slap them right in the content without any problems
    const attachmentUrlNeeded = totalAttachments > 0;

    return {
      username: `@${author.username} • ${servername}`,
      avatarURL: author.avatarURL,
      embeds: replyEmbed,
      components: jumpButton,
      content: `${connection.profFilter ? contents.censored : contents.normal} ${attachmentUrlNeeded ? `\n[.](${opts.attachmentURL})` : ''}`,
      threadId: connection.parentId ? connection.channelId : undefined,
      allowedMentions: { parse: [] },
    };
  }

  private async sendMessage(webhookUrl: string, data: WebhookMessageCreateOptions) {
    const webhook = new WebhookClient({ url: webhookUrl });
    return await webhook.send(data);
  }
}
