import { ActionRowBuilder, EmbedBuilder, TextInputBuilder, ModalBuilder, TextInputStyle, ChatInputCommandInteraction } from 'discord.js';
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
			short.setLabel('Describe the bug').setPlaceholder('This bug is about...');
			para.setLabel('What is the bug about').setPlaceholder('This bug affects... A fix could be...');
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

		interaction.awaitModalSubmit({ filter: i => i.user.id === interaction.user.id && i.customId === modal.data.custom_id, time: 60000 })
			.then(async (i) => {
				const componentPara = i.fields.getTextInputValue('para');
				let componentShort = i.fields.getTextInputValue('short');

				if (i.customId === 'modal_user') {
					if (/^[0-9]*$/gm.test(componentShort) == false) {
						i.reply({
							content: 'Please only provide a **User ID**. To see how to get user ID\'s please refer [this post](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-). Or you could also directly get it from chatbot messages [image:](https://imgur.com/a/w93gxgu)',
							ephemeral: true,
						});
						return;
					}

					interaction.client.users.fetch(componentShort)
						.then(user => componentShort = `${user.username}#${user.discriminator} - ${user.id}`)
						.catch(() => {return i.reply({ content: 'Invalid User Provided.', ephemeral: true });});
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
						{ name: 'Title', value: componentShort },
						{ name: 'Description', value: '```' + componentPara + '```' },
					])
					.setTimestamp()
					.setColor(colors());

				const reportChannel = await interaction.client.channels.fetch(constants.channel.reports);

				await i.reply('Thank you for your report!');

				if (reportChannel?.isTextBased()) await reportChannel?.send({ embeds: [embed] });
				else return i.followUp({ content: 'An error occured when trying to report!', ephemeral: true });
			})
			.catch((err) => {
				if (err.message.includes('ending with reason: time')) return;
				logger.error(err);
			});
	},
};