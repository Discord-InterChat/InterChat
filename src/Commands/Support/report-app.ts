import { stripIndents } from 'common-tags';
import { getDb, constants, colors } from '../../Utils/functions/utils';
import {
	ModalBuilder,
	ActionRowBuilder,
	EmbedBuilder,
	ContextMenuCommandBuilder,
	ApplicationCommandType,
	TextInputStyle,
	TextInputBuilder,
	MessageContextMenuCommandInteraction,
	GuildTextBasedChannel,
} from 'discord.js';
import logger from '../../Utils/logger';

export default {
	description: 'Report a user directly from the Chat Network!',
	data: new ContextMenuCommandBuilder().setName('Report').setType(ApplicationCommandType.Message),
	async execute(interaction: MessageContextMenuCommandInteraction) {
		// The message the interaction is being performed on
		const target = interaction.targetMessage;

		const messageData = getDb().messageData;
		const messageInDb = await messageData?.findFirst({ where: { channelAndMessageIds: { some: { messageId: { equals: target.id } } } } });

		// check if args.channel is in connectedList DB
		if (!messageInDb) {
			return await interaction.reply({
				content: 'This command only works on messages sent in the network. Please use `/support report` to report individual users/servers instead.',
				ephemeral: true,
			});
		}

		if (messageInDb.authorId === interaction.user.id) {
			return interaction.reply({ content: 'You cannot report yourself!', ephemeral: true });
		}

		const cbhq = await interaction.client.guilds.fetch(constants.mainGuilds.cbhq);
		const reportsChannel = await cbhq.channels.fetch(constants.channel.reports) as GuildTextBasedChannel;

		const reportedUser = await interaction.client.users.fetch(messageInDb.authorId);
		const reportedServer = await interaction.client.guilds.fetch(messageInDb.serverId);

		// network channelId in chatbot hq
		const cbhqJumpMsg = messageInDb.channelAndMessageIds.find((x) => x.channelId === '821607665687330816');

		const modal = new ModalBuilder()
			.setCustomId('modal')
			.setTitle('Report')
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>().addComponents(
					new TextInputBuilder()
						.setRequired(true)
						.setCustomId('reason')
						.setStyle(TextInputStyle.Paragraph)
						.setLabel('Enter the reaon for your report')
						.setMaxLength(2000),
				),
			);

		await interaction.showModal(modal);

		// respond to message when Modal is submitted
		interaction.awaitModalSubmit({
			time: 60_000 * 5,
			filter: (i) => i.customId === 'modal' && i.user.id === interaction.user.id,
		}).then(async (i) => {
			const reason = i.fields.getTextInputValue('reason');

			// create embed with report info
			// and send it to report channel
			const embed = new EmbedBuilder()
				.setAuthor({
					name: `${reportedUser.tag} was reported!`,
					iconURL: reportedUser.avatarURL() || reportedUser.defaultAvatarURL,
				})
				.setDescription(`**Reason**: ${reason}`)
				.addFields({
					name: 'Reported User',
					value: stripIndents`
						**Tag**: ${reportedUser.tag}
						**From**: ${reportedServer.name} (${reportedServer.id})
						**Message**: [Jump to Message](https://discord.com/channels/${cbhq.id}/${cbhqJumpMsg?.channelId}/${cbhqJumpMsg?.messageId})
						**Raw**: \`\`\`${target.embeds[0]?.fields[0]?.value || target.content}\`\`\`
						`,
				})
				.setFooter({
					text: `Reported by: ${interaction.user.tag} | ${interaction.user.id}`,
					iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL,
				})
				.setColor(colors('chatbot'))
				.setTimestamp();

			await reportsChannel?.send({ embeds: [embed] });

			// reply to interaction
			await i.reply({ content: 'Thank you for your report!', ephemeral: true });
		}).catch((err) => {
			if (err.message.includes('ending with reason: time')) return;
			logger.error('Error in report-app:', err);
		});
	},
};
