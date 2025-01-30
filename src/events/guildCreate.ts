import { stripIndents } from 'common-tags';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Guild } from 'discord.js';
import BaseEventListener from '#src/core/BaseEventListener.js';
import { donateButton } from '#src/utils/ComponentUtils.js';
import Constants from '#utils/Constants.js';
import {
  getGuildOwnerOrFirstChannel as getGuildOwnerAndFirstChannel,
  logGuildJoin,
} from '#utils/GuildUtils.js';
import Logger from '#utils/Logger.js';

export default class Ready extends BaseEventListener<'guildCreate'> {
  readonly name = 'guildCreate';
  public async execute(guild: Guild) {
    Logger.info(`Joined ${guild.name} (${guild.id})`);

    // log that bot joined a guild to goal channel in support server
    await logGuildJoin(guild, Constants.Channels.goal);

    const { guildOwner, guildChannel } = await getGuildOwnerAndFirstChannel(guild);

    const embed = new EmbedBuilder()
      .setTitle('👋 Welcome to InterChat')
      .setThumbnail(guild.client.user.displayAvatarURL())
      .setDescription(
        stripIndents`
        Thanks for adding InterChat to your server! I am a discord bot that lets you chat with people from other servers in real-time. 🚀
        ### Quick Start
        1. Run \`/setup\` to quickly connect to your first hub!
        2. Or browse & join hubs from [interchat.tech/hubs](${Constants.Links.Website}/hubs) like a pro 😎
        3. Need help? Join our [support server](${Constants.Links.SupportInvite})!

        🌟 If you liked InterChat, consider [donating](${Constants.Links.Donate}) to support the project!
      `,
      )
      .setColor(Constants.Colors.interchatBlue)
      .setFooter({
        text: `Sent for server: ${guild.name}`,
        iconURL: guild.iconURL() ?? undefined,
      });

    const buttonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('ToS & Privacy')
        .setURL(`${Constants.Links.Website}/legal`)
        .setEmoji(this.getEmoji('lock_icon'))
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Discord')
        .setURL(Constants.Links.SupportInvite)
        .setEmoji(this.getEmoji('code_icon'))
        .setStyle(ButtonStyle.Link),
      donateButton,
    );

    const welcomeMsg = { embeds: [embed], components: [buttonsRow] };
    guildOwner?.send(welcomeMsg).catch(() => null);
    guildChannel?.send(welcomeMsg).catch(() => null);
  }
}
