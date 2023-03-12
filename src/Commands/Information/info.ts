import { stripIndent } from 'common-tags';
import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { colors, getCredits } from '../../Utils/functions/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('This command is used to get information about the bot.'),
  async execute(interaction: ChatInputCommandInteraction) {
    const { normal, icons } = interaction.client.emoji;

    await interaction.deferReply();

    const members: User[] = [];
    const credits = await getCredits();
    for (const credit of credits) {
      const member = await interaction.client.users.fetch(String(credit));
      members.push(member);
    }

    const embed = new EmbedBuilder()
      .setColor(colors('chatbot'))
      .setTitle(`${icons.info} ${interaction.client.user.username} Information`)
      .setThumbnail(interaction.client.user.avatarURL())
      .setDescription('A growing discord bot which provides a fun server-to-server chat! Talk to other servers from your own!')
      .addFields([
        {
          name: 'Credits',
          value: stripIndent`
					Some emojis used on this bot are from [Icons discord server](https://discord.gg/aPvvhefmt3).

						${normal.chatbot_circle} **Design:** 
						> \`-\` ${members.at(-2)?.tag} (Avatar)
						> \`-\` ${members[0].tag} (Avatar)
            > \`-\` ${members.at(-1)?.tag} (Mascot)

						${icons.botdev} **Developers:**
						> \`-\` ${members[0].tag}
						> \`-\` ${members[1].tag}
						> \`-\` ${members[2].tag}

						${icons.staff} **Staff:**
						> \`-\` ${members.at(-3)?.tag}
            > \`-\` ${members.at(-2)?.tag}
					`,
        },
        {
          name: `${icons.link} Resources`,
          value: stripIndent`
					[Guide](https://interchat.gitbook.io/guide)
					[TopGG](https://top.gg/bot/769921109209907241)
					[App Directory](https://discord.com/application-directory/769921109209907241)
					`,
          inline: true,
        },
        {
          name: '\u200B',
          value: stripIndent`
					[Support Server](https://discord.gg/6bhXQynAPs)
					[Privacy Policy](https://interchat.gitbook.io/important/privacy)
					[Terms of Service](https://interchat.gitbook.io/important/terms)
					`,
          inline: true,
        },
      ])
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.avatarURL() ?? interaction.user.defaultAvatarURL,
      });

    await interaction.followUp({ embeds: [embed] });
  },
};
