import Constants, { badgeEmojis, emojis, mascotEmojis } from '#utils/Constants.js';
import BaseCommand, { CmdData } from '#main/core/BaseCommand.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { getCredits } from '#utils/Utils.js';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
} from 'discord.js';
import { CustomID } from '#main/utils/CustomID.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';

export default class About extends BaseCommand {
  public readonly data: CmdData = {
    name: 'about',
    description: '🚀 Learn more about the InterChat team and project.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const creditsEmbed = new InfoEmbed()
      .setDescription(
        stripIndents`
        ### ${emojis.wand} About InterChat
        InterChat is a bot which provides cross-server chats that allows users to talk across different servers. Using webhooks, InterChat broadcasts messages to all connected channels in real time, making server connections seamless.
        ### Notable Features:
        - Cross-server messaging
        - Customizable block words and filters
        - Advanced hub moderation tools
        - Webhook management for smoother message handling
        - [And more](${Constants.Links.Website}/#features)! 🚀
        ### Quick Links:
       [Guide](${Constants.Links.Docs}) • [Invite](https://discord.com/application-directory/769921109209907241) • [Support Server](${Constants.Links.SupportInvite}) • [Vote](https://top.gg/bot/769921109209907241/vote) • [Privacy](${Constants.Links.Docs}/legal/privacy) • [Terms](${Constants.Links.Docs}/legal/terms)
      `,
      )
      .setFooter({
        text: ` InterChat v${interaction.client.version} • Made with ❤️ by the InterChat Team`,
      });

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
        .setEmoji(emojis.topggSparkles)
        .setURL('https://top.gg/bot/769921109209907241/vote'),
    );

    const normalButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(new CustomID('about:credits').toString())
        .setStyle(ButtonStyle.Success)
        .setLabel('Credits & Team')
        .setEmoji(`${emojis.ghost_heart}`),
    );

    await interaction.reply({
      embeds: [creditsEmbed],
      components: [linkButtons, normalButtons],
    });
  }

  @RegisterInteractionHandler('about', 'credits')
  public async handleCreditsButton(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const usernames = await this.getUsernames(interaction.client);
    const creditsDivider = `${emojis.blueLine.repeat(9)} **CREDITS** ${emojis.blueLine.repeat(9)}`;

    const creditsEmbed = new InfoEmbed()
      .setDescription(
        stripIndents`
      
        ${creditsDivider}
        ✨ **Deserving Mentions:**
        ${emojis.dotBlue} @${usernames[6]} (made our cute mascot chipi ${mascotEmojis.flushed})
        ${emojis.dotBlue} @${usernames[7]} (top [voter](${Constants.Links.Vote}) of all time ${emojis.topggSparkles})

        ${badgeEmojis.Developer} **Developers:**
        ${emojis.dotBlue} @${usernames[0]}

        ${badgeEmojis.Staff} **Staff: ([Recruiting!](${Constants.Links.Website}/apply))**
        ${emojis.dotBlue} @${usernames[1]}
        ${emojis.dotBlue} @${usernames[2]}
        ${emojis.dotBlue} @${usernames[3]}
        ${emojis.dotBlue} @${usernames[4]}
        ${emojis.dotBlue} @${usernames[5]}
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
