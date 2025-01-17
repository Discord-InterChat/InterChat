import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type Client,
} from 'discord.js';
import BaseCommand, { type CmdData } from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { donateButton } from '#main/utils/ComponentUtils.js';
import { CustomID } from '#main/utils/CustomID.js';
import Constants from '#utils/Constants.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { getCredits } from '#utils/Utils.js';

export default class About extends BaseCommand {
  public readonly data: CmdData = {
    name: 'about',
    description: '🚀 Learn more about the InterChat team and project.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const creditsEmbed = new InfoEmbed()
      .setDescription(
        stripIndents`
        ### ${this.getEmoji('wand_icon')} About InterChat
        InterChat is a bot which provides cross-server chats that allows users to talk across different servers. Using webhooks, InterChat broadcasts messages to all connected channels in real time, making server connections seamless.
        ### Features:
        - Cross-server messaging
        - Customizable block words and filters
        - Advanced hub moderation tools
        - Webhook management for smoother message handling
        - [And more](${Constants.Links.Website}/#features)! 🚀
        ### Quick Links:
       [Donate](${Constants.Links.Donate}) • [Invite](https://discord.com/application-directory/769921109209907241) • [Support Server](${Constants.Links.SupportInvite}) • [Vote](https://top.gg/bot/769921109209907241/vote) • [Privacy](${Constants.Links.Donate}/legal/privacy) • [Terms](${Constants.Links.Donate}/legal/terms)
      `,
      )
      .setFooter({
        text: ` InterChat v${interaction.client.version} • Made with ❤️ by the InterChat Team`,
      });

    const linkButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Invite')
        .setEmoji(this.getEmoji('plus_icon'))
        .setURL('https://discord.com/application-directory/769921109209907241'),
      donateButton,
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Support')
        .setEmoji(this.getEmoji('code_icon'))
        .setURL(Constants.Links.SupportInvite),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Vote!')
        // NOTE emoji is from official top.gg server
        .setEmoji(this.getEmoji('topggSparkles'))
        .setURL('https://top.gg/bot/769921109209907241/vote'),
    );

    const normalButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(new CustomID('about:credits').toString())
        .setStyle(ButtonStyle.Primary)
        .setLabel('Credits & Team')
        .setEmoji(`${this.getEmoji('ghost_heart')}`),
    );

    await interaction.reply({
      embeds: [creditsEmbed],
      components: [linkButtons, normalButtons],
    });
  }

  @RegisterInteractionHandler('about', 'credits')
  public async handleCreditsButton(interaction: ButtonInteraction) {
    await interaction.deferReply({ flags: ['Ephemeral'] });

    const usernames = await this.getUsernames(interaction.client);
    const creditsDivider = `${this.getEmoji('blueLine').repeat(9)} **CREDITS** ${this.getEmoji('blueLine').repeat(9)}`;

    const creditsEmbed = new InfoEmbed()
      .setDescription(
        stripIndents`
      
        ${creditsDivider}
        ${this.getEmoji('BadgeDeveloper')} **Developers:**
        ${this.getEmoji('dotBlue')} @${usernames[0]}

        ${this.getEmoji('BadgeStaff')} **Staff: ([Check Applications!](${Constants.Links.Website}/apply))**
        ${this.getEmoji('dotBlue')} @${usernames[1]}
        ${this.getEmoji('dotBlue')} @${usernames[2]}
        ${this.getEmoji('dotBlue')} @${usernames[3]}

        ✨ **Deserving Mentions:**
        ${this.getEmoji('dotBlue')} @${usernames[4]} (maker of our cute mascot chipi ${this.getEmoji('chipi_smile')})
        ${this.getEmoji('dotBlue')} @${usernames[5]} ([top voter](${Constants.Links.Vote}) of all time ${this.getEmoji('topggSparkles')})
        ${creditsDivider}
      `,
      )
      .setFooter({
        text: ` InterChat v${interaction.client.version} • Made with ❤️ by the InterChat Team`,
      });

    await interaction.editReply({ embeds: [creditsEmbed] });
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
