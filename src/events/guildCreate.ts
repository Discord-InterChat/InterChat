import BaseEventListener from '#main/core/BaseEventListener.js';
import Constants, { emojis } from '#utils/Constants.js';
import { getGuildOwnerOrFirstChannel, logGuildJoin } from '#utils/GuildUtils.js';
import Logger from '#utils/Logger.js';
import { stripIndents } from 'common-tags';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild } from 'discord.js';

export default class Ready extends BaseEventListener<'guildCreate'> {
  readonly name = 'guildCreate';
  public async execute(guild: Guild) {
    Logger.info(`Joined ${guild.name} (${guild.id})`);

    // log that bot joined a guild to goal channel in support server
    await logGuildJoin(guild, Constants.Channels.goal);

    const { guildOwner, guildChannel } = await getGuildOwnerOrFirstChannel(guild);

    const embed = new EmbedBuilder()
      .setTitle('👋 Welcome to InterChat')
      .setDescription(
        stripIndents`
        Connect your server with others through public chat hubs! ${emojis.clipart}
  
        ### Quick Start
        1. Run \`/setup\` to quickly connect to a hub
        2. Browse available hubs at [interchat.fun/hubs](${Constants.Links.Website}/hubs)
        3. Check our [wiki](${Constants.Links.Docs}) for advanced features
  
        Need help? Join our [support server](${Constants.Links.SupportInvite})!
      `,
      )
      .setColor(Constants.Colors.interchatBlue)
      .setFooter({ text: `Sent for server: ${guild.name}`, iconURL: guild.iconURL() ?? undefined });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Wiki')
        .setURL(`${Constants.Links.Docs}/setup`)
        .setEmoji(emojis.guide_icon)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Terms & Privacy')
        .setURL(`${Constants.Links.Docs}/legal`)
        .setEmoji(emojis.lock_icon)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Discord')
        .setURL(Constants.Links.SupportInvite)
        .setEmoji(emojis.code_icon)
        .setStyle(ButtonStyle.Link),
    );

    const welcomeMsg = { embeds: [embed], components: [buttons] };
    guildOwner?.send(welcomeMsg).catch(() => null);
    guildChannel?.send(welcomeMsg).catch(() => null);
  }
}
