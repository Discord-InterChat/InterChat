const { ActionRowBuilder, EmbedBuilder, ButtonBuilder, TextInputBuilder, ModalBuilder, ButtonStyle, TextInputStyle } = require('discord.js');
const logger = require('../../utils/logger');
const { colors } = require('../../utils/functions/utils');
const channelIds = require('../../utils/discordIds.json');

module.exports = {
	async execute(interaction) {
		const modal = new ModalBuilder().setTitle('Report');

		const short = new TextInputBuilder().setRequired(true).setStyle(TextInputStyle.Short).setMaxLength(300).setCustomId('short');
		const para = new TextInputBuilder().setRequired(true).setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setCustomId('para');


		const optionType = await interaction.options.getString('type').toLowerCase();

		switch (optionType) {
		case 'bug':
			para.setLabel('What is the bug about').setPlaceholder('This bug affects... A fix could be...');
			short.setLabel('Describe the bug').setPlaceholder('This bug is about...');

			modal.setCustomId('modal_bug');
			break;

		case 'server':
			para.setLabel('Please provide more info about the server').setPlaceholder('I am reporting this server because...');
			short.setLabel('Server Name & ID').setPlaceholder('Ex: Land of ChatBots - 012345678909876543');

			modal.setCustomId('modal_server');
			break;

		case 'user':
			para.setLabel('Please provide more info about the user').setPlaceholder('I am reporting this user because...');
			short.setLabel('User ID').setMaxLength(19).setPlaceholder('Ex: 012345678909876543');

			modal.setCustomId('modal_user');
			break;

		case 'other':
			para.setLabel('Please provide us more details').setPlaceholder('Ask questions, requests, applications etc.');
			short.setLabel('Title').setPlaceholder('Ex. New feature request for ChatBot');

			modal.setCustomId('modal_other');
			break;

		default:
			break;
		}


		const row_para = new ActionRowBuilder().addComponents(para);
		const row_short = new ActionRowBuilder().addComponents(short);
		modal.addComponents(row_short, row_para);

		await interaction.showModal(modal);

		// to-text button
		const textBtn = new ActionRowBuilder().addComponents([
			new ButtonBuilder().setCustomId('text').setLabel('text').setStyle(ButtonStyle.Secondary),
		]);

		// global modal collector
		const filter = (i) => i.user.id === interaction.user.id;
		interaction.awaitModalSubmit({ filter, time: 60000 })
			.then(async i => {
				const componentPara = i.fields.getTextInputValue('para');
				let componentShort = i.fields.getTextInputValue('short');

				if (i.customId === 'modal_user') {
					if (/^[0-9]*$/gm.test(componentShort) == false) {
						return i.reply({
							content: 'Please only provide a **User ID**. To see how to get user ID\'s please refer [this post](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-). Or you could also directly get it from chatbot messages [image:](https://imgur.com/a/w93gxgu)',
							ephemeral: true,
						});
					}

					try {
						const user = await interaction.client.users.fetch(componentShort);
						componentShort = `${user.username}#${user.discriminator} - ${user.id}`;
					}
					catch {
						i.reply({ content: 'Invalid User Provided.', ephemeral: true });
						return;
					}
				}
				const embed = new EmbedBuilder()
					.setDescription(`Type: **${i.customId.replace('modal_', '')}**`)
					.setAuthor({
						name: `Reported By: ${interaction.member.user.tag}`,
						iconURL: interaction.member.user.avatarURL({ dynamic: true }),
					})
					.setFooter({
						text: `From Server: ${interaction.guild.name}`,
						iconURL: interaction.guild.iconURL({ dynamic: true }),
					})
					.addFields([
						{ name: 'Title', value: componentShort },
						{ name: 'Description', value: '```' + componentPara + '```' },
					])
					.setTimestamp()
					.setColor(colors());

				const reportChannel = await interaction.client.channels.fetch(channelIds.channel.reports); // REVIEW Import from config

				await i.reply('Thank you for your report!');

				// send to chatbot reports channel '<@&800698916995203104>'
				const report = await reportChannel.send({ embeds: [embed], components: [textBtn] });

				const collector = report.createMessageComponentCollector({ time: 50_400_000, componentType: 'BUTTON' });

				collector.on('collect', async r => {
					const reportEmbed = report.embeds[0];
					const content = `**${reportEmbed.author.name}**\n${reportEmbed.description}\n\n**${reportEmbed.fields[0].name}**: ${reportEmbed.fields[0].value}\n**${reportEmbed.fields[1].name}:** ${reportEmbed.fields[1].value}`;
					await r.reply({ content, ephemeral: true });
				});

				/*
				  NOTE: Modals are sort of bugged out rn so I'm using .reply() to reply to the interaction.
				 .reply() will prevent multiple instances of the modals to run when one is cancelled and error out with DiscordAPIError: Interaction has already been acknowledged,
				 it should send one message to the report channel with somewhat accurate information
				 ...probably
				*/
			})
			.catch(() => {
				return logger.info('Someone cancelled the modal.');
			});
	},
};