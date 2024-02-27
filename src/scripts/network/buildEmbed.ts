import { Interaction, EmbedBuilder } from 'discord.js';
import { emojis, colors } from '../../utils/Constants.js';
import { yesOrNoEmoji } from '../../utils/Utils.js';
import db from '../../utils/Db.js';
import { t } from '../../utils/Locale.js';

export async function buildEmbed(interaction: Interaction, channelId: string) {
	const networkData = await db.connectedList.findFirst({
		where: { channelId },
		include: { hub: true },
	});

	const { yes, no, enabled, disabled } = emojis;
	const invite = networkData?.invite
		? `[\`${networkData.invite.replace('https://discord.gg/', '')}\`](${networkData.invite})`
		: 'Not Set.';
	const locale = interaction.user.locale;

	return new EmbedBuilder()
		.setTitle(t({ phrase: 'connection.embed.title', locale }))
		.setDescription(t({ phrase: 'connection.embed.description', locale }))
		.addFields([
			{
				name: t({ phrase: 'connection.embed.fields.hub', locale }),
				value: `${networkData?.hub?.name}`,
				inline: true,
			},
			{
				name: t({ phrase: 'connection.embed.fields.channel', locale }),
				value: `<#${channelId}>`,
				inline: true,
			},
			{
				name: t({ phrase: 'connection.embed.fields.invite', locale }),
				value: invite,
				inline: true,
			},
			{
				name: t({ phrase: 'connection.embed.fields.connected', locale }),
				value: yesOrNoEmoji(networkData?.connected, yes, no),
				inline: true,
			},
			{
				name: t({ phrase: 'connection.embed.fields.compact', locale }),
				value: yesOrNoEmoji(networkData?.compact, enabled, disabled),
				inline: true,
			},
			{
				name: t({ phrase: 'connection.embed.fields.profanity', locale }),
				value: yesOrNoEmoji(networkData?.profFilter, enabled, disabled),
				inline: true,
			},
			{
				name: t({ phrase: 'connection.embed.fields.emColor', locale }),
				value: networkData?.embedColor ? `\`${networkData?.embedColor}\`` : no,
				inline: true,
			},
		])
		.setColor(colors.interchatBlue)
		.setThumbnail(interaction.guild?.iconURL() || interaction.client.user.avatarURL())
		.setFooter({ text: t({ phrase: 'connection.embed.footer', locale }) });
}
