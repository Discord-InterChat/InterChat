import Constants, { badgeEmojis, emojis } from '#main/config/Constants.js';
import BaseCommand, { CmdData } from '#main/core/BaseCommand.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { getCredits } from '#main/utils/Utils.js';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
} from 'discord.js';

export default class About extends BaseCommand {
  public readonly data: CmdData = {
    name: 'about',
    description: 'Learn more about the InterChat team and project.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const usernames = await this.getUsernames(interaction.client);
    const linksDivider = `${emojis.blueLine.repeat(9)} **LINKS** ${emojis.blueLine.repeat(9)}`;
    const creditsDivider = `${emojis.blueLine.repeat(9)} **TEAM** ${emojis.blueLine.repeat(9)}`;

    // TODO: Make this an actual about command, not only credits
    const creditsEmbed = new InfoEmbed().setTitle(`${emojis.wand} About Us`)
      .setDescription(stripIndents`
      
      InterChat is a project driven by a passionate team dedicated to enhancing the Discord experience. We welcome new members to join our team; if you're interested, please join our [support server](${Constants.Links.SupportInvite}).

      ${creditsDivider}
      ✨ **Design:**
      ${emojis.dotBlue} @${usernames[6]} (Mascot)

      ${badgeEmojis.Developer} **Developers:**
      ${emojis.dotBlue} @${usernames[0]}
      ${emojis.dotBlue} @${usernames[1]}
      ${emojis.dotBlue} @${usernames[2]}

      ${badgeEmojis.Staff} **Staff: ([Recruiting!](https://forms.gle/8zu7cxx4XPbEmMXJ9))**
      ${emojis.dotBlue} @${usernames[3]}
      ${emojis.dotBlue} @${usernames[4]}
      ${emojis.dotBlue} @${usernames[5]}

      ${linksDivider}
      [Guide](${Constants.Links.Docs}) • [Invite](https://discord.com/application-directory/769921109209907241) • [Support Server](${Constants.Links.SupportInvite}) • [Vote](https://top.gg/bot/769921109209907241/vote) • [Privacy](${Constants.Links.Docs}/legal/privacy) • [Terms](${Constants.Links.Docs}/legal/terms)
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
        .setURL(Constants.Links.Docs),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Support')
        .setEmoji(emojis.code_icon)
        .setURL(Constants.Links.SupportInvite),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Vote!')
        // NOTE emoji is from official top.gg server
        .setEmoji('<:topgg_voter:1065977698058506290>')
        .setURL('https://top.gg/bot/769921109209907241/vote'),
    );

    await interaction.editReply({ embeds: [creditsEmbed], components: [linkButtons] });
  }
  private async getUsernames(client: Client): Promise<string[]> {
    const members: string[] = [];

    for (const credit of getCredits()) {
      const member = await client.users.fetch(credit);
      members.push(member.username.replaceAll('_', '\\_'));
    }

    return members;
  }
}
