import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
} from 'discord.js';
import { badgeEmojis, emojis, LINKS } from '../../../utils/Constants.js';
import { getCredits, simpleEmbed } from '../../../utils/Utils.js';
import BaseCommand from '../../../core/BaseCommand.js';
import { stripIndents } from 'common-tags';

export default class Credits extends BaseCommand {
  readonly data = {
    name: 'credits',
    description: 'Shows the credits for InterChat',
  };

  private async getUsernames(client: Client): Promise<string[]> {
    const members: string[] = [];

    for (const credit of getCredits()) {
      const member = await client.users.fetch(credit);
      members.push(member.username.replaceAll('_', '\\_'));
    }

    return members;
  }

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const usernames = await this.getUsernames(interaction.client);
    const linksDivider = `${emojis.blueLine.repeat(9)} **LINKS** ${emojis.blueLine.repeat(9)}`;
    const creditsDivider = `${emojis.blueLine.repeat(9)} **TEAM** ${emojis.blueLine.repeat(9)}`;

    const creditsEmbed = simpleEmbed(
      stripIndents`
      ## ${emojis.wand} The Team
      InterChat is a project driven by a passionate team dedicated to enhancing the Discord experience. We welcome new members to join our team; if you're interested, please join our [support server](${LINKS.SUPPORT_INVITE}). 

      ${creditsDivider}
      ✨ **Design:** 
      ${emojis.dotBlue} @${usernames[4]} (Mascot)

      ${badgeEmojis.Developer} **Developers:**
      ${emojis.dotBlue} @${usernames[1]}
      ${emojis.dotBlue} @${usernames[2]}
      ${emojis.dotBlue} @${usernames[0]}

      ${badgeEmojis.Staff} **Staff: ([Recruiting!](https://forms.gle/8zu7cxx4XPbEmMXJ9))**
      ${emojis.dotBlue} @${usernames[3]}

      ${linksDivider}
      [Guide](${LINKS.DOCS}) • [Invite](https://discord.com/application-directory/769921109209907241) • [Support Server](${LINKS.SUPPORT_INVITE}) • [Vote](https://top.gg/bot/769921109209907241/vote) • [Privacy](${LINKS.DOCS}/legal/privacy) • [Terms](${LINKS.DOCS}/legal/terms) 
    `,
    );

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
        .setURL(LINKS.DOCS),
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

    await interaction.editReply({ embeds: [creditsEmbed], components: [linkButtons] });
  }
}