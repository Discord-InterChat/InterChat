import {
	ActionRowBuilder,
	ApplicationCommandType,
	ButtonBuilder,
	ButtonStyle,
	ContextMenuCommandBuilder,
	EmbedBuilder,
	MessageContextMenuCommandInteraction,
} from 'discord.js';
import { colors, getDb } from '../../Utils/functions/utils';
import { stripIndent } from 'common-tags';

export default {
	data: new ContextMenuCommandBuilder()
		.setName('Server Info')
		.setType(ApplicationCommandType.Message),
	async execute(interaction: MessageContextMenuCommandInteraction) {
		const target = interaction.targetId;

		const db = getDb();
		const messageInDb = await db.messageData.findFirst({
			where: { channelAndMessageIds: { some: { messageId: target } } },
		});

		if (!messageInDb) return interaction.reply('This message has expired! Please try another message.');
		const server = await interaction.client.guilds.fetch(messageInDb.serverId).catch(() => null);
		if (!server) return interaction.reply('Unable to find server!');

		const owner = await server.fetchOwner();
		const createdAt = Math.round(server.createdTimestamp / 1000);
		const guildSetup = await db.setup.findFirst({ where: { guildId: messageInDb.serverId } });

		const embed = new EmbedBuilder()
			.setTitle(server?.name.substring(0, 256))
			.setColor(colors('invisible'))
			.setThumbnail(server.iconURL())
			.setImage(server.bannerURL())
			.setDescription(stripIndent`
            ${server.description || 'No Description.'}

            **Owner:** ${owner.user.tag}
            **Created:** <t:${createdAt}:d> (<t:${createdAt}:R>)
            **Members:** ${server.memberCount}
			**Invite Code:** ${guildSetup?.invite ? `[\`${guildSetup.invite}\`](https://discord.gg/${guildSetup.invite})` : 'Not Set.'}`)
			.setFooter({ text: `ID: ${server.id}` });

		let buttons;
		if (guildSetup?.invite) {
			buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
				.setStyle(ButtonStyle.Link)
				.setURL(`https://discord.gg/${guildSetup?.invite}`)
				.setEmoji(interaction.client.emoji.icons.join)
				.setLabel('Join'));
		}
		await interaction.reply({
			embeds: [embed],
			components: buttons ? [buttons] : undefined,
			ephemeral: true,
		});
	},
};
