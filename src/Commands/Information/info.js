const { stripIndent } = require('common-tags');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { colors, getCredits } = require('../../utils/functions/utils');
const emojis = require('../../utils/emoji.json');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('This command is used to get information about the bot.'),
	async execute(interaction) {
		const members = [];
		const credits = await getCredits();
		for (const credit of credits) {
			const member = await interaction.client.users.fetch(String(credit));
			members.push(member);
		}

		const embed = new EmbedBuilder()
			.setColor(colors('chatbot'))
			.setTitle(`${emojis.icons.info} ChatBot Information`)
			.setFooter({
				text: `Requested by ${interaction.user.tag}`,
				iconURL: interaction.user.avatarURL(),
			})
			.setDescription(
				'This is a bot that is used to chat with different servers without having to join them yourself!',
			)
			.addFields([
				{
					name: 'Invite',
					value: '</invite:924659340898619394>',
					inline: true,
				},
				{
					name: 'Support Server',
					value: '</support server:924659341049626636>',
					inline: true,
				},
				{
					name: 'Credits',
					value: stripIndent`
						${emojis.icons.botdev} **Developers:**
						> \`-\` ${members[1].tag}
						> \`-\` ${members[3].tag}
						> \`-\` ${members[4].tag}

						${emojis.icons.staff} **Staff:**
						> \`-\` ${members.at(-2).tag}
						*Psst. Join the support server to know more about how you can become a staff member!*

						${emojis.normal.chatbot_circle} **Avatar:** 
						> \`-\` ${members.at(-2).tag}
						
					`,
				},
				{
					name: `${emojis.icons.link} Important Links`,
					value: stripIndent`
					[Privacy Policy](https://bit.ly/3A2yVot)
					[Terms](https://bit.ly/chatbot-terms)
					[How-To](https://bit.ly/chatbot-terms)
					`,
				},
			]);

		await interaction.reply({ embeds: [embed], ephemeral: true });
	},
};
