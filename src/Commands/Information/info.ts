import { stripIndent } from 'common-tags';
import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { colors, getCredits } from '../../Utils/functions/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Learn more about InterChat.'),
  async execute(interaction: ChatInputCommandInteraction) {
    const { normal, icons } = interaction.client.emotes;

    await interaction.deferReply();

    const members: User[] = [];
    const credits = await getCredits();
    for (const credit of credits) {
      const member = await interaction.client.users.fetch(String(credit));
      members.push(member);
    }

    const linksDivider = stripIndent`${normal.blueLine.repeat(9)} **LINKS** ${normal.blueLine.repeat(9)}`;
    const creditsDivider = stripIndent`${normal.blueLine.repeat(9)} **CREDITS** ${normal.blueLine.repeat(9)}`;


    const embed = new EmbedBuilder()
      .setColor(colors('chatbot'))
      .setTitle(`${icons.info} About ${interaction.client.user.username}`)
      .setThumbnail(interaction.client.user.avatarURL() || interaction.client.user.defaultAvatarURL)
      .setDescription(`
      A growing discord bot which provides a fun server-to-server chat! Talk to other servers from your own!

      ${creditsDivider}
      ${normal.chatbot_circle} **Design:** 
      ${normal.dotBlue} @${members.at(-2)?.username} (Avatar)
      ${normal.dotBlue} @${members[0].username} (Avatar)
      ${normal.dotBlue} @${members.at(-1)?.username} (Mascot)

      ${icons.botdev} **Developers:**
      ${normal.dotBlue} @${members[0].username}
      ${normal.dotBlue} @${members[1].username}
      ${normal.dotBlue} @${members[2].username}

      ${icons.staff} **Staff:**
      ${normal.dotBlue} @${members.at(-3)?.username}
      ${normal.dotBlue} @${members.at(-2)?.username}

      ${linksDivider}
      [Guide](https://discord-interchat.github.io/docs) • [Invite](${interaction.client.invite}) • [Support Server](https://discord.gg/6bhXQynAPs) • [Vote](https://top.gg/bot/769921109209907241) • [App Directory](https://discord.com/application-directory/769921109209907241) • [ToS](https://discord-interchat.github.io/important/terms) • [Privacy](https://discord-interchat.github.io/important/privacy)
      `)
      .setFooter({
        text: `Requested by @${interaction.user.username}`,
        iconURL: interaction.user.avatarURL() ?? interaction.user.defaultAvatarURL,
      });

    await interaction.followUp({ embeds: [embed] });
  },
};
