import { ActionRowBuilder, EmbedBuilder, TextInputBuilder, ModalBuilder, TextInputStyle, ChatInputCommandInteraction, ForumChannel, TextChannel } from 'discord.js';
import { colors, constants } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export = {
	async execute(interaction: ChatInputCommandInteraction) {
		const reportType = interaction.options.getString('type', true) as 'user' | 'server' | 'bug' | 'other';

		const reportSubmit = new ModalBuilder()
			.setTitle('New Report')
			.setCustomId(interaction.id)
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('reportTitle')
						.setLabel(reportType === 'user' ? 'User ID' : reportType === 'server' ? 'Server ID' : 'Report Title')
						.setPlaceholder('The reason for this report.')
						.setMinLength(17)
						.setMaxLength(reportType === 'user' || reportType === 'server' ? 20 : 150)
						.setStyle(TextInputStyle.Short)
						.setRequired(true),
				),
				new ActionRowBuilder<TextInputBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('reportDescription')
						.setLabel('Report Description')
						.setPlaceholder('A more clear description of the report.')
						.setMinLength(10)
						.setMaxLength(950)
						.setStyle(TextInputStyle.Paragraph)
						.setRequired(true),
				),
			);

		const reportChannel = await interaction.client.channels.fetch(constants.channel.reports).catch(() => null) as TextChannel | null;
		const bugReportChannel = await interaction.client.channels.fetch(constants.channel.bugs).catch(() => null) as ForumChannel | null;

		await interaction.showModal(reportSubmit);

		interaction.awaitModalSubmit({ time: 60000 * 5, filter: (i) => i.user.id === interaction.user.id && i.customId === reportSubmit.data.custom_id })
			.then(async modalInteraction => {
				const reportTitle = modalInteraction.fields.getTextInputValue('reportTitle');
				const reportDescription = modalInteraction.fields.getTextInputValue('reportDescription');

				switch (reportType) {
					case 'bug': {
						if (!bugReportChannel) {
							logger.error('Bug report channel not found.');
							return interaction.followUp({ content: 'Bug report channel not found.', ephemeral: true });
						}

						const bugReport = new EmbedBuilder()
							.setColor(colors('invisible'))
							.setTitle('New Bug Report')
							.setFields(
								{
									name: 'Summary',
									value: reportTitle,
								},
								{
									name: 'Description',
									value: reportDescription,
								},
							)
							.setThumbnail(interaction.user.avatarURL({ size: 2048 }) ?? interaction.user.defaultAvatarURL)
							.setFooter({ text: `Reported by ${interaction.user.tag} (${interaction.user.id})`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL });

						await bugReportChannel.threads.create({
							name: reportTitle, message: { embeds: [bugReport] },
						});
						break;
					}
					case 'user': {
						const reportedUser = await interaction.client.users.fetch(reportTitle).catch(() => null);
						if (!reportedUser) {
							return modalInteraction.reply({
								content: 'Invalid user ID. To find a user\'s ID in ChatBot, right click on a message (that was sent in the network) that you wish to report and click `Apps > User ID`. Or you can get it from the [embed author](https://i.imgur.com/AbTTlry.gif).',
								ephemeral: true,
							});
						}

						const userReport = new EmbedBuilder()
							.setColor('Red')
							.setTitle('New User Report')
							.setFields(
								{
									name: 'Reported User',
									value: `${reportedUser.tag} (${reportedUser.id})`,
								},
								{
									name: 'Description',
									value: reportDescription,
								},
							)
							.setThumbnail(reportedUser.avatarURL({ size: 2048 }) ?? reportedUser.defaultAvatarURL)
							.setFooter({ text: `Reported by ${interaction.user.tag} (${interaction.user.id})`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL });
						await reportChannel?.send({ embeds: [userReport] });
						break;
					}

					case 'server': {
						const reportedServer = await interaction.client.guilds.fetch(reportTitle).catch(() => null);
						if (!reportedServer) return modalInteraction.reply({ content: 'Invalid server ID.', ephemeral: true });

						const serverReport = new EmbedBuilder()
							.setColor('Red')
							.setTitle('New Report')
							.setFields(
								{
									name: 'Server ID',
									value: `${reportedServer.name} (${reportedServer.id})`,
								},
								{
									name: 'Description',
									value: reportDescription,
								},
							)
							.setThumbnail(reportedServer.iconURL({ size: 2048 }))
							.setFooter({ text: `Reported by ${interaction.user.tag} (${interaction.user.id})`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL });
						await reportChannel?.send({ embeds: [serverReport] });
					}
						break;
					default: {
						const otherReport = new EmbedBuilder()
							.setColor(colors('random'))
							.setTitle('New Report')
							.setDescription('**Type:** Other')
							.setFields(
								{
									name: 'Report Title',
									value: reportTitle,
								},
								{
									name: 'Description',
									value: reportDescription,
								},
							)
							.setThumbnail(interaction.user.avatarURL({ size: 2048 }) ?? interaction.user.defaultAvatarURL)
							.setFooter({ text: `Reported by ${interaction.user.tag} (${interaction.user.id})`, iconURL: interaction.user.avatarURL() || interaction.user.defaultAvatarURL });
						await reportChannel?.send({ embeds: [otherReport] });
						break;
					}
				}
				await modalInteraction.reply({ content: 'Report submitted. Join the support server to get updates on your report.', ephemeral: true });
			}).catch((error) => {if (!error.message.includes('ending with reason: time')) logger.error(error);});

	},
};