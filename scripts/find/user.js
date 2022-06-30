const { MessageActionRow, MessageSelectMenu, MessageEmbed, CommandInteraction, User } = require('discord.js');
const { stripIndents } = require('common-tags');
const { normal } = require('../../emoji.json');


module.exports = {
	/**
	 * @param {CommandInteraction} interaction
	 * @param {User} option
	 * @returns
	 */
	async execute(interaction, option) {
		let found = {};
		let fetched;

		found = interaction.client.users.cache.filter(e => { return e.username.toLowerCase().includes(option.toLowerCase());});

		if (found.size === 0) {

			found = interaction.client.users.cache.filter(e => { return option.toLowerCase().includes(e.username.toLowerCase()); });

			if (found.size === 0) {
				try {
					fetched = await interaction.client.users.fetch(option);
				}
				catch {
					return interaction.reply({ content: 'Unknown user.', ephemeral: true });
				}
			}
		}

		// FIXME
		const embedGen = (user) => {
			return new MessageEmbed()
				.setAuthor({ name: user.tag, iconURL: user.avatarURL() })
				.setColor('#2F3136')
				.addFields([
					{ name: 'User Info', value: stripIndents`\n
                    ${normal.id} **ID:** ${user.id}
                    ${normal.mention} **Tag:** ${user.tag}
                    ${normal.neutral} **Level: soon**
                    ${normal.neutral} **Owns a Server With ChatBot: soon**
                    ` }]);
		};

		// send the only result if there is one
		// if there is more than one result send the map with all the results


		// find user name, id, if they own a server with chatbot, discrim, user level

		if (found.size > 1) {
			const mapFound = found.map(e => {return { label: e.tag, value: e.id };});

			const menu = new MessageActionRow().addComponents([
				new MessageSelectMenu()
					.setCustomId('users')
					.setPlaceholder('🔍 Found User List')
					.addOptions(mapFound),
			]);

			const embed = new MessageEmbed()
				.setTitle('Did you mean?')
				.setColor('#2F3136')
				.setDescription(found.map(e => e.tag).join('\n'));

			const filter = m => m.user.id == interaction.user.id;

			const msg = await interaction.reply({ embeds: [embed], components: [menu], ephemeral: true, fetchReply: true });

			const collector = msg.createMessageComponentCollector({ filter, idle: 3 * 1000, max: found.size });


			collector.on('collect', async (i) => {
				const user = await interaction.client.users.fetch(i.values[0]);
				return interaction.editReply({ content: user.id, embeds: [embedGen(user)], components: [], ephemeral: true });
			});
		}

		else {
			const user = found.size === 0 ? fetched : found.entries().next().value[1];
			// const owns = await interaction.client.users.fetch(user.ownerId);
			return await interaction.reply({ embeds: [embedGen(user)], ephemeral: true });
		}
	},
};