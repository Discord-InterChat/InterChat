const { getCredits, colors } = require('../../utils');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('credits')
		.setDescription('Sends the credits for the bot.'),
	async execute(interaction) {
		const members = [];
		const credits = await getCredits();
		for (const credit of credits) {
			const member = await interaction.client.users.fetch(String(credit));
			members.push(member);
		}


		const embed = new EmbedBuilder()
			.setAuthor({ name: `${interaction.client.user.tag} Credits`, iconURL: interaction.client.user.avatarURL() })
			.setColor(colors())
			.setTimestamp()
			.addFields([
				{
					name: 'Developed By:',
					value: `\`-\` ${members[1]}\n\`-\` ${members[3]}\n\`-\` ${members[4]}\n──────────────`,
					inline: false,
				},
				{
					name: 'Logo By',
					value: `\`-\` ${members[1]}\n──────────────`,
					inline: false,
				},
				{
					name: 'Verified By',
					value: `\`-\` ${members.at(-1)}\n──────────────`,
					inline: false,
				},
				{
					name: 'Staff',
					value: `\`-\` ${members.at(-2)}\n──────────────`,
					inline: false,
				},
			]);

		await interaction.reply({
			embeds: [embed],
		});
	},
};