import Levels from 'discord-xp';
import { ActionRowBuilder, SelectMenuBuilder, EmbedBuilder, ChatInputCommandInteraction, User, ComponentType } from 'discord.js';
import { stripIndents } from 'common-tags';
import { icons } from '../../Utils/emoji.json';
import { constants } from '../../Utils/functions/utils';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, option: string) {
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


		const embedGen = async (user: User) => {
			const owns: string[] = [];
			interaction.client.guilds.cache.forEach((guild) => {
				if (guild.ownerId == user.id) {
					owns.push(guild.name);
				}
			});

			return new EmbedBuilder()
				.setAuthor({ name: user.tag, iconURL: user.avatarURL()?.toString() })
				.setColor('#2F3136')
				.addFields([
					{
						name: 'User Info',
						value:
					stripIndents`\n
                    ${icons.id} **ID:** ${user.id}
                    ${icons.mention} **Tag:** ${user.tag}
                    ${icons.activities} **Level**: ${(await Levels.fetch(user.id, constants.mainGuilds.cbhq)).level || 0}
                    ${icons.owner} **Owns**: ${owns.length === 0 ? 'Not a server owner' : owns.join(', ')}`,
					},
				]);
		};

		if (found.size > 1) {
			const mapFound = found.map((e) => {
				return { label: e.tag, value: e.id };
			});

			const menu = new ActionRowBuilder<SelectMenuBuilder>().addComponents([
				new SelectMenuBuilder()
					.setCustomId('users')
					.setPlaceholder('🔍 Select a user')
					.addOptions(mapFound),
			]);

			const embed = new EmbedBuilder()
				.setTitle('Did you mean?')
				.setColor('#2F3136')
				.setDescription(found.map((e) => e.tag).slice(0, 10).join('\n'))
				.setFooter({
					text: 'Only showing 10 results. Use the drop down to see more.',
					iconURL: interaction.client.user?.avatarURL()?.toString(),
				});

			const msg = await interaction.reply({
				embeds: [embed],
				components: [menu],
				ephemeral: true,
				fetchReply: true,
			});

			const collector = msg.createMessageComponentCollector({
				filter: (m) => m.user.id == interaction.user.id,
				componentType: ComponentType.SelectMenu,
				idle: 30 * 1000,
				max: found.size,
			});

			collector.on('collect', async (i) => {
				const user = await interaction.client.users.fetch(i.values[0]);
				interaction.editReply({
					content: user.id,
					embeds: [await embedGen(user)],
					components: [],
				});
				return;
			});

			collector.on('end', () => {
				interaction.editReply({ components: [] });
				return;
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
