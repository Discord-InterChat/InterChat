const { CommandInteraction, MessageButton, MessageActionRow, MessageSelectMenu, Message } = require('discord.js');
const { Collection } = require('mongodb');
const { Embeds } = require('../../commands/Main/setup');
const emoji = require('../../emoji.json');
const logger = require('../../logger');

module.exports = {
	/**
	 *
	 * @param {CommandInteraction} interaction
	 * @param {Message} message
	 * @param {Collection} collection
	 * @param {Embeds} embedGen
	 * @param {Collection} connectedList
	 */
	async execute(interaction, message, collection, embedGen, connectedList) {
		// components
		const buttons = new MessageActionRow().addComponents([
			new MessageButton().setCustomId('yes').setLabel('Yes').setStyle('SUCCESS'),
			new MessageButton().setCustomId('no').setLabel('No').setStyle('DANGER'),
		]);
		const selectMenu = new MessageActionRow().addComponents([
			new MessageSelectMenu().setCustomId('customize').setPlaceholder('✨ Customize Setup').addOptions([
				{ label: 'Message Style', emoji: emoji.icons.message, description: 'Customize the way message sent by ChatBot looks', value: 'message_style' },
				{ label: 'Profanity Filter', emoji: emoji.icons.info, description: 'Enable and disabled profanity filter for this server', value: 'profanity_toggle' },
			]),
		]);

		let guildInDB = await collection.findOne({ 'guild.id': interaction.guild.id });

		// Create action row collectors
		const filter = m => m.user.id == interaction.user.id;
		const collector = message.createMessageComponentCollector({ filter, idle: 60000, max: 4 });


		let embed;

		// Everything is in one collector since im lazy
		collector.on('collect', async i => {
			guildInDB = await collection.findOne({ 'guild.id': interaction.guild.id });
			let channelInDB = await interaction.guild.channels.fetch(guildInDB.channel.id);
			const isConnected = await connectedList.findOne({ channelId : channelInDB.id });
			let status = '';

			channelInDB && isConnected ? status = emoji.normal.yes : status = emoji.normal.no;

			i.deferUpdate();

			// NOTE: Use i.customId to reference differnt buttons
			if (i.isButton()) {
				if (i.customId == 'edit') {
					// Setting the fields for the embed
					const fields = [
						// eslint-disable-next-line no-multi-spaces
						{ name: 'Details', value: `**Connected:** ${status}\n**Channel:** ${channelInDB}\n**Last Edited:** <t:${guildInDB.date.timestamp}:R>` },                                                                 // NOTE: change this to emoji.normal.disabled when you add the profanity filter toggler
						{ name: 'Style', value: `**Compact:** ${guildInDB.compact === true ? emoji.normal.enabled : emoji.normal.disabled}\n**Profanity Filter:** ${guildInDB.profFilter === true ? emoji.normal.force_enabled : emoji.normal.force_enabled}` },
					];
					// calling 'embedGen' class and setting fields
					embed = embedGen.setCustom(fields);
					message.edit({ embeds: [embed], components: [selectMenu] });
				}
				if (i.customId == 'reset') {
					try {
						const msg = await message.reply({
							content: `${emoji.icons.info} Are you sure? This will disconnect all connected channels and reset the setup. The channel itself will remain though. `, components: [buttons],
						});
						message.edit({ components: [] });


						const msg_collector = msg.createMessageComponentCollector({ filter: m => m.user.id == interaction.user.id, idle: 60000, max: 1 });

						// Creating collector for yes/no button
						msg_collector.on('collect', async collected => {
							if (collected.customId === 'yes') {
								await collection.deleteOne({ 'guild.id': interaction.guild.id });
								await connectedList.deleteOne({ 'serverId': interaction.guild.id });
								return msg.edit({ content: `${emoji.normal.yes} Successfully reset.`, components: [] });
							}
							msg.edit({ content: `${emoji.normal.no} Cancelled`, components: [] });
							return;
						});
					}
					catch (e) {
						message.edit({ content: `${emoji.icons.exclamation} ${ e.message}!`, embeds: [], components: [] });
						logger.error(e);
					}
				}
			}


			// NOTE: Reference multiple select menus with its 'value' (values[0])
			if (i.isSelectMenu()) {
				if (i.customId == 'customize' && i.values[0] === 'message_style') {
					// NOTE: The reason why i'm calling guildInDB over and over is to get the latest db updates, this might create problems later though.
					guildInDB = await collection.findOne({ 'guild.id': interaction.guild.id });
					channelInDB = await interaction.guild.channels.fetch(guildInDB.channel.id);

					// NOTE: This checks If isEmbed value is true in databse
					if (guildInDB) {
						const compact = guildInDB.compact;
						await collection.updateOne({ 'guild.id': interaction.guild.id }, { $set: { 'date.timestamp': Math.round(new Date().getTime() / 1000), compact: !compact } });
						guildInDB = await collection.findOne({ 'guild.id': interaction.guild.id });

						embed.spliceFields(1, 1, { name: 'Style', value: `**Compact:** ${guildInDB.compact === true ? emoji.normal.enabled : emoji.normal.disabled}\n **Profanity Filter:** ${guildInDB.profFilter === true ? emoji.normal.enabled : emoji.normal.disabled}` });
						message.edit({ embeds: [embed] });
						return;
					}

				}
				if (i.customId == 'customize' && i.values[0] === 'profanity_toggle') {
					const pfilter = guildInDB.profFilter;
					await collection.updateOne({ 'guild.id': interaction.guild.id }, { $set: { 'date.timestamp': Math.round(new Date().getTime() / 1000), profFilter: !pfilter } });
					guildInDB = await collection.findOne({ 'guild.id': interaction.guild.id });

					embed.spliceFields(1, 1, { name: 'Style', value: `**Compact:** ${guildInDB.compact === true ? emoji.normal.enabled : emoji.normal.disabled}\n **Profanity Filter:** ${guildInDB.profFilter === true ? emoji.normal.enabled : emoji.normal.disabled}` });
					message.edit({ embeds: [embed] });
					return;
				}
			}

		});

		// removing components from message when finished, idk how to disable them so...
		collector.on('end', () => {
			message.edit({ components: [] })
				.catch(() => {return;});
			return;
		});
	},
};