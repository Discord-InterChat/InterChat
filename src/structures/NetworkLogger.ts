import db from '../utils/Db.js';
import { stripIndents } from 'common-tags';
import { EmbedBuilder, User, Guild } from 'discord.js';
import { emojis, colors } from '../utils/Constants.js';
import { toTitleCase } from '../utils/Utils.js';
import SuperClient from '../SuperClient.js';
import BlacklistManager from '../managers/BlacklistManager.js';

export default class NetworkLogger {
  private readonly client = SuperClient.getInstance();

  private hubId: string;
  private profanityChannelId?: string;
  private modChannelId?: string;
  private reportsChannelId?: string;

  constructor(hubId: string) {
    this.hubId = hubId;
  }

  set setProfanityChannel(channelId: string) {
    db.hubs
      .update({
        where: { id: this.hubId },
        data: { logChannels: { set: { profanity: channelId } } },
      })
      .then(void 0);
    this.profanityChannelId = channelId;
  }
  set setModChannel(channelId: string) {
    db.hubs
      .update({ where: { id: this.hubId }, data: { logChannels: { set: { modLogs: channelId } } } })
      .then(void 0);
    this.modChannelId = channelId;
  }
  set setReportsChannel(channelId: string) {
    db.hubs
      .update({ where: { id: this.hubId }, data: { logChannels: { set: { reports: channelId } } } })
      .then(void 0);
    this.reportsChannelId = channelId;
  }
  set setHubId(hubId: string) {
    this.hubId = hubId;
  }

  async getReportsChannelId() {
    if (this.reportsChannelId) {
      return this.reportsChannelId;
    }
    else {
      const hub = await db.hubs.findFirst({ where: { id: this.hubId } });
      this.reportsChannelId = hub?.logChannels?.reports ?? undefined;
      return this.reportsChannelId;
    }
  }
  async getModChannelId() {
    if (this.modChannelId) {
      return this.modChannelId;
    }
    else {
      const hub = await db.hubs.findFirst({ where: { id: this.hubId } });
      this.modChannelId = hub?.logChannels?.modLogs ?? undefined;
      return this.modChannelId;
    }
  }
  async getProfanityChannelId() {
    if (this.profanityChannelId) {
      return this.profanityChannelId;
    }
    else {
      const hub = await db.hubs.findFirst({ where: { id: this.hubId } });
      this.profanityChannelId = hub?.logChannels?.profanity ?? undefined;
      return this.profanityChannelId;
    }
  }

  async log(channelId: string, embed: EmbedBuilder) {
    this.client.cluster.broadcastEval(
      async (client, ctx) => {
        const channel = await client.channels.fetch(ctx.channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        await channel.send({ embeds: [ctx.embed] }).catch(() => null);
      },
      { context: { channelId, embed } },
    );
  }

  async logProfanity(rawContent: string, author: User, server: Guild) {
    const hub = await db.hubs.findFirst({ where: { id: this.hubId } });
    const embed = new EmbedBuilder()
      .setTitle('Profanity Detected')
      .setDescription(`||${rawContent}||`)
      .setColor(colors.interchatBlue)
      .addFields({
        name: 'Details',
        value: stripIndents`
					${emojis.dotBlue} **Author:** @${author.username} (${author.id})
					${emojis.dotBlue} **Server:** ${server.name} (${server.id}})
					${emojis.dotBlue} **Hub:** ${hub?.name}
				`,
      });

    const channelId = await this.getProfanityChannelId();
    if (!channelId) return;

    return await this.log(channelId, embed);
  }

  async logBlacklist(userOrServer: User | Guild, mod: User, reason: string, expires?: Date) {
    const hub = await db.hubs.findFirst({ where: { id: this.hubId } });
    const name = userOrServer instanceof User ? userOrServer.username : userOrServer.name;
    const iconURL =
      userOrServer instanceof User
        ? userOrServer.displayAvatarURL()
        : userOrServer.iconURL() ?? undefined;
    const type = userOrServer instanceof User ? 'User' : 'Server';

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${type} ${name} blacklisted`, iconURL })
      .setDescription(
        stripIndents`
				${emojis.dotBlue} **${type}:** ${name} (${userOrServer.id})
				${emojis.dotBlue} **Moderator:** ${mod.username} (${mod.id})
				${emojis.dotBlue} **Hub:** ${hub?.name}
			`,
      )
      .addFields(
        { name: 'Reason', value: '```\n' + reason + '```', inline: true },
        {
          name: 'Expires',
          value: expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never.',
          inline: true,
        },
      )
      .setColor(colors.interchatBlue)
      .setFooter({ text: `Blacklisted by: ${mod.username}`, iconURL: mod.displayAvatarURL() });

    const channelId = await this.getModChannelId().catch(() => null);
    if (!channelId) return;

    await this.log(channelId, embed);
  }

  async logUnblacklist(
    type: 'user' | 'server',
    userOrServerId: string,
    mod: User,
    opts?: { reason?: string },
  ) {
    const hub = await db.hubs.findFirst({ where: { id: this.hubId } });

    let name: string | undefined;
    let blacklisted;
    let originalReason: string | undefined = undefined;

    if (type === 'user') {
      blacklisted = await BlacklistManager.fetchUserBlacklist(this.hubId, userOrServerId);
      name =
        (await this.client.users.fetch(userOrServerId).catch(() => null))?.username ??
        blacklisted?.username;
      originalReason = blacklisted?.hubs.find((h) => h.hubId === this.hubId)?.reason;
    }
    else {
      blacklisted = await BlacklistManager.fetchServerBlacklist(this.hubId, userOrServerId);
      name = blacklisted?.serverName;
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${toTitleCase(type)} ${name} unblacklisted` })
      .setDescription(
        stripIndents`
				${emojis.dotBlue} **User:** ${name} (${userOrServerId})
				${emojis.dotBlue} **Moderator:** ${mod.username} (${mod.id})
				${emojis.dotBlue} **Hub:** ${hub?.name}
			`,
      )
      .addFields(
        {
          name: 'Reason for Unblacklist',
          value: opts?.reason ?? 'No reason provided.',
          inline: true,
        },
        { name: 'Blacklisted For', value: originalReason ?? 'Unknown', inline: true },
      )
      .setColor(colors.interchatBlue)
      .setFooter({ text: `Unblacklisted by: ${mod.username}`, iconURL: mod.displayAvatarURL() });

    const channelId = await this.getModChannelId();
    if (!channelId) return;

    await this.log(channelId, embed);
  }

  async logReports() {
    // const channelId = await this.getReportsChannelId()
    // if (!channelId) return;
    // TODO: make it mandatory for hubs to set a report channel
    // and support server
    // await this.log(channelId, embed);
  }
}
