const { ActionRowBuilder, SelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { stripIndents } = require('common-tags');
const { normal, icons } = require('../../utils/emoji.json');
const Levels = require('discord-xp');
const { mainGuilds } = require('../../utils/functions/utils');

module.exports = {
	async execute(interaction, option) {
		let found = interaction.client.users.cache.filter((e) => {
			return e.tag.toLowerCase().includes(option.toLowerCase());
		});
		let fetched;

		if (found.size === 0) {
			found = interaction.client.users.cache.filter((e) => {
				return option.toLowerCase().includes(e.username.toLowerCase());
			});

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
		const embedGen = async (user) => {
			return new EmbedBuilder()
				.setAuthor({ name: user.tag, iconURL: user.avatarURL() })
				.setColor('#2F3136')
				.addFields([
					{
						name: 'User Info',
						value:
					stripIndents`\n
                    ${icons.id} **ID:** ${user.id}
                    ${icons.mention} **Tag:** ${user.tag}
                    ${icons.activities} **Level**: ${(await Levels.fetch(user.id, mainGuilds.cbhq)).level || 0}
                    ${normal.neutral} **Owner Of: soon**`,
					},
				]);
		};

		// send the only result if there is one
		// if there is more than one result send the map with all the results

		// find user name, id, if they own a server with chatbot, discrim, user level

		if (found.size > 1) {
			const mapFound = found.map((e) => {
				return { label: e.tag, value: e.id };
			});

			const menu = new ActionRowBuilder().addComponents([
				new SelectMenuBuilder()
					.setCustomId('users')
					.setPlaceholder('🔍 Select a user')
					.addOptions(mapFound),
			]);

			const embed = new EmbedBuilder()
				.setTitle('Did you mean?')
				.setColor('#2F3136')
				.setDescription(found.map((e) => e.tag).slice(0, 10).join('\n'))
				.setFooter({ text: 'Only showing 10 results. Use the drop down to see more.', iconURL: interaction.client.user.avatarURL() });

			const filter = (m) => m.user.id == interaction.user.id;

			const msg = await interaction.reply({
				embeds: [embed],
				components: [menu],
				ephemeral: true,
				fetchReply: true,
			});

			const collector = msg.createMessageComponentCollector({
				filter,
				idle: 30 * 1000,
				max: found.size,
			});

			collector.on('collect', async (i) => {
				const user = await interaction.client.users.fetch(i.values[0]);
				return interaction.editReply({
					content: user.id,
					embeds: [await embedGen(user)],
					components: [],
					ephemeral: true,
				});
			});
			collector.on('end', () => {
				return interaction.editReply({ components: [] });
			});
		}
		else {
			const user = found.size === 0 ? fetched : found.entries().next().value[1];
			return await interaction.reply({
				content: user.id,
				embeds: [await embedGen(user)],
				ephemeral: true,
			});
		}
	},
};
