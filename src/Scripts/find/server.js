const { ActionRowBuilder, SelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { stripIndents } = require('common-tags');
const emojis = require('../../utils/emoji.json');
const { getDb } = require('../../utils/functions/utils');

module.exports = {
	async execute(interaction, option) {
		const found = interaction.client.guilds.cache.filter(e => { return e.name.toLowerCase().includes(option.toLowerCase());});
		const database = getDb();
		const collection = database.collection('connectedList');

		let fetched;

		if (found.size === 0) {
			try {
				// if provided option contains a snowflake (guild id), try to fetch the guild
				// REVIEW: I think guilds are cached, so this is not necessary (unless they don't in sharding ¯\_(ツ)_/¯)
				fetched = await interaction.client.guilds.fetch(option);
			}
			catch {
				return interaction.reply({ content: 'Unknown server.', ephemeral: true });
			}
		}

		// TODO: Emojis from external servers are not supported by discord anymore (works with followUps tho).
		// Remove this when it's fixed.
		const embedGen = async (guild, owner) => {
			const guildInDb = await collection.findOne({ serverId: guild.id });
			return new EmbedBuilder()
				.setAuthor({ name: guild.name, iconURL: guild.iconURL() })
				.setColor('#2F3136')
				.addFields([
					{
						name: 'Server Info',
						value: stripIndents`\n
                    	${emojis.icons.owner} **Owner:** ${owner.username}#${owner.discriminator} (${owner.id})
                    	${emojis.icons.members} **Member Count:** ${guild.memberCount}`,
					},
					{
						name: 'Network Info',
						value: stripIndents`\n
						${guildInDb ? emojis.icons.connect : emojis.icons.disconnect} **Connected: ${guildInDb ? 'Yes' : 'No'}**
						${emojis.normal.clipart} **Channel(s): ${guildInDb?.channelName || 'Not Connected'} (\`${guildInDb?.channelId || ':('}\`)**`,
					},
				]);
		};

		// send the only result if there is one
		// if there is more than one result send the map with all the results
		if (found.size > 1) {
			const mapFound = found.map(e => {return { label: e.name, value: e.id };});

			const menu = new ActionRowBuilder().addComponents([
				new SelectMenuBuilder()
					.setCustomId('servers')
					.setPlaceholder('🔎 Select a server')
					.addOptions(mapFound),
			]);

			const embed = new EmbedBuilder()
				.setTitle('Did you mean?')
				.setColor('#2F3136')
				.setDescription(found.map((e) => e.name).slice(0, 10).join('\n'))
				.setFooter({
					text: 'Only showing 10 results. Use the drop down to see more.',
					iconURL: interaction.client.user.avatarURL(),
				});

			const filter = m => m.user.id == interaction.user.id;

			const msg = await interaction.reply({
				embeds: [embed],
				components: [menu],
				ephemeral: true,
				fetchReply: true,
			});
			const collector = msg.createMessageComponentCollector({ filter, idle: 30 * 1000, max: found.size });


			collector.on('collect', async (i) => {
				const selectedGuild = found.get(i.values[0]);
				const owner = await interaction.client.users.fetch(selectedGuild.ownerId);
				return i.update({
					content: selectedGuild.id,
					embeds: [await embedGen(selectedGuild, owner)],
					components: [],
					ephemeral: true,
				});
			});

			collector.on('end', () => {
				return interaction.editReply({ components: [] });
			});
		}

		else {
			const server = found.size === 0 ? fetched : found.entries().next().value[1];
			const owner = await interaction.client.users.fetch(server.ownerId);
			return await interaction.reply({ embeds: [await embedGen(server, owner)], ephemeral: true });
		}
	},
};