import checks from '../Scripts/message/checks';
import addBadges from '../Scripts/message/addBadges';
import messageTypes from '../Scripts/message/messageTypes';
import messageContentModifiers from '../Scripts/message/messageContentModifiers';
import { APIMessage, EmbedBuilder, Message } from 'discord.js';
import { getDb, colors } from '../Utils/functions/utils';
import cleanup, { InvalidChannelId } from '../Scripts/message/cleanup';
import { censor } from '../Utils/functions/wordFilter';

export interface NetworkMessage extends Message {
  compact_message: string,
  censored_compact_message: string,
  censored_content: string,
}

export default {
  name: 'messageCreate',
  async execute(message: NetworkMessage) {
    if (message.author.bot || message.webhookId || message.system) return;

    const db = getDb();
    const allConnectedChannels = await db.connectedList.findMany();
    const connected = allConnectedChannels.find((c) => c.channelId === message.channelId);

    // ignore the message if it is not in an active network channel
    if (!connected || !await checks.execute(message, db)) return;

    message.compact_message = `**${message.author.tag}:** ${message.content}`;
    const embed = new EmbedBuilder()
      .setTimestamp()
      .setColor(colors('random'))
      .addFields([{ name: 'Message', value: message.content || '\u200B' }])
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.avatarURL() || message.author.defaultAvatarURL,
        url: `https://discord.com/users/${message.author.id}`,
      })
      .setFooter({
        text: `From: ${message.guild}`,
        iconURL: message.guild?.iconURL()?.toString(),
      });


    // Add quoted reply to original message and embed
    const replyInDb = await messageContentModifiers.appendReply(message, embed);

    // Once reply is appended to the message, run it through the word fillter
    message.censored_content = censor(message.content);
    message.censored_compact_message = censor(message.compact_message);
    const censoredEmbed = new EmbedBuilder(embed.data).setFields({ name: 'Message', value: message.censored_content || '\u200B' });

    const attachments = await messageContentModifiers.attachImageToEmbed(message, embed, censoredEmbed);
    await addBadges.execute(message, db, embed, censoredEmbed);

    const channelAndMessageIds: Promise<InvalidChannelId | APIMessage | Message<true> | undefined>[] = [];

    // send the message to all connected channels in apropriate format (webhook/compact/normal)
    allConnectedChannels?.forEach((channel) => {
      const messageSendResult = messageTypes.execute(message, channel, embed, censoredEmbed, attachments, replyInDb);
      channelAndMessageIds.push(messageSendResult);
    });

    // delete unknown channels & insert message into messageData collection for future use
    cleanup.execute(message, channelAndMessageIds);
  },
};
