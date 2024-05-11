import {
  Collection,
  EmbedBuilder,
  HexColorString,
  Message,
  User,
  WebhookMessageCreateOptions,
} from 'discord.js';
import {
  buildNetworkEmbed,
  generateJumpButton,
  getReferredContent,
  trimAndCensorBannedWebhookWords,
} from './helpers.js';
import { censor } from '../../utils/Profanity.js';
import { broadcastedMessages, connectedList, hubs, originalMessages } from '@prisma/client';
import { HubSettingsBitField } from '../../utils/BitFields.js';
import sendMessage from './sendMessage.js';
import { NetworkWebhookSendResult } from './storeMessageData.js';

type BroadcastOpts = {
  embedColor?: HexColorString | null;
  attachmentURL?: string | null;
  referredMessage: Message | null;
  dbReferrence: (originalMessages & { broadcastMsgs: broadcastedMessages[] }) | undefined;
  referredAuthor: User | undefined;
};

export default (
  message: Message<true>,
  hub: hubs,
  allConnected: Collection<string, connectedList>,
  settings: HubSettingsBitField,
  opts: BroadcastOpts,
) => {
  const censoredContent = censor(message.content);
  const referredContent = opts.referredMessage
    ? getReferredContent(opts.referredMessage)
    : undefined;

  const servername = trimAndCensorBannedWebhookWords(message.guild.name);
  const username = trimAndCensorBannedWebhookWords(
    settings.has('UseNicknames')
      ? message.member?.displayName ?? message.author.displayName
      : message.author.username,
  );

  // embeds for the normal mode
  const { embed, censoredEmbed } = buildNetworkEmbed(message, username, censoredContent, {
    attachmentURL: opts.attachmentURL,
    referredContent,
    embedCol: opts.embedColor ?? undefined,
  });

  return allConnected.map(async (connection) => {
    try {
      const reply = opts.dbReferrence?.broadcastMsgs.find(
        (msg) => msg.channelId === connection.channelId,
      );

      const jumpButton = reply
        ? generateJumpButton(reply, opts.referredAuthor?.username, connection.serverId)
        : undefined;

      // embed format
      let messageFormat: WebhookMessageCreateOptions = {
        components: jumpButton ? [jumpButton] : undefined,
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
          ? new EmbedBuilder({
            description: replyContent,
            author: {
              name: `${opts.referredAuthor?.username?.slice(0, 30)}`,
              icon_url: opts.referredAuthor?.displayAvatarURL(),
            },
          }).setColor('Random')
          : undefined;

        // compact mode doesn't need new attachment url for tenor and direct image links
        // we can just slap them right in there without any problems
        const attachmentUrlNeeded = message.attachments.size > 0;

        // compact format (no embeds, only content)
        messageFormat = {
          username: `@${username} • ${servername}`,
          avatarURL: message.author.displayAvatarURL(),
          embeds: replyEmbed ? [replyEmbed] : undefined,
          components: jumpButton ? [jumpButton] : undefined,
          content: `${connection.profFilter ? censoredContent : message.content} ${attachmentUrlNeeded ? `\n${opts.attachmentURL}` : ''}`,
          threadId: connection.parentId ? connection.channelId : undefined,
          allowedMentions: { parse: [] },
        };
      }

      const messageOrError = await sendMessage(messageFormat, connection.webhookURL);

      // return the message and webhook URL to store the message in the db
      return {
        messageOrError,
        webhookURL: connection.webhookURL,
      } as NetworkWebhookSendResult;
    }
    catch (e) {
      // return the error and webhook URL to store the message in the db
      return {
        messageOrError: e.message,
        webhookURL: connection.webhookURL,
      } as NetworkWebhookSendResult;
    }
  });
};