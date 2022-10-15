import Levels from 'discord-xp';
import { EmbedBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { stripIndents } from 'common-tags';
import { constants } from '../../Utils/functions/utils';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, option: string) {
		const fetchedUser = await interaction.client.users.fetch(option).catch(() => {return null;});
		if (!fetchedUser) return interaction.reply({ content: 'Unknown user.', ephemeral: true });
		const { icons } = interaction.client.emoji;

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


		return await interaction.reply({
			content: fetchedUser.id,
			embeds: [await embedGen(fetchedUser)],
			ephemeral: true,
		});

	},
};
