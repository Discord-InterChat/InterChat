const { ActionRowBuilder, SelectMenuBuilder, EmbedBuilder, ChatInputCommandInteraction, Guild } = require('discord.js');
const { stripIndents } = require('common-tags');
const { normal, icons } = require('../../emoji.json');

module.exports = {
	/**
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {Guild} option
	 * @returns
	 */
	async execute(interaction, option) {
		let found = {};
		let fetched;

		found = interaction.client.guilds.cache.filter(e => { return e.name.toLowerCase().includes(option.toLowerCase());});

		if (found.size === 0) {
			try {
				fetched = await interaction.client.guilds.fetch(option);
			}
			catch {
				return interaction.reply({ content: 'Unknown server.', ephemeral: true });
			}
		}


		const embedGen = (guild, owner) => {
			return new EmbedBuilder()
				.setAuthor({ name: guild.name, iconURL: guild.iconURL() })
				.setColor('#2F3136')
				.addFields([
					{ name: 'Server Info', value: stripIndents`\n
                    ${icons.owner} **Owner:** ${owner.username}#${owner.discriminator}
                    ${icons.join} **Member Count:** ${guild.memberCount}
                    ${normal.neutral} **Connected: soon**
                    ${normal.neutral} **Network level: soon**
                    ` }]);
		};

		// send the only result if there is one
		// if there is more than one result send the map with all the results

		if (found.size > 1) {
			const mapFound = found.map(e => {return { label: e.name, value: e.name };});

			const menu = new ActionRowBuilder().addComponents([
				new SelectMenuBuilder()
					.setCustomId('servers')
					.setPlaceholder('🔎 Found Server List')
					.addOptions(mapFound),
			]);

			const embed = new EmbedBuilder()
				.setTitle('Did you mean?')
				.setColor('#2F3136')
				.setDescription(found.map(e => e.name).join('\n'));

			const filter = m => m.user.id == interaction.user.id;

			const msg = await interaction.reply({ embeds: [embed], components: [menu], ephemeral: true, fetchReply: true });

			const collector = msg.createMessageComponentCollector({ filter, idle: 30 * 1000, max: found.size });


			collector.on('collect', async (i) => {
				const selected = found.find(f => f.name === i.values[0]);
				const owner = await interaction.client.users.fetch(selected.ownerId);
				return interaction.editReply({ content: selected.id, embeds: [embedGen(selected, owner)], components: [], ephemeral: true });
			});
		}

		else {
			const server = found.size === 0 ? fetched : found.entries().next().value[1];
			const owner = await interaction.client.users.fetch(server.ownerId);
			return await interaction.reply({ embeds: [embedGen(server, owner)], ephemeral: true });
		}
	},
};