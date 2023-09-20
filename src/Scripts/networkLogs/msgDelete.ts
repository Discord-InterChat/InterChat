import { stripIndents } from 'common-tags';
import { EmbedBuilder, GuildMember, GuildTextBasedChannel, Message } from 'discord.js';
import { getDb, constants } from '../../Utils/misc/utils';


export async function networkMessageDelete(deletedBy: GuildMember | null, message: Message) {
  const db = getDb();
  const emojis = message.client.emotes.normal;
  const messageInDb = await db?.messageData.findFirst({
    where: { channelAndMessageIds: { some: { messageId: { equals: message.id } } } },
  });

  if (!messageInDb) return;

  const messageContent = message.content || message.embeds[0]?.description || 'No Content';
  const attachmentLink = message.attachments.first()?.url || message.embeds.at(0)?.image?.url || null;

  const author = await message.client.users.fetch(messageInDb.authorId).catch(() => null);
  const deletedFrom = await message.client.guilds.fetch(messageInDb.serverId).catch(() => null);


  const logChannel = await message.client.channels.fetch(constants.channel.networklogs) as GuildTextBasedChannel;
  const embed = new EmbedBuilder()
    .setAuthor({ name: String(author?.username), iconURL: author?.avatarURL()?.toString() })
    .setTitle('Message Deleted')
    .setDescription(stripIndents`
        ${messageContent}

        ${emojis.dotRed} **Author:** ${author?.username} (${author?.id})
        ${emojis.dotRed} **Deleted From:** ${deletedFrom?.name || 'Unknown'} (${messageInDb.serverId})
        ${emojis.dotRed} **Attachments:** ${attachmentLink ? `[Click to view](${attachmentLink})` : 'None.'}
        ${emojis.dotRed} **Created At:** <t:${Math.round(message.createdAt.getTime() / 1000)}:R>`)
    .setFooter({
      text: `Deleted By: @${deletedBy?.user.username}`,
      iconURL: deletedBy?.user.avatarURL() || deletedBy?.user.defaultAvatarURL,
    })
    .setImage(attachmentLink)
    .setTimestamp()
    .setColor('Red');

  logChannel.send({ embeds: [embed] });
}
