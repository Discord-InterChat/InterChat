import {
  ChatInputCommandInteraction,
  User,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { emojis, LINKS } from '../../../utils/Constants.js';
import { getCredits, simpleEmbed } from '../../../utils/Utils.js';
import BaseCommand from '../../BaseCommand.js';
import { stripIndents } from 'common-tags';

export default class Credits extends BaseCommand {
  readonly data = {
    name: 'credits',
    description: 'Shows the credits for InterChat',
  };

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const members: User[] = [];
    const credits = getCredits();
    for (const credit of credits) {
      const shardValues = (await interaction.client.cluster.broadcastEval(
        `this.users.cache.get('${credit}')`,
        { context: { userId: credit } },
      )) as User[];

      const member = shardValues.find((m) => !!m) ?? (await interaction.client.users.fetch(credit));

      members.push(member);
    }

    const linksDivider = `${emojis.blueLine.repeat(9)} **LINKS** ${emojis.blueLine.repeat(9)}`;
    const creditsDivider = `${emojis.blueLine.repeat(9)} **TEAM** ${emojis.blueLine.repeat(9)}`;

    const creditsEmbed = simpleEmbed(stripIndents`
      ## ${emojis.wand} The Team
      InterChat is a project driven by a passionate team dedicated to enhancing the Discord experience. We welcome new members to join our team; if you're interested, please join our [support server](${LINKS.SUPPORT_INVITE}). 

      ${creditsDivider}
      ${emojis.interchatCircle} **Design:** 
      ${emojis.dotBlue} @${members[6]?.username} (Mascot)
      ${emojis.dotBlue} @${members[4]?.username} (Avatar)
      ${emojis.dotBlue} @${members[0]?.username} (Avatar)
      ${emojis.dotBlue} @${members[5]?.username} (Avatar & Server Icon)

      ${emojis.botdev} **Developers:**
      ${emojis.dotBlue} @${members[1]?.username}
      ${emojis.dotBlue} @${members[2]?.username}
      ${emojis.dotBlue} @${members[0].username}

      ${emojis.staff} **Staff: ([Recruiting!](https://forms.gle/8zu7cxx4XPbEmMXJ9))**
      ${emojis.dotBlue} @${members[4]?.username}
      ${emojis.dotBlue} @${members[3]?.username}
      ${emojis.dotBlue} @${members[5]?.username}

      ${linksDivider}
      [Guide](https://discord-interchat.github.io/docs) • [Invite](https://discord.com/application-directory/769921109209907241) • [Support Server](${LINKS.SUPPORT_INVITE}) • [Vote](https://top.gg/bot/769921109209907241/vote) • [Privacy](https://discord-interchat.github.io/docs/legal/privacy) • [Terms](https://discord-interchat.github.io/docs/legal/terms) 
    `);

    const linkButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Invite')
        .setEmoji(emojis.add_icon)
        .setURL('https://discord.com/application-directory/769921109209907241'),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Guide')
        .setEmoji(emojis.guide_icon)
        .setURL('https://discord-interchat.github.io/docs'),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Support')
        .setEmoji(emojis.code_icon)
        .setURL(LINKS.SUPPORT_INVITE),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Vote!')
        // NOTE emoji is from official top.gg server
        .setEmoji('<:topgg_voter:1065977698058506290>')
        .setURL('https://top.gg/bot/769921109209907241/vote'),
    );

    await interaction.followUp({ embeds: [creditsEmbed], components: [linkButtons] });
  }
}
