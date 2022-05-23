const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ChannelType, ActionRowBuilder, SelectMenuBuilder, ButtonStyle } = require('discord.js');
const { ButtonBuilder } = require('discord.js/node_modules/@discordjs/builders');
const logger = require('../../logger');
const { colors } = require('../../utils');
const { normal } = require('../../emoji.json');
const mongoUtil = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Replies with your input!')
		.addChannelOption(option => option.setName('destination').setDescription('Select a channel').addChannelType(ChannelType.GuildCategory))
		.setDefaultPermission(false),

	async execute(interaction) {
		const confirmBtn = new ActionRowBuilder().addComponents([
			new ButtonBuilder()
				.setCustomId('yes')
				.setLabel('Yes')
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId('no')
				.setLabel('No')
				.setStyle(ButtonStyle.Danger),
		]);
		const row = new ActionRowBuilder().addComponents([
			new SelectMenuBuilder()
				.setCustomId('setup')
				.setPlaceholder('Customize Setup')
				.addOptions([
					{
						label: 'Embed Message',
						value: 'embed',
						description: 'Toggle Embeds on or off',
						emoji: '🆒',
					},
					{
						label: 'Reset Setup',
						value: 'reset',
						description: 'Delete all data related from this server from ChatBot',
						emoji: '♻️',
					},
				]),
		]);

		const database = mongoUtil.getDb();
		const setup = database.collection('setup');
		const connectedList = database.collection('connectedList');
		const destination = interaction.options.getChannel('destination');
		const guildInDB = await setup.findOne({ 'guildId': interaction.guild.id });

		const message = await interaction.deferReply();
		if (guildInDB) {
			const channels = interaction.guild.channels.cache.find(channel => channel.id === guildInDB.channelId);

			if (channels) {
				return update();
			}

			else if (!channels) {
				await setup.deleteOne(
					{ 'guildId': interaction.guild.id });
				await connectedList.deleteOne(
					{ 'serverId': interaction.guild.id });
				if (destination) return activate().catch(console.error);
				return interaction.followUp('Server is not setup! Please run the `/setup` again with the **destination** option.');
			}
			else if (destination) {
				return activate().catch(console.error);
			}

			else {
				console.error;
				return;
			}
		}

		if (!guildInDB) {
			if (destination) {
				return activate().catch(console.error);
			}
			return interaction.followUp('Server is not setup! Please run the `/setup` again with the **destination** option.');
		}

		async function activate() {
			const guild = interaction.guild;
			const category = await interaction.options.getChannel('destination');
			if (category.type != ChannelType.GuildCategory) {
				logger.error(category.type);
				return await interaction.followUp({ content: 'Please only choose category channels!', ephemeral: true });
			}
			const channel = await guild.channels.create('global-chat', {
				type: ChannelType.GuildText,
				parent: category.id,
				position: 0,
				permissionOverwrites: [{
					type: 'member',
					id: await interaction.client.user.id,
					allow: ['ViewChannel', 'SendMessages', 'ManageMessages', 'EmbedLinks', 'AttachFiles', 'ReadMessageHistory', 'ManageMessages', 'AddReactions', 'UseExternalEmojis'],
				}],
			});

			const setupmsg = await channel.send(`Setup Complete! This channel has been connected to the network! Type \`/guide\` to get started, or type \`/support server\` to join the support server for any further questions that you may have. Enjoy! ${normal.clipart}`);
			await setup.insertOne({
				'guildId': interaction.guild.id,
				'channelId': setupmsg.channel.id,
				'isEmbed': true,
			});
			const insertChannel = { channelId: setupmsg.channel.id, channelName: setupmsg.channel.name, serverId: interaction.guild.id, serverName: interaction.guild.name };
			await connectedList.insertOne(insertChannel);

			// Message link format: https://discord.com/channels/${setupmsg.guildId}/${setupmsg.channelId}/${setupmsg.messageId}
			update();
		}

		async function update() {

			// Trying to call db again to get updated data
			let guild = await setup.findOne({ 'guildId': interaction.guild.id });
			console.table(guild);
			console.log(' ---------------- ');
			const updateEmbed = new EmbedBuilder()
				.setColor(colors())
				.addFields([
					{ name: 'Details', value: `**Status:** Complete\n **Channel(s):** <#${guild.channelId}>\n **Embed Message:** ${guild.isEmbed}` },
				])
				.setAuthor({ name: 'ChatBot Setup', iconURL: interaction.client.user.avatarURL() });

			const filter = (menuInteraction) => menuInteraction.isSelectMenu();

			const collector = message.createMessageComponentCollector({ filter, time: 60000, max: '3' });
			await interaction.editReply({ content:`Setup for guild **${interaction.guild}**`, embeds: [updateEmbed], components: [row] });

			collector.on('collect', async (collected) => {
				const value = collected.values[0];
				if (collector.total == collector.options.max) {
					return interaction.editReply({ content: 'Max number of tries reached. Please run the command again to restart.', embeds: [], components: [] });
				}
				collected.deferUpdate();
				if (value === 'embed') {
					if (guild.isEmbed === true) {
						await setup.updateOne({ guildId: interaction.guild.id }, { $set:{ isEmbed: false } });

						guild = await setup.findOne({ 'guildId': interaction.guild.id });
						updateEmbed.spliceFields(0, 1, { name: 'Details', value: `**Status:** Complete\n **Channel(s):** <#${guild.channelId}>\n **Embed Message:** ${guild.isEmbed}` });
						await interaction.editReply({ embeds: [updateEmbed] });
						return interaction.followUp({ content: '**Messages will now show up normally.**' });
					}
					if (guild.isEmbed === false) {
						await setup.updateOne({ guildId: interaction.guild.id }, { $set:{ isEmbed: true } });

						guild = await setup.findOne({ 'guildId': interaction.guild.id });
						updateEmbed.spliceFields(0, 1, { name: 'Details', value: `**Status:** Complete\n **Channel(s):** <#${guild.channelId}>\n **Embed Message:** ${guild.isEmbed}` });
						await interaction.editReply({ embeds: [updateEmbed] });
						return interaction.followUp({ content: '**This server will recieve embeded messages from now on.**' });
					}
				}
				else if (value === 'reset') {
					const btnfilter = (menuInteraction) => menuInteraction.isButton();
					const confirmMsg = await interaction.followUp({ content: '**Are you sure? This will delete all linked channels and reset all of the server\'s data!**', components: [confirmBtn] });
					const btnCollector = confirmMsg.createMessageComponentCollector({ btnfilter, time: 60000, max: '4' });

					btnCollector.on('collect', async (btnCollected) => {
						if (btnCollected.customId === 'yes') {
							await connectedList.deleteOne({
								serverId: interaction.guild.id,
							});
							await setup.deleteOne({
								guildId: interaction.guild.id,

							});
							logger.warn(`Guild "${interaction.guild}" has requested deletion of their data`);
							return confirmMsg.edit({ content: `${normal.yes} **Reset Complete**`, components: [] });
						}
						else if (btnCollected.customId === 'no') {
							return confirmMsg.edit({ content: 'Cancelled.', components: [] });
						}
					});
				}
			});
		}
	},

};