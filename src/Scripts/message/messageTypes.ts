import logger from '../../Utils/logger';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, GuildTextBasedChannel, MessageCreateOptions, WebhookClient, WebhookMessageCreateOptions } from 'discord.js';
import { NetworkMessage } from '../../Events/messageCreate';
import { getDb } from '../../Utils/functions/utils';
import { InvalidChannelId, InvalidWebhookId } from './cleanup';
import { connectedList, messageData, setup } from '@prisma/client';

/*
 FIXME:
 Rewrite this entire process of sending message to the network.
  I have commented out the return values from two of the catch blocks
  as it disconnects every channel if there is an error (eg. too long message; too huge file size to send),
  this isn't a flaw with the code so that disconnection was unnecessary. And a ton of lost data from the db.
*/
export = {
  execute: async (
    message: NetworkMessage,
    channel: connectedList,
    embed: EmbedBuilder,
    censoredEmbed: EmbedBuilder,
    attachments: AttachmentBuilder | undefined,
    replyData: messageData | null | undefined,
  ) => {
    const db = getDb();
    const channelInSetup = await db?.setup?.findFirst({ where: { channelId: channel?.channelId } });
    const channelToSend = await message.client.channels.fetch(channel.channelId).catch(() => null) as GuildTextBasedChannel | null;

    if (!channelToSend) return { unknownChannelId: channel?.channelId } as InvalidChannelId;

    const replyInDb = replyData?.channelAndMessageIds.find((msg) => msg.channelId === channel.channelId);

    const replyButton = replyInDb
      ? new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
        .setLabel('Jump')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${channelToSend.guildId}/${replyInDb.channelId}/${replyInDb.messageId}`))
      : null;

    if (channelInSetup?.webhook) {
      const webhook = new WebhookClient({ id: `${channelInSetup?.webhook?.id}`, token: `${channelInSetup?.webhook?.token}` });
      const webhookMessage = createWebhookOptions(message, attachments, replyButton, channelInSetup, censoredEmbed, embed);
      try {
        return await webhook.send(webhookMessage);
      }
      catch (e) {
        logger.error('Failed to send Webhook Message: ', e);
        return { unknownWebhookId: webhook.id } as InvalidWebhookId;
      }
    }

    const options = createSendOptions(message, attachments, replyButton, channelInSetup, censoredEmbed, embed);
    try {
      return await channelToSend.send(options);
    }
    catch (e) {
      logger.error('Failed to send Message: ', e);
      return;
      // return { unknownChannelId: channelToSend.id } as InvalidChannelId;
    }
  },
};

// decides which type of (normal) message to send depending on the settings of channel
const createSendOptions = (message: NetworkMessage, attachments: AttachmentBuilder | undefined, replyButton: ActionRowBuilder<ButtonBuilder> | null, channelInSetup: setup | null, censoredEmbed: EmbedBuilder, embed: EmbedBuilder) => {
  const options: MessageCreateOptions = {
    files: attachments ? [attachments] : [],
    components: replyButton ? [replyButton] : [],
    allowedMentions: { parse: [] },
  };

  channelInSetup?.compact
    ? options.content = channelInSetup?.profFilter ? message.censored_compact_message : message.compact_message
    : options.embeds = [channelInSetup?.profFilter ? censoredEmbed : embed];

  return options;
};

// decides which type of (webhook) message to send depending on the settings of channel
const createWebhookOptions = (message: NetworkMessage, attachments: AttachmentBuilder | undefined, replyButton: ActionRowBuilder<ButtonBuilder> | null, channelInSetup: setup, censoredEmbed: EmbedBuilder, embed: EmbedBuilder) => {
  const webhookMessage: WebhookMessageCreateOptions = {
    username: message.author.tag,
    avatarURL: message.author.avatarURL() || message.author.defaultAvatarURL,
    files: attachments ? [attachments] : [],
    components: replyButton ? [replyButton] : [],
    allowedMentions: { parse: [] },
  };

  if (channelInSetup.compact) {
    webhookMessage.content = channelInSetup?.profFilter ? message.censored_content : message.content;
  }
  else {
    webhookMessage.embeds = [channelInSetup?.profFilter ? censoredEmbed : embed];
    webhookMessage.username = message.client.user.username;
    webhookMessage.avatarURL = message.client.user.avatarURL() || undefined;
  }
  return webhookMessage;
};
