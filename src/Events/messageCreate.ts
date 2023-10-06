import {
  APIMessage,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  HexColorString,
  Message,
  User,
  WebhookClient,
  WebhookMessageCreateOptions,
} from 'discord.js';
import { getDb } from '../Utils/utils';
import { censor } from '../Utils/wordFilter';
import { messageData } from '@prisma/client';
import { HubSettingsBitField } from '../Utils/hubSettingsBitfield';
import checks from '../Scripts/message/checks';
import cleanup from '../Scripts/message/cleanup';
import messageContentModifiers from '../Scripts/message/messageContentModifiers';
import emojis from '../Utils/JSON/emoji.json';


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
    const connection = await db.connectedList.findFirst({
      where: { channelId: message.channel.id, connected: true },
      include: { hub: { include: { connections: { where: { connected: true } } } } },
    });

    if (connection?.hub) {
      const settings = new HubSettingsBitField(connection.hub?.settings);
      if (!await checks.execute(message, connection, settings)) return;

      message.censored_content = censor(message.content);
      const attachment = message.attachments.first();
      const attachmentURL = attachment
        ? `attachment://${attachment.name}`
        : await messageContentModifiers.getAttachmentURL(message);

      let replyInDb: messageData | null;
      let referredAuthor: User | undefined; // author of the message being replied to
      let referred: { author?: User, censored: string, content: string } | undefined; // for compact messages

      if (message.reference) {
        const referredMessage = await message.fetchReference().catch(() => null);
        if (referredMessage?.webhookId) {
          replyInDb = await db.messageData.findFirst({
            where: { channelAndMessageIds: { some: { messageId: referredMessage.id } } },
          });

          const content = messageContentModifiers.getReferredContent(referredMessage);
          referred = {
            censored: censor(content),
            content: content,
            author: replyInDb
              ? await message.client.users.fetch(replyInDb?.authorId).catch(() => undefined)
              : undefined,
          };

        }
      }

      const useNicknameSetting = settings.has('UseNicknames');

      // for nicknames setting
      const displayNameOrUsername = useNicknameSetting
        ? message.member?.displayName || message.author.displayName
        : message.author.username;
      const avatarURL = useNicknameSetting
        ? message.member?.user.displayAvatarURL()
        : message.author.displayAvatarURL();

      const embed = new EmbedBuilder()
        .setDescription(message.content || null) // description must be null if message is only an attachment
        .setImage(attachmentURL)
        .setColor((connection.embedColor as HexColorString) || 'Random')
        .setFields(
          referred
            ? [{ name: 'Reply to:', value: `> ${referred.content.replaceAll('\n', '\n> ')}` }]
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

      // profanity censored embed
      const censoredEmbed = EmbedBuilder.from(embed)
        .setDescription(message.censored_content || null)
        .setFields(
          referred
            ? [{ name: 'Reply to:', value: `> ${referred.censored.replaceAll('\n', '\n> ')}` }]
            : [],
        );

      // send the message to all connected channels in apropriate format (compact/profanity filter)
      const messageResults = connection.hub?.connections?.map(async (connected) => {
        const reply = replyInDb?.channelAndMessageIds.find((msg) => msg.channelId === connected.channelId);
        const replyLink = reply ? `https://discord.com/channels/${connected.serverId}/${reply.channelId}/${reply.messageId}` : undefined;
        const replyButton = replyLink && referredAuthor
          ? new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setEmoji(emojis.normal.reply)
              .setURL(replyLink)
              .setLabel(
                (referredAuthor.username.length >= 80
                  ? '@' + referredAuthor.username.slice(0, 76) + '...'
                  : '@' + referredAuthor.username),
              ))
          : null;

        let webhookMessage: WebhookMessageCreateOptions;

        if (connected.compact) {
          const referredContent = connected.profFilter ? referred?.censored : referred?.content;
          const replyEmbed = replyLink && referredContent
            ? new EmbedBuilder()
              .setColor('Random')
              .setDescription(`[**Reply to:**](${replyLink}) ${referredContent.length >= 80 ? referredContent.slice(0, 80) + '...' : referred}`)
              .setAuthor({
                name: `${referredAuthor?.username}`,
                iconURL: referredAuthor?.avatarURL() || undefined,
              })
            : undefined;

          webhookMessage = {
            avatarURL: avatarURL,
            username:  displayNameOrUsername,
            files: attachment ? [attachment] : undefined,
            content: connected?.profFilter ? message.censored_content : message.content,
            embeds: replyEmbed ? [replyEmbed] : undefined,
            threadId: connected.parentId ? connected.channelId : undefined,
            allowedMentions: { parse: [] },
          };
        }
        else {
          webhookMessage = {
            components: replyButton ? [replyButton] : undefined,
            embeds: [connected.profFilter ? censoredEmbed : embed],
            files: attachment ? [attachment] : undefined,
            username: `${connection.hub?.name}`,
            avatarURL: connection.hub?.iconUrl,
            threadId: connected.parentId ? connected.channelId : undefined,
            allowedMentions: { parse: [] },
          };
        }

        const webhook = new WebhookClient({ url: connected.webhookURL });
        const webhookSendRes = await webhook.send(webhookMessage).catch((e) => e.message);
        return { webhookURL: webhook.url, messageOrError: webhookSendRes } as NetworkWebhookSendResult;
      });

      message.delete().catch(() => null);
      cleanup.execute(message, await Promise.all(messageResults), connection.hubId);
    }
  },
};

