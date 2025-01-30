import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { RegisterInteractionHandler } from '#src/decorators/RegisterInteractionHandler.js';
import { donateButton } from '#src/utils/ComponentUtils.js';
import { CustomID } from '#src/utils/CustomID.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import Constants from '#utils/Constants.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { getCredits } from '#utils/Utils.js';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type Client,
} from 'discord.js';

export default class About extends BaseCommand {
  constructor() {
    super({
      name: 'about',
      description: '🚀 Learn more about the InterChat team and project.',
      types: { slash: true, prefix: true },
    });
  }

  async execute(ctx: Context) {
    const creditsEmbed = new InfoEmbed()
      .setDescription(
        stripIndents`
        ### ${ctx.getEmoji('wand_icon')} About InterChat
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
        text: ` InterChat v${ctx.client.version} • Made with ❤️ by the InterChat Team`,
      });

    const linkButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Invite')
        .setEmoji(ctx.getEmoji('plus_icon'))
        .setURL('https://discord.com/application-directory/769921109209907241'),
      donateButton,
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Support')
        .setEmoji(ctx.getEmoji('code_icon'))
        .setURL(Constants.Links.SupportInvite),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Vote!')
        .setEmoji(ctx.getEmoji('topggSparkles'))
        .setURL('https://top.gg/bot/769921109209907241/vote'),
    );

    const normalButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(new CustomID('about:credits').toString())
        .setStyle(ButtonStyle.Primary)
        .setLabel('Credits & Team')
        .setEmoji(`${ctx.getEmoji('ghost_heart')}`),
    );

    await ctx.reply({
      embeds: [creditsEmbed],
      components: [linkButtons, normalButtons],
    });
  }

  @RegisterInteractionHandler('about', 'credits')
  public async handleCreditsButton(interaction: ButtonInteraction) {
    await interaction.deferReply({ flags: ['Ephemeral'] });

    const usernames = await this.getUsernames(interaction.client);
    const creditsDivider = `${getEmoji('blueLine', interaction.client).repeat(9)} **CREDITS** ${getEmoji('blueLine', interaction.client).repeat(9)}`;
    const dotBlue = getEmoji('dotBlue', interaction.client);

    const creditsEmbed = new InfoEmbed()
      .setDescription(
        stripIndents`
      
        ${creditsDivider}
        ${getEmoji('BadgeDeveloper', interaction.client)} **Developers:**
        ${dotBlue} @${usernames[0]}

        ${getEmoji('BadgeStaff', interaction.client)} **Staff: ([Check Applications!](${Constants.Links.Website}/apply))**
        ${dotBlue} @${usernames[1]}
        ${dotBlue} @${usernames[2]}
        ${dotBlue} @${usernames[3]}

        ✨ **Deserving Mentions:**
        ${dotBlue} @${usernames[4]} (maker of our cute mascot chipi ${getEmoji('chipi_smile', interaction.client)})
        ${dotBlue} @${usernames[5]} ([top voter](${Constants.Links.Vote}) of all time ${getEmoji('topggSparkles', interaction.client)})
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
