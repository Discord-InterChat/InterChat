const { SlashCommandBuilder, SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const mongoUtil = require('../../mongoUtil');
const logger = require('../../logger');
const { stripIndents } = require('common-tags');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('chat')
		.setDescription('Manage the chat network for this server.')
		.addSubcommand(new SlashCommandSubcommandBuilder()
			.setName('connect')
			.setDescription('Connect to the chat network.'),
		)
		.addSubcommand(new SlashCommandSubcommandBuilder()
			.setName('disconnect')
			.setDescription('Disconnect from the chat network.'),
		),
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const database = mongoUtil.getDb();
		const connectedList = database.collection('connected_list');

		if (subcommand === 'connect') {
			const findChannel = await connectedList.findOne({ channel_id: interaction.channel.id });
			if (findChannel) {
				await interaction.reply('This channel is already connected to the chat network.');
				return;
			}
			const insertChannel = { channel_id: interaction.channel.id, channel_name: interaction.channel.name, server_id: interaction.guild.id, server_name: interaction.guild.name };

			try {
				await connectedList.insertOne(insertChannel);
				await interaction.reply('This channel has been connected to the chat network. Enjoy!');
			}
			catch (err) {
				logger.error(err);
				await interaction.reply('An error occurred while connecting to the chat network.');
			}

			const allConnectedChannels = await connectedList.find({});

			await allConnectedChannels.forEach(channelEntry => {
				interaction.client.channels.fetch(channelEntry.channel_id).then(async channel => {
					await channel.send(stripIndents`
					A new server has joined us in the Network! <:chat_clipart:772393314413707274>

					**Server Name:** __${interaction.guild.name}__
					**Member Count:** __${interaction.guild.memberCount}__`);
				});
			});
		}
		else if (subcommand === 'disconnect') {
			// TODO: Implement disconnection
		}
	},
};