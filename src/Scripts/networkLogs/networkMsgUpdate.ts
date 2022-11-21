import { stripIndents } from 'common-tags';
import { EmbedBuilder, GuildMember, GuildTextBasedChannel, Message } from 'discord.js';
import { constants, getDb } from '../../Utils/functions/utils';

interface messageOptions {
    id: string;
    content: string;
    timestamp: Date;
}

export async function networkMsgUpdate(member: GuildMember, oldMessage: Message, newMessage: messageOptions) {
	const db = getDb();
	const messageInDb = await db?.messageData.findFirst({
		where: { channelAndMessageIds: { some: { messageId: { equals: oldMessage.id } } } },
	});

	const cbhqJumpMsg = messageInDb?.channelAndMessageIds.find((x) => x.channelId === '821607665687330816');
	const logChannel = await member.client.channels.fetch(constants.channel.networklogs) as GuildTextBasedChannel;
	const attachmentLink = oldMessage.attachments.first()?.url || oldMessage.embeds.at(0)?.image?.url || null;

	let messageContent = oldMessage.embeds[0]?.fields[0]?.value || oldMessage.content.replace(`**${member.user.tag}:**`, '');
	messageContent = messageContent.replace(/> .*/g, '').trim();

	const emoji = member.client.emoji;

	const embed = new EmbedBuilder()
		.setAuthor({ name: member.user.tag, iconURL: member.user.avatarURL()?.toString() })
		.setTitle('Message Edited')
		.setDescription(stripIndents`
            ${emoji.normal.dotYellow} **User:** ${member.user.tag} (${member.id})
            ${emoji.normal.dotYellow} **Server:** ${member.guild.name} (${member.guild.id})
            ${emoji.normal.dotYellow} **Attachments:** ${attachmentLink ? `[Click to view](${attachmentLink})` : 'None.'}
            ${emoji.normal.dotYellow} **Created At:** <t:${Math.round(newMessage.timestamp.getTime() / 1000)}:R>
            [Jump To Message](https://discord.com/channels/${constants.mainGuilds.cbhq}/${cbhqJumpMsg?.channelId}/${cbhqJumpMsg?.messageId})`)
		.addFields(
			{ 'name': 'Old', 'value': messageContent },
			{ 'name': 'New', 'value': newMessage.content },
		)
		.setTimestamp()
		.setImage(attachmentLink)
		.setColor('Gold');

	logChannel.send({ embeds: [embed] });
}
