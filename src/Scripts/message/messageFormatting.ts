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
    attachments: AttachmentBuilder | undefined,
    replyButton: ActionRowBuilder<ButtonBuilder> | null,
    channelInSetup: connectedList,
    embeds: {censored: EmbedBuilder, normal: EmbedBuilder},
  ) {
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
      webhookMessage.embeds = [channelInSetup?.profFilter ? embeds.censored : embeds.normal];
      webhookMessage.username = message.client.user.username;
      webhookMessage.avatarURL = message.client.user.avatarURL() || undefined;
    }
    return webhookMessage;
  },
};
