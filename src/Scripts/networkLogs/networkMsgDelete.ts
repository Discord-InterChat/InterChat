import { stripIndents } from 'common-tags';
import { EmbedBuilder, GuildMember, GuildTextBasedChannel, Message } from 'discord.js';
import { getDb, constants } from '../../Utils/functions/utils';


export async function networkMessageDelete(deletedBy: GuildMember | null, message: Message) {
	const db = getDb();
	const messageInDb = await db?.messageData.findFirst({
		where: { channelAndMessageIds: { some: { messageId: { equals: message.id } } } },
	});

	if (!messageInDb) return;

	const author = await message.client.users.fetch(messageInDb.authorId).catch(() => null);
	const logChannel = await message.client.channels.fetch(constants.channel.networklogs) as GuildTextBasedChannel; // constants.channel.messageLogs
	const messageContent = message.embeds[0]?.fields[0]?.value || message.content || 'No Content';
	const emojis = message.client.emoji.normal;
	const attachmentLink = message.attachments.first()?.url || message.embeds.at(0)?.image?.url || null;


	const embed = new EmbedBuilder()
		.setAuthor({ name: String(author?.tag), iconURL: author?.avatarURL()?.toString() })
		.setTitle('Message Deleted')
		.setDescription(stripIndents`
            ${messageContent}

            ${emojis.dotRed} **Author:** ${author?.tag} (${author?.id})
            ${emojis.dotRed} **Deleted From:** ${message?.guild?.name} (${message?.guild?.id})
			${emojis.dotRed} **Attachments:** ${attachmentLink ? `[Click to view](${attachmentLink})` : 'None.'}
            ${emojis.dotRed} **Created At:** <t:${Math.round(message.createdAt.getTime() / 1000)}:R>`)
		.setFooter({ text: `Deleted By: ${deletedBy?.user.tag}`, iconURL: deletedBy?.user.avatarURL() || deletedBy?.user.defaultAvatarURL })
		.setImage(attachmentLink)
		.setTimestamp()
		.setColor('Red');

	logChannel.send({ embeds: [embed] });
}