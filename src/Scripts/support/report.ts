import { ActionRowBuilder, EmbedBuilder, TextInputBuilder, ModalBuilder, TextInputStyle, ChatInputCommandInteraction, ChannelType, ForumChannel, TextChannel } from 'discord.js';
import { colors, constants } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export = {
	async execute(interaction: ChatInputCommandInteraction) {
		const modal = new ModalBuilder()
			.setTitle('Report')
			.setCustomId(`modal_${interaction.user.id}`);

		const short = new TextInputBuilder()
			.setRequired(true)
			.setStyle(TextInputStyle.Short)
			.setMaxLength(300)
			.setCustomId('short');

		const para = new TextInputBuilder()
			.setRequired(true)
			.setStyle(TextInputStyle.Paragraph)
			.setMaxLength(1000)
			.setCustomId('para');

		const optionType = interaction.options.getString('type')?.toLowerCase();

		switch (optionType) {
		case 'bug':
			short.setLabel('Title').setPlaceholder('This bug is about...');
			para.setLabel('Description').setPlaceholder('This bug affects... A fix could be...');
			break;

		case 'server':
			short.setLabel('Server Name & ID').setPlaceholder('Ex: Land of ChatBots - 012345678909876543');
			para.setLabel('Please provide more info about the server').setPlaceholder('I am reporting this server because...');
			break;

		case 'user':
			short.setLabel('User ID').setMaxLength(19).setPlaceholder('Ex: 012345678909876543');
			para.setLabel('Reason').setPlaceholder('I am reporting this user because...');
			modal.setCustomId(`user_${interaction.user.id}`);
			break;

		case 'other':
			short.setLabel('Title').setPlaceholder('Ex. New feature request for ChatBot');
			para.setLabel('Please provide us more detail').setPlaceholder('Ask questions, requests, applications etc.');
			break;

		default:
			break;
		}

		const row_para = new ActionRowBuilder<TextInputBuilder>().addComponents(para);
		const row_short = new ActionRowBuilder<TextInputBuilder>().addComponents(short);
		modal.addComponents(row_short, row_para);

		await interaction.showModal(modal);

		let reportChannel: TextChannel | ForumChannel | null;

		if (optionType === 'bug') {
			try {
				reportChannel = await interaction.client.channels.fetch(constants.channel.bugs) as ForumChannel;
			}
			catch (error) {
				logger.error('Error in fetching bugreport channel!', error);
				return interaction.reply({ content: 'An error occurred while fetching the channel!', ephemeral: true });
			}
		}

		else {
			try {
				reportChannel = await interaction.client.channels.fetch(constants.channel.reports) as TextChannel;
			}
			catch (error) {
				logger.error('Error in report command:', error);
				return interaction.reply({ content: 'An error occurred while fetching the channel!', ephemeral: true });
			}
		}

		interaction.awaitModalSubmit({ filter: i => i.user.id === interaction.user.id && i.customId === modal.data.custom_id, time: 60 * 10_000 })
			.then(async (i) => {
				const reportDescription = i.fields.getTextInputValue('para');
				let reportTitle = i.fields.getTextInputValue('short');

				if (i.customId === 'modal_user') {
					if (/^[0-9]*$/gm.test(reportTitle) == false) {
						i.reply({
							content: 'Please only provide a **User ID**. To see how to get user ID\'s please refer [this post](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-). Or you could also directly get it from chatbot messages [image:](https://imgur.com/a/w93gxgu)',
							ephemeral: true,
						});
						return;
					}

					try {
						const user = await interaction.client.users.fetch(reportTitle);
						reportTitle = `${user.username}#${user.discriminator} - ${user.id}`;
					}
					catch {
						return i.reply({ content: 'Invalid User Provided.', ephemeral: true });
					}
				}

				const embed = new EmbedBuilder()
					.setDescription(`Type: **${optionType}**`)
					.setAuthor({
						name: `Reported By: ${i.user?.tag}`,
						iconURL: i.user.avatarURL()?.toString(),
					})
					.setFooter({
						text: `From Server: ${i.guild?.name}`,
						iconURL: i.guild?.iconURL()?.toString(),
					})
					.addFields([
						{ name: 'Title', value: reportTitle },
						{ name: 'Description', value: '```' + reportDescription + '```' },
					])
					.setTimestamp()
					.setColor(colors());

				const bugEmbed = new EmbedBuilder()
					.setTitle(reportTitle)
					.setDescription(reportDescription)
					.setColor(colors('chatbot'))
					.setAuthor({
						name: `${i.user?.tag}`,
						iconURL: i.user.avatarURL()?.toString(),
					})
					.setFooter({
						text: `From: ${i.guild?.name}`,
						iconURL: i.guild?.iconURL()?.toString(),
					});

				if (reportChannel?.type === ChannelType.GuildForum) {
					reportChannel.threads.create({
						name: reportTitle,
						message: { embeds: [bugEmbed] },
					});
				}

				else if (reportChannel?.isTextBased()) {
					await reportChannel?.send({ embeds: [embed] });
				}

				else {
					return i.followUp({ content: 'An error occured when trying to send your report!', ephemeral: true });
				}

				await i.reply('Thank you for your report!');
			})
			.catch((err) => {
				if (err.message.includes('ending with reason: time')) return;
				interaction.followUp({ content: 'An error occured when trying to report!', ephemeral: true });
				logger.error(err);
			});
	},
};