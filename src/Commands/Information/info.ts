import { stripIndent } from 'common-tags';
import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { colors, getCredits } from '../../Utils/functions/utils';

export default {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('This command is used to get information about the bot.'),
	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.deferReply();

		const members: User[] = [];
		const credits = await getCredits();
		for (const credit of credits) {
			const member = await interaction.client.users.fetch(String(credit));
			members.push(member);
		}

		const embed = new EmbedBuilder()
			.setColor(colors('chatbot'))
			.setTitle(`${interaction.client.emoji.icons.info} ChatBot Information`)
			.setDescription('A bot that lets you talk to people from other servers from your own!')
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
					Some emojis used on this bot are from [Icons discord server](https://discord.gg/aPvvhefmt3).

						${interaction.client.emoji.normal.chatbot_circle} **Avatar & Badges:** 
						> \`-\` ${members[1].tag}
						> \`-\` ${members.at(-2)?.tag}

						${interaction.client.emoji.icons.botdev} **Developers:**
						> \`-\` ${members[1].tag}
						> \`-\` ${members[3].tag}
						> \`-\` ${members[4].tag}

						${interaction.client.emoji.icons.staff} **Staff:**
						> \`-\` ${members.at(-2)?.tag}
						*Psst. Join the support server to know more about how you can become a staff member!*	
					`,
				},
				{
					name: `${interaction.client.emoji.icons.link} Resuourses`,
					value: stripIndent`
					[Guide](https://discord-chatbot.gitbook.io/guide/)
					[Vote](https://top.gg/bot/769921109209907241/vote)
					[App Directory](https://discord.com/application-directory/769921109209907241)
					[Terms of Service](https://discord-chatbot.gitbook.io/chatbot/important/terms)
					[Privacy Policy](https://discord-chatbot.gitbook.io/chatbot/important/privacy)
					`,
				},
			])
			.setFooter({
				text: `Requested by ${interaction.user.tag}`,
				iconURL: interaction.user.avatarURL() as string,
			});

		await interaction.followUp({ embeds: [embed] });
	},
};
