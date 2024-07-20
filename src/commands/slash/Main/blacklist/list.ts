import db from '#main/utils/Db.js';
import BlacklistCommand from './index.js';
import { colors, emojis } from '#main/utils/Constants.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';
import { paginate } from '#main/utils/Pagination.js';
import { getUserLocale, toTitleCase } from '#main/utils/Utils.js';
import { blacklistedServers, hubBlacklist, userData } from '@prisma/client';
import { ChatInputCommandInteraction, EmbedBuilder, User, time } from 'discord.js';

// Type guard
const isUserType = (list: blacklistedServers | userData) => list && 'username' in list;

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
    const locale = await getUserLocale(interaction.user.id);
    if (!hubInDb) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'hub.notFound_mod', locale }, { emoji: emojis.no }),
      );
      return;
    }

    const blacklistType = interaction.options.getString('type') as 'server' | 'user';
    const hubId = hubInDb.id;
    const list =
      blacklistType === 'server'
        ? await db.blacklistedServers.findMany({ where: { blacklistedFrom: { some: { hubId } } } })
        : await db.userData.findMany({ where: { blacklistedFrom: { some: { hubId } } } });
    const options = { LIMIT: 5, iconUrl: hubInDb.iconUrl };
    const embeds = await this.buildEmbeds(interaction, list, hubId, options);

    await paginate(interaction, embeds);
  }

  private async buildEmbeds(
    interaction: ChatInputCommandInteraction,
    list: blacklistedServers[] | userData[],
    hubId: string,
    opts: { LIMIT: number; iconUrl?: string },
  ): Promise<EmbedBuilder[]> {
    const embeds: EmbedBuilder[] = [];
    const fields = [];
    let counter = 0;
    const type = isUserType(list[0]) ? 'user' : 'server';
    const locale = await getUserLocale(interaction.user.id);

    for (const data of list) {
      const hubData = data.blacklistedFrom.find((d) => d.hubId === hubId);
      const moderator = hubData?.moderatorId
        ? await interaction.client.users.fetch(hubData.moderatorId).catch(() => null)
        : null;

      fields.push(this.createFieldData(data, type, { hubData, moderator, locale }));

      counter++;
      if (counter >= opts.LIMIT || fields.length === list.length) {
        embeds.push(
          new EmbedBuilder()
            .setFields(fields)
            .setColor(colors.invisible)
            .setAuthor({
              name: `Blacklisted ${toTitleCase(type)}s:`,
              iconURL: opts.iconUrl,
            }),
        );

        counter = 0;
        fields.length = 0; // Clear fields array
      }
    }

    return embeds;
  }
  private createFieldData(
    data: blacklistedServers | userData,
    type: 'user' | 'server',
    {
      moderator,
      locale,
      hubData,
    }: {
      moderator: User | null;
      locale?: supportedLocaleCodes;
      hubData?: hubBlacklist;
    },
  ) {
    return {
      name: (isUserType(data) ? data.username : data.serverName) ?? 'Unknown User.',
      value: t(
        { phrase: `blacklist.list.${type}`, locale },
        {
          id: data.id,
          moderator: moderator ? `@${moderator.username} (${moderator.id})` : 'Unknown',
          reason: `${hubData?.reason}`,
          expires: !hubData?.expires
            ? 'Never.'
            : `${time(Math.round(hubData?.expires.getTime() / 1000), 'R')}`,
        },
      ),
    };
  }
}
