const { ModalBuilder, ActionRowBuilder, TextInputComponent, InteractionCollector, EmbedBuilder, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, ApplicationCommandType, TextInputStyle } = require('discord.js');
const { getDb } = require('../../utils');
module.exports = {
	description: 'Report a user directly from the Chat Network!',
	data: new ContextMenuCommandBuilder()
		.setName('report')
		// message type
		.setType(ApplicationCommandType.Message),
	/**
	* @param {MessageContextMenuCommandInteraction} interaction
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

		const userInfo = await interaction.client.users.fetch(userId);
		const serverInfo = await interaction.client.guilds.fetch(serverId);

		// FIXME: change channelId to 821610981155012628 later
		const reportChannel = await interaction.client.channels.fetch('976099718251831366');

		const modal = new ModalBuilder().setCustomId('modal').setTitle('Report').addComponents(
			new ActionRowBuilder()
				.addComponents(
					new TextInputComponent()
						.setRequired(true)
						.setCustomId('para')
						.setStyle(TextInputStyle.Paragraph)
						.setLabel('Please enter a reason for the report')
						.setMaxLength(950),
				));

		await interaction.showModalBuilder(ModalBuilder);

		// create ModalBuilder input collector
		const collector = new InteractionCollector(interaction.client, {
			max: 1,
			filter: (i) => i.isModalBuilderSubmit && i.customId === 'modal' && i.user.id === interaction.user.id,
			time: 60_000,
			errors: ['time'],
		});

		// respond to message when ModalBuilder is submitted
		collector.on('collect', async (i) => {
			const components = i.fields.getTextInputValue('para');

			// create embed with report info
			// and send it to report channel
			const embed = new EmbedBuilder()
				.setAuthor({ name: `${i.user.tag}`, iconURL: i.user.displayAvatarURL() })
				.setTitle('New Report')
				.setDescription('Please wait while we process your report...')
				.setColor('#ff0000')
				.addFields([
					{ name: 'Reported By', value: `${i.user.tag}`, inline: true },
					{ name: 'Reported From', value: `${i.guild.name}`, inline: true },
					{ name: 'Report Info', value: `User: **${userInfo.username}#${userInfo.discriminator}** (${userId})\nServer: **${serverInfo.name}** (${serverId}) ` },
					{ name: 'Details', value: '```' + components + '```' },
				])
				.setTimestamp();
			await reportChannel.send({ embeds: [embed] });

			// reply to interaction
			await i.reply({ content: 'Thank you for your report!', ephemeral: true });
		});

	},
};