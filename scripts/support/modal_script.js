const { MessageActionRow, MessageEmbed, Modal, MessageButton, TextInputComponent } = require('discord.js');
const logger = require('../../logger');
const { colors, paginate } = require('../../utils');
const { v4: uuidv4 } = require('uuid');

module.exports = {
	async execute(interaction) {
		const modal = new Modal().setTitle('Report');

		const short = new TextInputComponent().setRequired('true').setStyle('SHORT').setMaxLength(300).setCustomId('short');
		const para = new TextInputComponent().setRequired('true').setStyle('PARAGRAPH').setMaxLength(1000).setCustomId('para');


		const optionType = await interaction.options.getString('type');

		if (optionType === 'bug') {
			para.setLabel('What is the bug about?').setLabel('Short description of the bug');
			short.setLabel('Short description of the bug');

			const row_para = new MessageActionRow().addComponents(para);
			const row_short = new MessageActionRow().addComponents(short);
			modal.addComponents(row_short, row_para).setCustomId('modal_bug');
		}
		if (optionType === 'server') {
			para.setLabel('Please provide more info about the server').setPlaceholder('I am reporting this server because...');
			short.setLabel('Server Name & ID').setPlaceholder('Ex: Land of ChatBots - 012345678909876543');

			const row_para = new MessageActionRow().addComponents(para);
			const row_short = new MessageActionRow().addComponents(short);
			modal.addComponents(row_short, row_para).setCustomId('modal_server');
		}
		if (optionType === 'user') {
			para.setLabel('Please provide more info about the user').setPlaceholder('I am reporting this user because...');
			short.setLabel('User ID').setPlaceholder('Ex: 012345678909876543');


			const row_para = new MessageActionRow().addComponents(para);
			const row_short = new MessageActionRow().addComponents(short);
			modal.addComponents(row_short, row_para).setCustomId('modal_user');
		}
		if (optionType === 'other') {
			para.setLabel('Please provide us more details').setPlaceholder('Ask questions, requests, applications etc.');
			short.setLabel('Title').setPlaceholder('Ex. New feature request for ChatBot');

			const row_para = new MessageActionRow().addComponents(para);
			const row_short = new MessageActionRow().addComponents(short);
			modal.addComponents(row_short, row_para).setCustomId('modal_other');
		}

		await interaction.showModal(modal);
		// to-text button
		const textBtn = new MessageActionRow().addComponents([
			new MessageButton().setCustomId('text').setLabel('text').setStyle('SECONDARY'),
		]);

		// global modal collector
		const filter = (i) => i.user.id === interaction.user.id;
		interaction.awaitModalSubmit({ filter, time: 60000 })
			.then(async i => {
				const componentPara = i.fields.getTextInputValue('para');
				let componentShort = i.fields.getTextInputValue('short');

				if (i.customId === 'modal_user') {
					if (/^[0-9]*$/gm.test(componentShort) == false) {return i.reply({ content: 'Please only provide a **User ID**. To see how to get user ID\'s please refer [this post](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-). Or you could also directly get it from chatbot messages [image:](https://imgur.com/a/w93gxgu)', ephemeral: true });}

					try {
						const user = await interaction.client.users.fetch(componentShort);
						componentShort = `${user.username}#${user.discriminator} - ${user.id}`;
					}
					catch {
						i.reply({ content: 'Invalid User Provided.', ephemeral: true });
						return;
					}
				}

				const embed = new MessageEmbed()
					.setDescription(`Type: **${i.customId.replace('modal_', '')}**`)
					.setAuthor({ name: `Reported By: ${interaction.member.user.tag}`, iconURL: interaction.member.user.avatarURL({ dynamic: true }) })
					.setFooter({ text: `From Server: ${interaction.guild.name}`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
					.addFields([
						{ name: 'Title', value: componentShort },
						{ name: 'Description', value: '```' + componentPara + '```' },
					])
					.setTimestamp()
					.setColor(colors());

				// FIXME: change channelId to 821610981155012628 later
				const reportChannel = await interaction.client.channels.fetch('976099224611606588');

				await i.reply('Thank you for your report!');

				// send to chatbot reports channel
				const report = await reportChannel.send({ content: '<@&800698916995203104>', embeds: [embed], components: [textBtn] });

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
				return console.log('Someone cancelled the modal.');
			});
	},
};