import checks from '../Scripts/message/checks';
import addBadges from '../Scripts/message/addBadges';
import messageContentModifiers from '../Scripts/message/messageContentModifiers';
import cleanup from '../Scripts/message/cleanup';
import { ActionRowBuilder, APIMessage, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message, MessageCreateOptions, WebhookClient, WebhookMessageCreateOptions } from 'discord.js';
import { getDb, colors } from '../Utils/functions/utils';
import { censor } from '../Utils/functions/wordFilter';
import { getManyConnections, getConnection } from '../Structures/network';
import { connectedList } from '@prisma/client';

export interface NetworkMessage extends Message {
  compact_message: string,
  censored_compact_message: string,
  censored_content: string,
}

export interface NetworkWebhookSendResult {
  message: APIMessage | null
  webhookId: string;
}

export interface NetworkSendResult {
  message?: Message | null
  channelId: string;
}

export default {
  name: 'messageCreate',
  async execute(message: NetworkMessage) {
    if (message.author.bot || message.webhookId || message.system) return;

    const db = getDb();
    const channelInDb = await getConnection({ channelId: message.channel.id });

    if (channelInDb?.connected) {
      const otherChannelsInHub = await getManyConnections({
        hubId: channelInDb.hubId,
        connected: true,
      });

      // ignore the message if it is not in an active network channel
      if (!await checks.execute(message, db)) return;

      message.compact_message = `**${message.author.tag}:** ${message.content}`;

      // Add quoted reply to original message and embed
      const replyInDb = await messageContentModifiers.appendReply(message);

      const embed = new EmbedBuilder()
        .setTimestamp()
        .setColor(colors('random'))
        .addFields({ name: 'Message', value: message.content || '\u200B' })
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.avatarURL() || message.author.defaultAvatarURL,
          url: `https://discord.com/users/${message.author.id}`,
        })
        .setFooter({
          text: `From: ${message.guild}`,
          iconURL: message.guild?.iconURL()?.toString(),
        });

      // Once reply is appended to the message, run it through the word fillter
      message.censored_content = censor(message.content);
      message.censored_compact_message = censor(message.compact_message);
      const censoredEmbed = new EmbedBuilder(embed.data).setFields({ name: 'Message', value: message.censored_content || '\u200B' });

      const attachments = await messageContentModifiers.attachImageToEmbed(message, embed, censoredEmbed);
      await addBadges.execute(message, db, embed, censoredEmbed);

      const channelAndMessageIds: Promise<NetworkWebhookSendResult | NetworkSendResult>[] = [];

      // send the message to all connected channels in apropriate format (webhook/compact/normal)
      otherChannelsInHub?.forEach((connection) => {
        const result = (async () => {
          const channelToSend = message.client.channels.cache.get(connection.channelId);
          if (!channelToSend || !channelToSend.isTextBased()) return { channelId: connection.channelId } as NetworkSendResult;

          const reply = replyInDb?.channelAndMessageIds.find((msg) => msg.channelId === connection.channelId);

          const replyButton = reply
            ? new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
              .setLabel('Jump')
              .setStyle(ButtonStyle.Link)
              .setURL(`https://discord.com/channels/${connection.serverId}/${reply.channelId}/${reply.messageId}`))
            : null;

          if (connection?.webhook) {
            const webhook = new WebhookClient({ id: `${connection?.webhook?.id}`, token: `${connection?.webhook?.token}` });
            const webhookMessage = createWebhookOptions(message, attachments, replyButton, connection, censoredEmbed, embed);
            const webhookSendRes = await webhook.send(webhookMessage).catch(() => null);
            return { webhookId: webhook.id, message: webhookSendRes } as NetworkWebhookSendResult;
          }

          const normalOptions = createSendOptions(message, attachments, replyButton, connection, censoredEmbed, embed);
          const sendResult = await channelToSend.send(normalOptions).catch(() => null);
          return { channelId: channelToSend.id, message: sendResult } as NetworkSendResult;
        })();
        channelAndMessageIds.push(result);
      });

      // disconnect unknown channels & insert message into messageData collection for future use
      cleanup.execute(message, channelAndMessageIds);
    }
  },
};


// decides which type of (normal) message to send depending on the settings of channel
const createSendOptions = (message: NetworkMessage, attachments: AttachmentBuilder | undefined, replyButton: ActionRowBuilder<ButtonBuilder> | null, channelInSetup: connectedList, censoredEmbed: EmbedBuilder, embed: EmbedBuilder) => {
  const options: MessageCreateOptions = {
    files: attachments ? [attachments] : [],
    components: replyButton ? [replyButton] : [],
    allowedMentions: { parse: [] },
  };

  channelInSetup.compact
    ? options.content = channelInSetup.profFilter ? message.censored_compact_message : message.compact_message
    : options.embeds = [channelInSetup.profFilter ? censoredEmbed : embed];

  return options;
};

// decides which type of (webhook) message to send depending on the settings of channel
const createWebhookOptions = (message: NetworkMessage, attachments: AttachmentBuilder | undefined, replyButton: ActionRowBuilder<ButtonBuilder> | null, channelInSetup: connectedList, censoredEmbed: EmbedBuilder, embed: EmbedBuilder) => {
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
