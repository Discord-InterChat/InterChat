import { connectedList } from '@prisma/client';
import { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder, MessageCreateOptions, WebhookMessageCreateOptions } from 'discord.js';
import { NetworkMessage } from '../../Events/messageCreate';

export default {
  /**
   * @deprecated Sending messages directly using the bot is deprecated. Use `createWebhookOptions` instead
   */
  createEmbedOptions(
    attachments: AttachmentBuilder | undefined,
    replyButton: ActionRowBuilder<ButtonBuilder> | null,
    channelInSetup: connectedList,
    embeds: { normal: EmbedBuilder, censored: EmbedBuilder },
  ) {
    const options: MessageCreateOptions = {
      files: attachments ? [attachments] : [],
      components: replyButton ? [replyButton] : [],
      allowedMentions: { parse: [] },
    };

    options.embeds = [channelInSetup.profFilter ? embeds.censored : embeds.normal];
    return options;
  },

  // decides which type of (webhook) message to send depending on the settings of channel
  createWebhookOptions(
    message: NetworkMessage,
    connection: connectedList,
    replyButton: ActionRowBuilder<ButtonBuilder> | null,
    embeds: { censored: EmbedBuilder, normal: EmbedBuilder, reply?: EmbedBuilder },
    attachments: AttachmentBuilder | undefined,
  ) {
    const webhookMessage: WebhookMessageCreateOptions = {
      username: message.author.tag,
      avatarURL: message.author.avatarURL() || message.author.defaultAvatarURL,
      files: attachments ? [attachments] : [],
      components: replyButton ? [replyButton] : [],
      allowedMentions: { parse: [] },
    };

    if (connection.compact) {
      webhookMessage.content = connection?.profFilter ? message.censored_content : message.content;
      webhookMessage.embeds = embeds.reply ? [embeds.reply] : undefined;
    }
    else {
      webhookMessage.embeds = [connection?.profFilter ? embeds.censored : embeds.normal];
      webhookMessage.username = message.client.user.username;
      webhookMessage.avatarURL = message.client.user.avatarURL() || undefined;
    }
    return webhookMessage;
  },
};
