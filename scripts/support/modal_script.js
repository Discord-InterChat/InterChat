const { MessageActionRow, MessageEmbed, Modal, MessageButton, TextInputComponent } = require('discord.js');
const logger = require('../../logger');
const { colors, paginate } = require('../../utils');
const { v4: uuidv4 } = require('uuid');

module.exports = {
	async execute(interaction) {
		/* 		const para_bug = new TextInputComponent()
			.setRequired(true)
			.setCustomId('para_bug')
			.setStyle('PARAGRAPH')
			.setLabel('What is the bug about?')
			.setMaxLength(1000);
		const para_server = new TextInputComponent()
			.setRequired(true)
			.setCustomId('para_server')
			.setStyle('PARAGRAPH')
			.setLabel('Please provide more info about the server')
			.setPlaceholder('I am reporting this server because...')
			.setMaxLength(1000);
		const para_user = new TextInputComponent()
			.setRequired(true)
			.setCustomId('para_user')
			.setStyle('PARAGRAPH')
			.setLabel('Please provide more info about the user')
			.setPlaceholder('I am reporting this user because...')
			.setMaxLength(1000);
		const para_other = new TextInputComponent()
			.setRequired(true)
			.setCustomId('para_other')
			.setStyle('PARAGRAPH')
			.setLabel('Please provide us more details')
			.setPlaceholder('Ask questions, requests, applications etc.')
			.setMaxLength(1000);


		const short_bug = new TextInputComponent()
			.setRequired(true)
			.setCustomId('short_bug')
			.setStyle('SHORT')
			.setMaxLength(300)
			.setLabel('Short description of the bug');
		const short_server = new TextInputComponent()
			.setRequired(true)
			.setCustomId('short_server')
			.setStyle('SHORT')
			.setLabel('Server Name & ID')
			.setMaxLength(300)
			.setPlaceholder('Ex: Land of ChatBots - 012345678909876543');
		const short_user = new TextInputComponent()
			.setRequired(true)
			.setCustomId('short_user')
			.setStyle('SHORT')
			.setLabel('User ID')
			.setMaxLength(300)
			.setPlaceholder('Ex: 012345678909876543');
		const short_other = new TextInputComponent()
			.setRequired(true)
			.setCustomId('short_other')
			.setStyle('SHORT')
			.setLabel('Title')
			.setMaxLength(300)
			.setPlaceholder('Ex. New feature request for ChatBot');

		const rowBug = new MessageActionRow().addComponents(para_bug);
		const rowServer = new MessageActionRow().addComponents(para_server);
		const rowUser = new MessageActionRow().addComponents(para_user);
		const rowOther = new MessageActionRow().addComponents(para_other);

		const shortRowBug = new MessageActionRow().addComponents(short_bug);
		const shortRowServer = new MessageActionRow().addComponents(short_server);
		const shortRowUser = new MessageActionRow().addComponents(short_user);
		const shortRowOther = new MessageActionRow().addComponents(short_other);

			*/

		const modal_bug = new Modal().setCustomId('modal_bug').setTitle('Report');
		const modal_server = new Modal().setCustomId('modal_server').setTitle('Report');
		const modal_user = new Modal().setCustomId('modal_user').setTitle('Report');
		const modal_other = new Modal().setCustomId('modal_other').setTitle('Report');

		const short = new TextInputComponent().setRequired('true').setStyle('SHORT').setMaxLength(300).setCustomId('short');
		const para = new TextInputComponent().setRequired('true').setStyle('PARAGRAPH').setMaxLength(1000).setCustomId('para');


		const optionType = await interaction.options.getString('type');

		if (optionType === 'bug') {
			para.setLabel('What is the bug about?').setLabel('Short description of the bug');
			short.setLabel('Short description of the bug');

			const row_para = new MessageActionRow().addComponents(para);
			const row_short = new MessageActionRow().addComponents(short);
			modal_bug.addComponents(row_short, row_para);

			await interaction.showModal(modal_bug);
		}
		if (optionType === 'server') {
			para.setLabel('Please provide more info about the server').setPlaceholder('I am reporting this server because...');
			short.setLabel('Server Name & ID').setPlaceholder('Ex: Land of ChatBots - 012345678909876543');

			const row_para = new MessageActionRow().addComponents(para);
			const row_short = new MessageActionRow().addComponents(short);
			modal_server.addComponents(row_short, row_para);

			await interaction.showModal(modal_server);
		}
		if (optionType === 'user') {
			para.setLabel('Please provide more info about the user').setPlaceholder('I am reporting this user because...');
			short.setLabel('User ID').setPlaceholder('Ex: 012345678909876543');


			const row_para = new MessageActionRow().addComponents(para);
			const row_short = new MessageActionRow().addComponents(short);
			modal_user.addComponents(row_short, row_para);

			await interaction.showModal(modal_user);
		}
		if (optionType === 'other') {
			para.setLabel('Please provide us more details').setPlaceholder('Ask questions, requests, applications etc.');
			short.setLabel('Title').setPlaceholder('Ex. New feature request for ChatBot').setCustomId('short_other');

			const row_para = new MessageActionRow().addComponents(para);
			const row_short = new MessageActionRow().addComponents(short);
			modal_other.addComponents(row_short, row_para);

			await interaction.showModal(modal_other);
		}


		// to-text button
		const textBtn = new MessageActionRow().addComponents([
			new MessageButton().setCustomId('text').setLabel('text').setStyle('SECONDARY'),
		]);

		// global modal collector
		const filter = (i) => i.user.id === interaction.user.id;
		interaction.awaitModalSubmit({ filter, time: 60000 })
			.then(async i => {
				// const componentShort = i.components[0].components[0];
				// const componentPara = i.components[1].components[0];
				// let value1 = componentShort.value;
				// const value2 = componentPara.value;
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
				const reportChannel = await interaction.client.channels.fetch('976099718251831366');

				await i.reply('Thank you for your report!');

				// send to chatbot reports channel
				const report = await reportChannel.send({ content: '@Staff', embeds: [embed], components: [textBtn] });

				const collector = report.createMessageComponentCollector({ time: 50400000, componentType: 'BUTTON' });

				collector.on('collect', async r => {
					const reportEmbed = report.embeds[0];
					const content = `**${reportEmbed.author.name}**\n${reportEmbed.description}\n\n**${reportEmbed.fields[0].name}**: ${reportEmbed.fields[0].value}\n**${reportEmbed.fields[1].name}:** ${reportEmbed.fields[1].value}`;
					await r.reply({ content, ephemeral: true });
				});

				// REVIEW: Modals are sort of bugged out rn so I'm using .reply() to reply to the interaction.
				// .reply() will prevent 2 instances of the modals to run when one is cancelled and error out with DiscordAPIError: Interaction has already been acknowledged,
				// it should send one message to the report channel with somewhat accurate information
				// ...probably
			})
			.catch((e) => console.log('Someone cancelled the modal.'));


	},
};