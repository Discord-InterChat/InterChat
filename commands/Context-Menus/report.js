const { ContextMenuCommandBuilder } = require('@discordjs/builders');
const { Modal, MessageActionRow, TextInputComponent, InteractionCollector, MessageEmbed } = require('discord.js');
const { getDb } = require('../../utils');
module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('Report')
		.setType(3),
	async execute(interaction) {
		const args = await interaction.channel.messages.cache.get(interaction.targetId);
		const database = await getDb();
		const connectedList = database.collection('connectedList');
		const channelInDb = await connectedList.findOne({ channelId: args.channel.id });

		// check if args.channel is in connectedList DB
		if (!channelInDb) return await interaction.reply({ content: 'This command only works in **ChatBot Network** channels.', ephemeral: true });

		// check if message was sent by the bot
		if (args.author.id != interaction.client.user.id || !args.embeds[0] || !args.embeds[0].footer || !args.embeds[0].author || !args.embeds[0].author.url) return await interaction.reply({ content: 'Invalid usage.', ephemeral: true });

		const msgFooter = args.embeds[0].footer.text.split('┃');
		const msgAuthor = args.embeds[0].author.url.split('/');

		const userId = msgAuthor[msgAuthor.length - 1];
		const serverId = msgFooter[msgFooter.length - 1];

		const userInfo = await interaction.client.users.fetch(userId);
		const serverInfo = await interaction.client.guilds.fetch(serverId);

		// FIXME: change channelId to 821610981155012628 later
		const reportChannel = await interaction.client.channels.fetch('976099718251831366');

		// create modal
		const modal = new Modal().setCustomId('modal').setTitle('Bug Report').addComponents(
			new MessageActionRow()
				.addComponents(
					new TextInputComponent()
						.setRequired(true)
						.setCustomId('para')
						.setStyle('PARAGRAPH')
						.setLabel('Please describe the report in more detail:')
						.setMaxLength(1000),
				));

		await interaction.showModal(modal);

		// create modal input collector
		const collector = new InteractionCollector(interaction.client, {
			max: 1,
			filter: (i) => i.isModalSubmit && i.customId === 'modal',
			timeout: 60_000,
			errors: ['time'],
		});

		// respond on modal submit
		collector.on('collect', async (i) => {
			const components = i.fields.getTextInputValue('para');

			const embed = new MessageEmbed()
				.setAuthor({ name: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
				.setTitle('New Report')
				.setColor('#ff0000')
				.addFields([
					{ name: 'Reported By', value: `${interaction.user.tag}`, inline: true },
					{ name: 'Reported From', value: `${interaction.guild.name}`, inline: true },
					{ name: 'Report Info', value: `User: **${userInfo.username}#${userInfo.discriminator}** (${userId})\nServer: **${serverInfo.name}** (${serverId}) ` },
					{ name: 'Details', value: `${components}` },
				])
				.setTimestamp();
			await i.reply({ content: 'Thank you for your report!', ephemeral: true });
			await reportChannel.send({ embeds: [embed] });
		});

	},
};