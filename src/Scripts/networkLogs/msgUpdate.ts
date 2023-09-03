import { stripIndents } from 'common-tags';
import { EmbedBuilder, GuildMember, GuildTextBasedChannel, Message } from 'discord.js';
import { constants, getDb } from '../../Utils/functions/utils';

export async function networkMsgUpdate(member: GuildMember, oldMessage: Message, newMessageContent: string) {
  const db = getDb();
  const messageInDb = await db?.messageData.findFirst({
    where: { channelAndMessageIds: { some: { messageId: { equals: oldMessage.id } } } },
  });

  const cbhqJumpMsg = messageInDb?.channelAndMessageIds.find((x) => x.channelId === '821607665687330816');
  const logChannel = await member.client.channels.fetch(constants.channel.networklogs) as GuildTextBasedChannel;
  const attachmentLink = oldMessage.attachments.first()?.url || oldMessage.embeds.at(0)?.image?.url || null;

  const emoji = member.client.emotes;

  const embed = new EmbedBuilder()
    .setAuthor({ name: member.user.username, iconURL: member.user.avatarURL()?.toString() })
    .setTitle('Message Edited')
    .setDescription(stripIndents`
            ${emoji.normal.dotYellow} **User:** ${member.user.username} (${member.id})
            ${emoji.normal.dotYellow} **Server:** ${member.guild.name} (${member.guild.id})
            ${emoji.normal.dotYellow} **Attachments:** ${attachmentLink ? `[Click to view](${attachmentLink})` : 'None.'}
            ${emoji.normal.dotYellow} **Created At:** <t:${Math.round(new Date().getTime() / 1000)}:R>
            [Jump To Message](https://discord.com/channels/${constants.guilds.cbhq}/${cbhqJumpMsg?.channelId}/${cbhqJumpMsg?.messageId})`)
    .addFields(
      { name: 'Before', value: oldMessage.content || oldMessage.embeds[0]?.description || 'None.' },
      { name: 'After', value: newMessageContent },
    )
    .setTimestamp()
    .setImage(attachmentLink)
    .setColor('Gold');

  logChannel.send({ embeds: [embed] });
}
