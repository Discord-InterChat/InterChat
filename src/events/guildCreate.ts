import BaseEventListener from '#main/core/BaseEventListener.js';
import Constants, { emojis } from '#utils/Constants.js';
import { getGuildOwnerOrFirstChannel, logGuildJoin } from '#utils/GuildUtils.js';
import Logger from '#utils/Logger.js';
import { check } from '#utils/ProfanityUtils.js';
import { stripIndents } from 'common-tags';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild } from 'discord.js';

export default class Ready extends BaseEventListener<'guildCreate'> {
  readonly name = 'guildCreate';
  public async execute(guild: Guild) {
    Logger.info(`Joined ${guild.name} (${guild.id})`);

    // log that bot joined a guild to goal channel in support server
    await logGuildJoin(guild, Constants.Channels.goal);

    const { guildOwner, guildChannel } = await getGuildOwnerOrFirstChannel(guild);

    // notify the person who added the bot
    const embed = new EmbedBuilder()
      .setTitle('👋 Thanks for adding me to your server!')
      .setDescription(
        stripIndents`
            Take your first step into the world of cross-server chatting with InterChat! 🚀 Explore public hubs, connect with multiple servers, and add a splash of excitement to your server experience. ${emojis.clipart}
            ### Getting Started
            - Simply run \`/setup\` to see an easy to follow setup guide.
            - For a more userphone-like experience, type \`c!connect\` to try out our brand new chat lobbies.
            - Visit our in-depth [wiki](${Constants.Links.Docs}) for more information.

            If you need help, join our [support server](${Constants.Links.SupportInvite}) and we'll be happy to assist!
        `,
      )
      .setColor(Constants.Colors.interchatBlue)
      .setFooter({ text: `Sent for server: ${guild.name}`, iconURL: guild.iconURL() ?? undefined });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Docs')
        .setURL(`${Constants.Links.Docs}/setup`)
        .setEmoji(emojis.guide_icon)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Terms')
        .setURL(`${Constants.Links.Docs}/legal/terms`)
        .setEmoji(emojis.docs_icon)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Privacy')
        .setURL(`${Constants.Links.Docs}/legal/privacy`)
        .setEmoji(emojis.lock_icon)
        .setStyle(ButtonStyle.Link),
    );

    const welcomeMsg = { embeds: [embed], components: [buttons] };
    guildOwner?.send(welcomeMsg).catch(() => null);
    guildChannel?.send(welcomeMsg).catch(() => null);

    const { hasProfanity, hasSlurs } = check(guild.name);
    if (!hasProfanity && !hasSlurs) return;

    const profaneErrorEmbed = new EmbedBuilder()
      .setTitle('Leave Notice 👋')
      .setDescription(
        `${emojis.no} Your server name contains profanity or sensitive content. Please change it before using InterChat.`,
      )
      .setColor(Constants.Colors.invisible)
      .setFooter({ text: `Sent for: ${guild.name}`, iconURL: guild.iconURL() ?? undefined });

    const leaveMsg = { embeds: [profaneErrorEmbed] };
    guildOwner?.send(leaveMsg).catch(() => null);
    guildChannel?.send(leaveMsg).catch(() => null);

    await guild.leave();
  }
}
