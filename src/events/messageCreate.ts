import BaseEventListener from '#main/core/BaseEventListener.js';
import {
  buildNetworkEmbed,
  fetchConnectionAndHub,
  generateJumpButton,
  getReferredContent,
  getReferredMsgData,
  trimAndCensorBannedWebhookWords,
} from '#main/scripts/network/helpers.js';
import { runChecks } from '#main/scripts/network/runChecks.js';
import storeMessageData, {
  NetworkWebhookSendResult,
} from '#main/scripts/network/storeMessageData.js';
import { HubSettingsBitField } from '#main/utils/BitFields.js';
import { censor } from '#main/utils/Profanity.js';
import { getAttachmentURL, isHumanMessage } from '#main/utils/Utils.js';
import { broadcastedMessages, connectedList, hubs, originalMessages } from '@prisma/client';
import {
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

export default class MessageCreate extends BaseEventListener<'messageCreate'> {
  readonly name = 'messageCreate';

  async execute(message: Message) {
    if (!message.inGuild() || !isHumanMessage(message)) return;

    // check if the message was sent in a network channel
    const { connection, hub, hubConnections, settings } = await fetchConnectionAndHub(message);

    if (!hub) return;

    const attachmentURL =
      message.attachments.first()?.url ?? (await getAttachmentURL(message.content));

    // run checks on the message to determine if it can be sent in the network
    const checksPassed = await runChecks(message, hub, {
      settings,
      hubConnections,
      attachmentURL,
    });

    if (checksPassed === false) return;

    message.channel.sendTyping().catch(() => null);

    // fetch the referred message  (message being replied to) from discord
    const referredMessage = message.reference
      ? await message.fetchReference().catch(() => null)
      : null;

    const { dbReferrence, referredAuthor } = await getReferredMsgData(referredMessage);
    const sendResult = await this.sendBroadcast(message, hub, hubConnections, settings, {
      attachmentURL,
      dbReferrence,
      referredAuthor,
      referredMessage,
      embedColor: connection.embedColor as HexColorString,
    });

    // only delete the message if there is no attachment or if the user has already viewed the welcome message
    // deleting attachments will make the image not show up in the embed (discord removes it from its cdn)
    // if (!attachment) message.delete().catch(() => null);

    // store the message in the db
    await storeMessageData(message, sendResult, connection.hubId, dbReferrence);
  }

  private async sendBroadcast(
    message: Message<true>,
    hub: hubs,
    allConnected: connectedList[],
    settings: HubSettingsBitField,
    opts: BroadcastOpts,
  ) {
    const censoredContent = censor(message.content);
    const referredContent =
      opts.referredMessage && opts.dbReferrence
        ? getReferredContent(opts.referredMessage)
        : undefined;

    const servername = trimAndCensorBannedWebhookWords(message.guild.name);
    const username = trimAndCensorBannedWebhookWords(
      settings.has('UseNicknames')
        ? (message.member?.displayName ?? message.author.displayName)
        : message.author.username,
    );

    // embeds for the normal mode
    const { embed, censoredEmbed } = buildNetworkEmbed(message, username, censoredContent, {
      attachmentURL: opts.attachmentURL,
      referredContent,
      embedCol: opts.embedColor ?? undefined,
    });

    const authorUsername = opts.referredAuthor?.username.slice(0, 30) ?? '@Unknown User';

    const res = allConnected.map(async (connection) => {
      try {
        const reply = opts.dbReferrence?.broadcastMsgs.find(
          (msg) => msg.channelId === connection.channelId,
        );

        const jumpButton = reply
          ? [generateJumpButton(reply, authorUsername, connection.serverId)]
          : undefined;

        // embed format
        let messageFormat: WebhookMessageCreateOptions = {
          components: jumpButton,
          embeds: [connection.profFilter ? censoredEmbed : embed],
          username: `${hub.name}`,
          avatarURL: hub.iconUrl,
          threadId: connection.parentId ? connection.channelId : undefined,
          allowedMentions: { parse: [] },
        };

        if (connection.compact) {
          const replyContent =
            connection.profFilter && referredContent ? censor(referredContent) : referredContent;

          // preview embed for the message being replied to
          const replyEmbed = replyContent
            ? [
              new EmbedBuilder()
                .setDescription(replyContent)
                .setAuthor({
                  name: `${authorUsername}`,
                  iconURL: opts.referredAuthor?.displayAvatarURL(),
                })
                .setColor('Random'),
            ]
            : undefined;

          // compact mode doesn't need new attachment url for tenor and direct image links
          // we can just slap them right in there without any problems
          const attachmentUrlNeeded = message.attachments.size > 0;

          // compact format (no embeds, only content)
          messageFormat = {
            username: `@${username} • ${servername}`,
            avatarURL: message.author.displayAvatarURL(),
            embeds: replyEmbed,
            components: jumpButton,
            content: `${connection.profFilter ? censoredContent : message.content} ${attachmentUrlNeeded ? `\n${opts.attachmentURL}` : ''}`,
            threadId: connection.parentId ? connection.channelId : undefined,
            allowedMentions: { parse: [] },
          };
        }

        const messageOrError = await this.sendMessage(connection.webhookURL, messageFormat);

        // return the message and webhook URL to store the message in the db
        return {
          messageOrError,
          webhookURL: connection.webhookURL,
        } as NetworkWebhookSendResult;
      }
      catch (e) {
        // return the error and webhook URL to store the message in the db
        return {
          messageOrError: { error: e.message },
          webhookURL: connection.webhookURL,
        } as NetworkWebhookSendResult;
      }
    });

    return await Promise.all(res);
  }
  private async sendMessage(webhookUrl: string, data: WebhookMessageCreateOptions) {
    const webhook = new WebhookClient({ url: webhookUrl });
    return await webhook.send(data);
  }
}
