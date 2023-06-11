import checks from '../Scripts/message/checks';
import messageContentModifiers from '../Scripts/message/messageContentModifiers';
import messageFormats from '../Scripts/message/messageFormatting';
import cleanup from '../Scripts/message/cleanup';
import { ActionRowBuilder, APIMessage, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, Message, User, WebhookClient } from 'discord.js';
import { getDb, colors } from '../Utils/functions/utils';
import { censor } from '../Utils/functions/wordFilter';
import { messageData } from '@prisma/client';

export interface NetworkMessage extends Message {
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
    const channelInDb = await db.connectedList.findFirst({ where: { channelId: message.channel.id } });

    if (channelInDb?.connected) {
      if (!await checks.execute(message, channelInDb)) return;

      message.censored_content = censor(message.content);
      const attachment = messageContentModifiers.getAttachment(message);
      const attachmentURL = !attachment ? await messageContentModifiers.getAttachmentURL(message) : undefined;

      const embed = new EmbedBuilder()
        .setDescription(message.content)
        .setImage(attachment ? `attachment://${attachment.name}` : attachmentURL || null)
        .setColor(colors('random'))
        .setAuthor({
          name: `@${message.author.tag}`,
          iconURL: message.author.displayAvatarURL() || message.author.defaultAvatarURL,
          url: `https://discord.com/users/${message.author.id}`,
        })
        .setFooter({
          text: `Server: ${message.guild?.name}`,
          iconURL: message.guild?.iconURL() || undefined,
        });

      // author of the message being replied to
      let referredAuthor: User | undefined;
      let replyInDb: messageData | null;
      let referedMsgEmbed: EmbedBuilder | undefined; // for compact messages

      if (message.reference) {
        const referredMessage = await message.fetchReference().catch(() => null);
        if (referredMessage) {
          replyInDb = await db.messageData.findFirst({
            where: {
              channelAndMessageIds: { some: { messageId: referredMessage.id } },
            },
          });

          referredAuthor = replyInDb
            ? await message.client.users.fetch(replyInDb?.authorId).catch(() => undefined)
            : undefined;

          // Add quoted reply to embeds
          embed.addFields({
            name: 'Reply-to:',
            value: `${messageContentModifiers.getReferredContent(message, referredMessage)}`,
          });
          referedMsgEmbed = new EmbedBuilder()
            .setColor(embed.data.color || 'Random')
            .setDescription(`${messageContentModifiers.getReferredContent(message, referredMessage)?.replace(/^/gm, '> ')}`)
            .setAuthor({
              name: `@${referredAuthor?.username}`,
              iconURL: referredAuthor?.avatarURL() || undefined,
            });
        }
      }

      // define censored embed after reply is added to reflect that in censored embed as well
      const censoredEmbed = new EmbedBuilder(embed.data).setDescription(message.censored_content);
      // await addBadges.execute(message, db, embed, censoredEmbed);

      // send the message to all connected channels in apropriate format (webhook/compact/normal)
      const messageResults: Promise<NetworkWebhookSendResult | NetworkSendResult>[] = [];
      const hubConnections = await db.connectedList.findMany({
        where: { hubId: channelInDb.hubId, connected: true },
      });
      hubConnections?.forEach((connection) => {
        const result = (async () => {
          const channelToSend = message.client.channels.cache.get(connection.channelId);
          if (!channelToSend || !channelToSend.isTextBased()) return { channelId: connection.channelId } as NetworkSendResult;

          const reply = replyInDb?.channelAndMessageIds.find((msg) => msg.channelId === connection.channelId);
          const replyButton = reply
            ? new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
              .setLabel(
                (referredAuthor && referredAuthor.tag.length >= 80
                  ? referredAuthor.tag.slice(0, 76) + '...'
                  : referredAuthor?.tag) || 'Jump',
              )
              .setStyle(ButtonStyle.Link)
              .setEmoji(message.client.emotes.normal.reply)
              .setURL(`https://discord.com/channels/${connection.serverId}/${reply.channelId}/${reply.messageId}`))
            : null;

          if (connection?.webhook) {
            const webhook = new WebhookClient({ id: `${connection?.webhook?.id}`, token: `${connection?.webhook?.token}` });
            const webhookMessage = messageFormats.createWebhookOptions(message, connection, replyButton,
              { censored: censoredEmbed, normal: embed, reply: referedMsgEmbed }, attachment);
            const webhookSendRes = await webhook.send(webhookMessage).catch(() => null);
            return { webhookId: webhook.id, message: webhookSendRes } as NetworkWebhookSendResult;
          }

          // TODO: recheck if everything is good to go
          const guild = message.client.guilds.cache.get(connection.serverId);
          const channel = guild?.channels.cache.get(connection.channelId);

          if (channel?.type === ChannelType.GuildText) {
            channel.send(
              message.client.emotes.normal.loading + 'All Networks must now use webhooks for faster performance and to avoid frequent rate limits. Creating webhook...',
            ).catch(() => null);

            const hook = await channel.createWebhook({
              name: `${message.author.username} Network`,
              avatar: message.client.user.avatarURL(),
              reason: 'All networks must use webhooks now.',
            });

            if (hook.token) {
              await db.connectedList.update({
                where: { id: connection.id },
                data: { webhook: { set: { id: hook.id, token: hook.token, url: hook.url } } },
              });
            }
          }

          const normalOptions = messageFormats.createEmbedOptions(attachment, replyButton, connection,
            { censored: censoredEmbed, normal: embed });
          const sendResult = await channelToSend.send(normalOptions).catch(() => null);
          return { channelId: channelToSend.id, message: sendResult } as NetworkSendResult;
        })();

        messageResults.push(result);
      });

      // disconnect unknown channels & insert message into messageData collection for future use
      const resolvedMessages = await Promise.all(messageResults);
      cleanup.execute(message, resolvedMessages, channelInDb.hubId);
    }
  },
};

