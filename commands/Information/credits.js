const { getCredits, colors } = require('../../utils');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
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
		const embed = new MessageEmbed()
			.setAuthor(`${interaction.client.user.tag} Credits`, interaction.client.user.avatarURL())
			.setColor(colors())
			.setTimestamp()
			.addFields([
				{
					name: 'Developed By:',
					value: `\`-\` ${members[0]}\n\`-\` ${members[1]}\n\`-\` ${members[2]}\n\`-\` ${members[4]}\n──────────────`,
					inline: false,
				},
				{
					name: 'Logo By',
					value: `\`-\` ${members[0]}\n──────────────`,
					inline: false,
				},
				{
					name: 'Verified By',
					value: `\`-\` ${members[3]}\n──────────────`,
					inline: false,
				},
				{
					name: 'Staff',
					value: `\`-\` ${members.at(-2)}\n\`-\` ${members.at(-1)}\n──────────────`,
					inline: false,
				},
			]);

		await interaction.reply({
			embeds: [embed],
		});
	},
};