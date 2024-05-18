import { ChatInputCommandInteraction, EmbedBuilder, time } from 'discord.js';
import db from '../../../../utils/Db.js';
import BlacklistCommand from './index.js';
import { paginate } from '../../../../utils/Pagination.js';
import { colors, emojis } from '../../../../utils/Constants.js';
import { simpleEmbed } from '../../../../utils/Utils.js';
import { t } from '../../../../utils/Locale.js';
import { blacklistedServers, userData } from '@prisma/client';

export default class ListBlacklists extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const hubName = interaction.options.getString('hub', true);
    const hubInDb = await db.hubs.findFirst({
      where: {
        name: hubName,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id } } },
        ],
      },
    });

    if (!hubInDb) {
      await interaction.editReply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'hub.notFound_mod', locale: interaction.user.locale },
              { emoji: emojis.no },
            ),
          ),
        ],
      });
      return;
    }

    let embeds: EmbedBuilder[] = [];
    const LIMIT = 5;

    const blacklistType = interaction.options.getString('type') as 'server' | 'user';
    const options = { LIMIT, iconUrl: hubInDb.iconUrl };
    const hubId = hubInDb.id;

    if (blacklistType === 'server') {
      const result = await db.blacklistedServers.findMany({ where: { hubs: { some: { hubId } } } });
      embeds = await this.buildServersEmbeds(interaction, hubId, result, options);
    }
    else if (blacklistType === 'user') {
      const result = await db.userData.findMany({ where: { blacklistedFrom: { some: { hubId } } } });
      embeds = await this.buildUserEmbeds(interaction, hubId, result, options);
    }

    await paginate(interaction, embeds);
  }

  private async buildServersEmbeds(
    interaction: ChatInputCommandInteraction,
    hubId: string,
    list: blacklistedServers[],
    opts: { LIMIT: number; iconUrl?: string },
  ) {
    const { locale } = interaction.user;
    const embeds: EmbedBuilder[] = [];
    let fields = [];
    let counter = 0;

    for (let i = 0; i < list.length; i++) {
      const data = list[i];
      const hubData = data.hubs.find((d) => d.hubId === hubId);
      const moderator = hubData?.moderatorId
        ? await interaction.client.users.fetch(hubData?.moderatorId).catch(() => null)
        : null;

      fields.push({
        name: data.serverName,
        value: t(
          { phrase: 'blacklist.list.server', locale },
          {
            serverId: data.serverId,
            moderator: moderator ? `@${moderator.username} (${hubData?.moderatorId})` : 'Unknown',
            reason: `${hubData?.reason}`,
            expires: !hubData?.expires
              ? 'Never.'
              : `${time(Math.round(hubData.expires.getTime() / 1000), 'R')}`,
          },
        ),
      });

      counter++;
      if (counter >= opts.LIMIT || i === list.length - 1) {
        embeds.push(
          new EmbedBuilder().setFields(fields).setColor('#0099ff').setAuthor({
            name: 'Blacklisted Servers:',
            iconURL: opts.iconUrl,
          }),
        );

        counter = 0;
        fields = [];
      }
    }

    return embeds;
  }

  private async buildUserEmbeds(
    interaction: ChatInputCommandInteraction,
    hubId: string,
    list: userData[],
    opts: { LIMIT: number; iconUrl?: string },
  ) {
    const { locale } = interaction.user;
    const embeds: EmbedBuilder[] = [];
    let fields = [];
    let counter = 0;

    for (let i = 0; i < list.length; i++) {
      const data = list[i];
      const hubData = data.blacklistedFrom.find((d) => d.hubId === hubId);
      const moderator = hubData?.moderatorId
        ? await interaction.client.users.fetch(hubData?.moderatorId).catch(() => null)
        : null;

      fields.push({
        name: `${data.username}`,
        value: t(
          { phrase: 'blacklist.list.user', locale },
          {
            userId: data.userId,
            moderator: moderator ? `@${moderator.username} (${hubData?.moderatorId})` : 'Unknown',
            reason: `${hubData?.reason}`,
            expires: !hubData?.expires
              ? 'Never.'
              : `${time(Math.round(hubData.expires.getTime() / 1000), 'R')}`,
          },
        ),
      });

      counter++;
      if (counter >= opts.LIMIT || i === list.length - 1) {
        embeds.push(
          new EmbedBuilder().setFields(fields).setColor(colors.invisible).setAuthor({
            name: 'Blacklisted Users:',
            iconURL: opts.iconUrl,
          }),
        );

        counter = 0;
        fields = [];
      }
    }
    return embeds;
  }
}
