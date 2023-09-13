import checks from '../Scripts/message/checks';
import messageContentModifiers from '../Scripts/message/messageContentModifiers';
import cleanup from '../Scripts/message/cleanup';
import { APIMessage, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message, User, WebhookClient, WebhookMessageCreateOptions } from 'discord.js';
import { getDb, colors } from '../Utils/functions/utils';
import { censor } from '../Utils/functions/wordFilter';
import { messageData } from '@prisma/client';
import { HubSettingsBitField } from '../Utils/hubs/hubSettingsBitfield';

export interface NetworkMessage extends Message {
  censored_content: string,
}

export interface NetworkWebhookSendResult {
  messageOrError: APIMessage | string
  webhookURL: string;
}

export default {
  name: 'messageCreate',
  async execute(message: NetworkMessage) {
    if (message.author.bot || message.webhookId || message.system) return;

    const db = getDb();
    const channelInDb = await db.connectedList.findFirst({
      where: { channelId: message.channel.id, connected: true },
      include: { hub: { include: { connections: { where: { connected: true } } } } },
    });

    if (channelInDb && channelInDb?.hub) {
      const settings = new HubSettingsBitField(channelInDb.hub?.settings);
      if (!await checks.execute(message, channelInDb, settings)) return;

      message.censored_content = censor(message.content);
      const attachment = message.attachments.first();
      const attachmentURL = attachment
        ? `attachment://${attachment.name}`
        : await messageContentModifiers.getAttachmentURL(message);

      let replyInDb: messageData | null;
      let referredAuthor: User | undefined; // author of the message being replied to
      let referredContent: string | undefined; // for compact messages

      if (message.reference) {
        const referredMessage = await message.fetchReference().catch(() => null);
        if (referredMessage?.webhookId) {
          replyInDb = await db.messageData.findFirst({
            where: { channelAndMessageIds: { some: { messageId: referredMessage.id } } },
          });

          referredContent = messageContentModifiers.getReferredContent(referredMessage);
          referredAuthor = replyInDb
            ? await message.client.users.fetch(replyInDb?.authorId).catch(() => undefined)
            : undefined;
        }
      }

      const useNicknames = settings.has('UseNicknames');

      // for nicknames setting
      const displayNameOrUsername = useNicknames
        ? message.member?.displayName || message.author.displayName
        : message.author.username;
      const avatarURL = useNicknames
        ? message.member?.user.displayAvatarURL()
        : message.author.displayAvatarURL();

      const embed = new EmbedBuilder()
        .setDescription(message.content || null) // description must be null if message is only an attachment
        .setImage(attachmentURL)
        .setColor(colors('random'))
        .setFields(
          referredContent
            ? [{ name: 'Reply to:', value: `> ${referredContent.replaceAll('\n', '\n> ')}` }]
            : [],
        )
        .setAuthor({
          name: displayNameOrUsername,
          iconURL: avatarURL,
          url: `https://discord.com/users/${message.author.id}`,
        })
        .setFooter({
          text: `Server: ${message.guild?.name}`,
          iconURL: message.guild?.iconURL() || undefined,
        });
      // define censored embed after reply is added to reflect that in censored embed as well
      const censoredEmbed = EmbedBuilder.from(embed).setDescription(message.censored_content || null);

      // send the message to all connected channels in apropriate format (compact/profanity filter)
      const messageResults = channelInDb.hub?.connections?.map(async (connection) => {
        const reply = replyInDb?.channelAndMessageIds.find((msg) => msg.channelId === connection.channelId);
        const replyLink = reply ? `https://discord.com/channels/${connection.serverId}/${reply.channelId}/${reply.messageId}` : undefined;
        const replyButton = replyLink && referredAuthor
          ? new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setEmoji(message.client.emotes.normal.reply)
              .setURL(replyLink)
              .setLabel(
                (referredAuthor.username.length >= 80
                  ? '@' + referredAuthor.username.slice(0, 76) + '...'
                  : '@' + referredAuthor.username),
              ))
          : null;

        let webhookMessage: WebhookMessageCreateOptions;
        if (connection.compact) {
          const replyEmbed = replyLink && referredContent
            ? new EmbedBuilder()
              .setColor('Random')
              .setDescription(`[**Reply to:**](${replyLink}) ${referredContent.length >= 80 ? referredContent.slice(0, 80) + '...' : referredContent}`)
              .setAuthor({
                name: `${referredAuthor?.username}`,
                iconURL: referredAuthor?.avatarURL() || undefined,
              })
            : undefined;

          webhookMessage = {
            avatarURL: avatarURL,
            username:  displayNameOrUsername,
            files: attachment ? [attachment] : undefined,
            content: connection?.profFilter ? message.censored_content : message.content,
            embeds: replyEmbed ? [replyEmbed] : undefined,
            threadId: connection.parentId ? connection.channelId : undefined,
            allowedMentions: { parse: [] },
          };
        }
        else {
          webhookMessage = {
            components: replyButton ? [replyButton] : undefined,
            embeds: [connection.profFilter ? censoredEmbed : embed],
            files: attachment ? [attachment] : undefined,
            username: `${channelInDb.hub?.name}`,
            avatarURL: channelInDb.hub?.iconUrl,
            threadId: connection.parentId ? connection.channelId : undefined,
            allowedMentions: { parse: [] },
          };
        }

        const webhook = new WebhookClient({ url: connection.webhookURL });
        const webhookSendRes = await webhook.send(webhookMessage).catch((e) => e.message);
        return { webhookURL: webhook.url, messageOrError: webhookSendRes } as NetworkWebhookSendResult;
      });

      message.delete().catch(() => null);
      cleanup(message, await Promise.all(messageResults), channelInDb.hubId);
    }
  },
};

