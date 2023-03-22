import { EmbedBuilder, AuditLogEvent, Guild, ButtonBuilder, ActionRowBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { sendInFirst, colors, getDb, constants } from '../Utils/functions/utils';
import { stripIndents } from 'common-tags';
import { captureException } from '@sentry/node';
import wordFilter from '../Utils/functions/wordFilter';

export default {
  name: 'guildCreate',
  async execute(guild: Guild) {
    const blacklistedServers = getDb().blacklistedServers;
    const serverInBlacklist = await blacklistedServers?.findFirst({ where: { serverId: guild.id } });

    const auditLog = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 }).catch(() => null);
    const badword = wordFilter.check(guild.name);

    const { tada, clipart } = guild.client.emotes.normal;

    const embed = new EmbedBuilder()
      .setTitle(`Thank you for inviting me! ${tada} `)
      .setColor(colors('chatbot'))
      .setFooter({ text: `Sent from ${guild.name}`, iconURL: guild.iconURL() || undefined })
      .setDescription(stripIndents`
	    ${guild.client.user.username} allows you to talk to different servers from your own. It's a fun inter-server chat that we call the Chat Network ${clipart}! 

	    • Use </setup channel:978303442684624928> for ${guild.client.user.username} to guide you through the network setup process.
	    • Please follow our rules while using the network at all times.
	    • Unlock cool new features by voting on [top.gg](https://top.gg/bot/769921109209907241/vote)!
	    • Appearance of network can be modified using the dropdown in the setup.
      • If you want learn more about ${guild.client.user.username}, you can do so by reading our [guide](https://interchat.gitbook.io/guide/).


	    We hope you enjoy using ${guild.client.user.username}! If you have any issues or want to know more about our bot join the [official support server](https://discord.gg/6bhXQynAPs).
			`);

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

    if (serverInBlacklist) {
      await sendInFirst(guild, `This server is blacklisted in this bot for reason \`${serverInBlacklist.reason}\`. Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
      await guild.leave();
      return;
    }

    else if (badword) {
      await sendInFirst(guild, 'The server name contains one or more bad words. Please change the name and try inviting me again.');
      await guild.leave();
      return;
    }

    let inviter;
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

    const goalChannel = guild.client.channels.cache.get(constants.channel.goal) as TextChannel | undefined;
    const guildOwner = await guild.fetchOwner();

    goalChannel?.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('I have joined a new server!')
          .setDescription(stripIndents`
	          **${1000 - guild.client.guilds.cache.size}** servers more to go! ${tada}
					
            **Server Name:** ${guild.name} (${guild.id})
	          **Owner:** ${guildOwner.user.tag} (${guildOwner?.id})
            **Created:** <t:${Math.round(guild.createdTimestamp / 1000)}:R>
            **Language:** ${guild.preferredLocale}
            **Member Count:** ${guild.memberCount}
            `)
          .setThumbnail(guild.iconURL())
          .setFooter({ text: `Invited By: ${inviter?.tag || 'Unknown User'}`, iconURL: inviter?.avatarURL() ?? undefined })
          .setTimestamp()
          .setColor(colors()),
      ],
    }).catch(captureException);
  },
};
