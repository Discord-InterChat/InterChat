const { ContextMenuCommandBuilder } = require('@discordjs/builders');
const { stripIndents } = require('common-tags');
const { Modal, MessageActionRow, TextInputComponent, InteractionCollector, MessageEmbed, CommandInteraction } = require('discord.js');
const { getDb } = require('../../utils');
module.exports = {
	description: 'Report a user directly from the Chat Network!',
	data: new ContextMenuCommandBuilder()
		.setName('report')
		// message type
		.setType(3),
	/**
	* @param {CommandInteraction} interaction
	* @returns
	*/
	async execute(interaction) {
		// The message the interaction is being performed on
		const args = interaction.channel.messages.cache.get(interaction.targetId);

		const database = await getDb();
		const connectedList = database.collection('connectedList');
		const channelInDb = await connectedList.findOne({ channelId: args.channel.id });

		// check if args.channel is in connectedList DB
		if (!channelInDb) return await interaction.reply({ content: 'This command only works in **ChatBot Network** channels.', ephemeral: true });

		if (args.author.id != interaction.client.user.id || !args.embeds[0] || !args.embeds[0].footer || !args.embeds[0].author || !args.embeds[0].author.url) return await interaction.reply({ content: 'Invalid usage.', ephemeral: true });

		const msgFooter = args.embeds[0].footer.text.split('┃');
		const msgAuthor = args.embeds[0].author.url.split('/');

		const userId = msgAuthor[msgAuthor.length - 1];
		const serverId = msgFooter[msgFooter.length - 1];

		const reportedUser = await interaction.client.users.fetch(userId);
		const reportedServer = await interaction.client.guilds.fetch(serverId);

		const reportsChannel = await interaction.client.channels.fetch('821610981155012628');

		const modal = new Modal().setCustomId('modal').setTitle('Report').addComponents(
			new MessageActionRow()
				.addComponents(
					new TextInputComponent()
						.setRequired(true)
						.setCustomId('para')
						.setStyle('PARAGRAPH')
						.setLabel('Please enter a reason for the report')
						.setMaxLength(950),
				));

		await interaction.showModal(modal);

		// create modal input collector
		const collector = new InteractionCollector(interaction.client, {
			max: 1,
			filter: (i) => i.isModalSubmit && i.customId === 'modal' && i.user.id === interaction.user.id,
			time: 60_000,
			errors: ['time'],
		});

		// respond to message when modal is submitted
		collector.on('collect', async (i) => {
			const reason = i.fields.getTextInputValue('para');

			// create embed with report info
			// and send it to report channel
			const embed = new MessageEmbed()
				.setAuthor({ name: `${reportedUser.tag} reported`, iconURL: reportedUser.displayAvatarURL() })
				.setTitle('New User report')
				.setDescription(`**Reason**: \`${reason}\``)
				.setColor('#ff0000')
				.addFields([
					{
						name: 'Report:',
						value: stripIndents`
						**Reported User**: ${reportedUser.username}#${reportedUser.discriminator} (${reportedUser.id})
						**User from server:**: ${reportedServer.name} (${reportedServer.id})
						
						**Reported Message**: \`\`\`${args.embeds[0].fields[0].value}\`\`\` ` },
					{ name: 'Reported By:', value: `**User**: ${i.user.tag} (${i.member.id})\n**From**: ${i.guild.name} ${i.guild.id}` },
				])
				.setTimestamp();
			await reportsChannel.send({ embeds: [embed] });

			// reply to interaction
			await i.reply({ content: 'Thank you for your report!', ephemeral: true });
		});

	},
};