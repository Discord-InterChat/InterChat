const { ActionRowBuilder,
	EmbedBuilder,
	ButtonBuilder,
	TextInputBuilder,
	ModalBuilder,
	ButtonStyle,
	TextInputStyle,
	ComponentType,
} = require('discord.js');

const { colors } = require('../../utils/functions/utils');
const channelIds = require('../../utils/discordIds.json');

module.exports = {
	async execute(interaction) {
		const modal = new ModalBuilder()
			.setTitle('Report')
			// randomize the modal id to prevent conflicts with discord's ass of a modal handling system
			.setCustomId(Math.random().toString(36).slice(2, 7));

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

		const optionType = await interaction.options.getString('type').toLowerCase();

		switch (optionType) {
		case 'bug':
			short.setLabel('Describe the bug').setPlaceholder('This bug is about...');
			para.setLabel('What is the bug about').setPlaceholder(
				'This bug affects... A fix could be...',
			);
			break;

		case 'server':
			short.setLabel('Server Name & ID').setPlaceholder('Ex: Land of ChatBots - 012345678909876543');
			para.setLabel('Please provide more info about the server').setPlaceholder(
				'I am reporting this server because...',
			);
			break;

		case 'user':
			short.setLabel('User ID').setMaxLength(19).setPlaceholder('Ex: 012345678909876543');
			para.setLabel('Reason').setPlaceholder(
				'I am reporting this user because...',
			);

			modal.setCustomId('modal_user');
			break;

		case 'other':
			short.setLabel('Title').setPlaceholder('Ex. New feature request for ChatBot');
			para.setLabel('Please provide us more detail').setPlaceholder(
				'Ask questions, requests, applications etc.',
			);
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
			new ButtonBuilder()
				.setCustomId('text')
				.setLabel('text')
				.setStyle(ButtonStyle.Secondary),
		]);

		const filter = (i) => i.user.id === interaction.user.id && i.customId === modal.data.custom_id;
		interaction
			.awaitModalSubmit({ filter, time: 60000 })
			.catch(() => { return; })
			.then(async (i) => {
				const componentPara = i.fields.getTextInputValue('para');
				let componentShort = i.fields.getTextInputValue('short');

				if (i.customId === 'modal_user') {
					if (/^[0-9]*$/gm.test(componentShort) == false) {
						return i.reply({
							content: 'Please only provide a **User ID**. To see how to get user ID\'s please refer [this post](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-). Or you could also directly get it from chatbot messages [image:](https://imgur.com/a/w93gxgu)',
							ephemeral: true,
						});
					}

					interaction.client.users.fetch(componentShort)
						.then((user) => {componentShort = `${user.username}#${user.discriminator} - ${user.id}`;})
						.catch(() => {return i.reply({ content: 'Invalid User Provided.', ephemeral: true });});
				}

				const embed = new EmbedBuilder()
					.setDescription(`Type: **${optionType}**`)
					.setAuthor({
						name: `Reported By: ${i.member.user.tag}`,
						iconURL: i.member.user.avatarURL({ dynamic: true }),
					})
					.setFooter({
						text: `From Server: ${i.guild.name}`,
						iconURL: i.guild.iconURL({ dynamic: true }),
					})
					.addFields([
						{ name: 'Title', value: componentShort },
						{ name: 'Description', value: '```' + componentPara + '```' },
					])
					.setTimestamp()
					.setColor(colors());

				const reportChannel = await interaction.client.channels.fetch(
					channelIds.channel.reports,
				);

				await i.reply('Thank you for your report!');

				// send to chatbot reports channel '<@&800698916995203104>'
				const report = await reportChannel.send({ embeds: [embed], components: [textBtn] });

				const collector = report.createMessageComponentCollector({
					time: 50_400_000,
					componentType: ComponentType.Button,
				});

				collector.on('collect', async (r) => {
					const reportEmbed = report.embeds[0];
					const content = `**${reportEmbed.author.name}**\n${reportEmbed.description}\n\n**${reportEmbed.fields[0].name}**: ${reportEmbed.fields[0].value}\n**${reportEmbed.fields[1].name}:** ${reportEmbed.fields[1].value}`;
					await r.reply({ content, ephemeral: true });
				});

				/*
				  NOTE: User modals are bugged, it will send more than one message to the support channel. Its a discord issue.
				*/
			});
	},
};