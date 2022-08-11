const { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, SelectMenuBuilder, Message, ButtonStyle } = require('discord.js');
const { Collection } = require('mongodb');
const { Embeds } = require('../../commands/Main/setup');
const emoji = require('../../utils/emoji.json');
const logger = require('../../utils/logger');

module.exports = {
	/**
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {Message} message
	 * @param {Collection} collection
	 * @param {Embeds} embedGen
	 * @param {Collection} connectedList
	 */
	async execute(interaction, message, collection, embedGen, connectedList) {
		const buttons = new ActionRowBuilder().addComponents([
			new ButtonBuilder().setCustomId('yes').setLabel('Yes').setStyle(ButtonStyle.Success),
			new ButtonBuilder().setCustomId('no').setLabel('No').setStyle(ButtonStyle.Danger),
		]);
		const selectMenu = new ActionRowBuilder().addComponents([
			new SelectMenuBuilder()
				.setCustomId('customize')
				.setPlaceholder('✨ Customize Setup')
				.addOptions([
					{
						label: 'Compact',
						emoji: emoji.icons.message,
						description: 'Disable embeds in the network to fit more messages.',
						value: 'compact',
					},

					{
						label: 'Profanity Filter',
						emoji: emoji.icons.info,
						description: 'Disable profanity filter for this server. (Unavailable as of now)', // TODO - Add profanity filter toggling
						value: 'profanity_toggle',
					},
				]),
		]);


		// Create action row collectors
		const filter = m => m.user.id == interaction.user.id;
		const collector = message.createMessageComponentCollector({ filter, time: 60000 });

		async function updateFieldData() {
			const guildInDB = await collection.findOne({ 'guild.id': interaction.guild.id });
			const channelInDB = await interaction.guild.channels.fetch(guildInDB.channel.id);
			const isConnected = await connectedList.findOne({ channelId : channelInDB.id });
			const status = channelInDB && isConnected ? emoji.normal.yes : emoji.normal.no;

			const fields = [
				{
					name: 'Details',
					value: `**Connected:** ${status}\n**Channel:** ${channelInDB}\n**Last Edited:** <t:${guildInDB.date.timestamp}:R>`,
				},
				{
					name: 'Style',
					value: `**Compact:** ${guildInDB.compact === true ? emoji.normal.enabled : emoji.normal.disabled}\n**Profanity Filter:** ${guildInDB.profFilter === true ? emoji.normal.force_enabled : emoji.normal.force_enabled}`,
				}, // NOTE: change this to emoji.normal.disabled when you add the profanity filter toggler
			];
			return fields;
		}

		async function refreshEmbed() {
			const fields = await updateFieldData();
			const embed = embedGen.setCustom(fields);
			message.edit({ embeds: [embed], components: [selectMenu] });
		}


		// Everything is in one collector since im lazy
		collector.on('collect', async i => {
			if (i.isButton()) {
				if (i.customId == 'edit') refreshEmbed();
				if (i.customId == 'reset') {
					try {
						const msg = await message.reply({
							content: `${emoji.icons.info} Are you sure? This will disconnect all connected channels and reset the setup. The channel itself will remain though. `,
							components: [buttons],
						});
						i.update({ components: [] });


						const msg_collector = msg.createMessageComponentCollector({ filter, idle: 10_000, max: 1 });

						// Creating collector for yes/no button
						msg_collector.on('collect', async collected => {
							if (collected.customId === 'yes') {
								await collection.deleteOne({ 'guild.id': interaction.guild.id });
								await connectedList.deleteOne({ 'serverId': interaction.guild.id });
								collected.update({ content: `${emoji.normal.yes} Successfully reset.`, components: [] });
							}
							else {
								collected.update({ content: `${emoji.normal.no} Cancelled.`, components: [] });
							}
							return;
						});
					}
					catch (e) {
						i.update({ content: `${emoji.icons.exclamation} ${e.message}!`, embeds: [], components: [] });
					}
				}
			}


			// Reference multiple select menus with its 'value' (values[0])
			if (i.isSelectMenu() && i.customId == 'customize') {
				// get the latest db updates
				const guildInDB = await collection.findOne({ 'guild.id': interaction.guild.id });

				// REVIEW: This had && guildinDB now it doesnt, test if it works
				if (i.values[0] === 'compact') {
					await collection.updateOne({ 'guild.id': interaction.guild.id },
						{ $set: { 'date.timestamp': Math.round(new Date().getTime() / 1000), compact: !guildInDB.compact } });
				}

				if (i.values[0] === 'profanity_toggle') {
					await collection.updateOne({ 'guild.id': interaction.guild.id },
						{ $set: { 'date.timestamp': Math.round(new Date().getTime() / 1000), profFilter: !guildInDB.profFilter } });
				}
				return refreshEmbed();
			}

		});

		collector.on('end', async () => {
			await message.edit({ components: [] })
				.catch(() => {return;});
			return;
		});
	},
};