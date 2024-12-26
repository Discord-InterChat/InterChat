import BaseEventListener from '#main/core/BaseEventListener.js';
import { donateButton } from '#main/utils/ComponentUtils.js';
import Constants from '#utils/Constants.js';
import { getGuildOwnerOrFirstChannel as getGuildOwnerAndFirstChannel, logGuildJoin } from '#utils/GuildUtils.js';
import Logger from '#utils/Logger.js';
import { stripIndents } from 'common-tags';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild } from 'discord.js';

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
        2. Or browse & join hubs from [interchat.fun/hubs](${Constants.Links.Website}/hubs) like a pro 😎
        3. Check our [wiki](${Constants.Links.Docs}) for advanced features.
  
        Need help? Join our [support server](${Constants.Links.SupportInvite})!
      `,
      )
      .setColor(Constants.Colors.interchatBlue)
      .setFooter({ text: `Sent for server: ${guild.name}`, iconURL: guild.iconURL() ?? undefined });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Wiki')
        .setURL(Constants.Links.Docs)
        .setEmoji(this.getEmoji('wiki_icon'))
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Terms & Privacy')
        .setURL(`${Constants.Links.Docs}/legal`)
        .setEmoji(this.getEmoji('lock_icon'))
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Discord')
        .setURL(Constants.Links.SupportInvite)
        .setEmoji(this.getEmoji('code_icon'))
        .setStyle(ButtonStyle.Link),
    );

    const welcomeMsg = { embeds: [embed], components: [buttons, donateButton] };
    guildOwner?.send(welcomeMsg).catch(() => null);
    guildChannel?.send(welcomeMsg).catch(() => null);
  }
}
