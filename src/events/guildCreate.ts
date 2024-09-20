import BaseEventListener from '#main/core/BaseEventListener.js';
import { logGuildJoin } from '#main/utils/guilds/goals.js';
import Constants, { emojis } from '#main/utils/Constants.js';
import Logger from '#main/utils/Logger.js';
import { check } from '#main/utils/Profanity.js';
import { stripIndents } from 'common-tags';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild } from 'discord.js';
import getWelcomeTarget from '#main/utils/guilds/getWelcomeTarget.js';

export default class Ready extends BaseEventListener<'guildCreate'> {
  readonly name = 'guildCreate';
  public async execute(guild: Guild) {
    Logger.info(`Joined ${guild.name} (${guild.id})`);

    // log that bot joined a guild to goal channel in support server
    await logGuildJoin(guild, Constants.Channels.goal);

    const { guildOwner, guildChannel } = await getWelcomeTarget(guild);

    // notify the person who added the bot
    const embed = new EmbedBuilder()
      .setTitle('👋 Thanks for adding me to your server!')
      .setDescription(
        stripIndents`
            Take your first step into the world of cross-server chatting with InterChat! 🚀 Explore public hubs, connect with multiple servers, and add a splash of excitement to your server experience. ${emojis.clipart}
            ### Getting Started
            - Simply run </help:924659340898619398> to see an easy to follow setup guide.
            - Or visit our in-depth [web guide](${Constants.Links.Docs}/setup) for more information.

            If you need help, join our [support server](${Constants.Links.SupportInvite}) and we'll be happy to help you out!
        `,
      )
      .setColor(Constants.Colors.interchatBlue)
      .setFooter({ text: `Sent for: ${guild.name}`, iconURL: guild.iconURL() ?? undefined });

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

    const channelToSend = guildOwner ?? guildChannel;
    const message = { embeds: [embed], components: [buttons] };

    channelToSend?.send(message).catch(() => guildChannel?.send(message).catch(() => null));

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

    channelToSend?.send(leaveMsg).catch(() => guildChannel?.send(leaveMsg).catch(() => null));
    await guild.leave();
  }
}
