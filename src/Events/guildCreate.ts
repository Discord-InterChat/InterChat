import { EmbedBuilder, AuditLogEvent, Guild, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { sendInFirst, colors, constants } from '../Utils/functions/utils';
import { stripIndents } from 'common-tags';
import { captureException } from '@sentry/node';
import wordFilter from '../Utils/functions/wordFilter';

export default {
  name: 'guildCreate',
  async execute(guild: Guild) {
    const { normal, mascot } = guild.client.emotes;

    const embed = new EmbedBuilder()
      .setTitle(`Thank you for inviting me! ${normal.tada}`)
      .setDescription(stripIndents`
        ${guild.client.user.username} allows you to talk to different servers from your own. It's a fun inter-server chat that is called the InterChat Network ${normal.clipart}! 
        
        • Use </setup channel:978303442684624928> for me to guide you through the network setup process.
        • Please follow the network </rules:924659340898619395> while using the network at all times.
        • Unlock cool new features by voting on [top.gg](https://top.gg/bot/769921109209907241/vote)!
        • If you want learn more about me, you can do so by reading the [guide](https://interchat.gitbook.io/guide/).
        
        Hope you enjoy using the Network! If you have any issues or want to know more about me join the [official support server](https://discord.gg/6bhXQynAPs).
			`)
      .setColor(colors('chatbot'))
      .setFooter({ text: `Sent for ${guild.name}`, iconURL: guild.iconURL() || undefined });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Guide')
        .setURL('https://interchat.gitbook.io/guide')
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('ToS')
        .setURL('https://interchat.gitbook.io/important/terms')
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Privacy')
        .setURL('https://interchat.gitbook.io/important/privacy')
        .setStyle(ButtonStyle.Link),
    );


    const badword = wordFilter.check(guild.name);
    if (badword) {
      await sendInFirst(
        guild,
        'The server name contains one or more bad words. Please change the name and try inviting me again.',
      );
      await guild.leave();
      return;
    }

    let inviter;
    const auditLog = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 })
      .catch(() => null);
    if (auditLog) {
      const inviteLog = auditLog.entries.find((bot) => bot.target?.id === guild.client.user?.id);
      inviter = inviteLog?.executor;
      await inviter?.send({ embeds: [embed], components: [buttons] }).catch(() => {
        sendInFirst(guild, { embeds: [embed], components: [buttons] }).catch(() => null);
      });
    }
    else {
      await sendInFirst(guild, { embeds: [embed], components: [buttons] }).catch(() => null);
    }

    const goalChannel = guild.client.channels.cache.get(constants.channel.goal);
    if (!goalChannel?.isTextBased()) return;

    goalChannel.send({
      content: `${mascot.flushed} I have joined ${guild.name}! **${1000 - guild.client.guilds.cache.size}** servers to go! ${guild.client.emotes.normal.tada}`,
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: `${guild.name} ${inviter ? `• ${inviter.tag}` : ''}`,
            iconURL: guild.iconURL() || undefined,
          })
          .setColor(colors('invisible')),
      ],
    }).catch(captureException);
  },
};
