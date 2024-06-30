import { ChatInputCommandInteraction, EmbedBuilder, User, time } from 'discord.js';
import db from '../../../../utils/Db.js';
import BlacklistCommand from './index.js';
import { paginate } from '../../../../utils/Pagination.js';
import { colors, emojis } from '../../../../utils/Constants.js';
import { simpleEmbed, toTitleCase } from '../../../../utils/Utils.js';
import { supportedLocaleCodes, t } from '../../../../utils/Locale.js';
import { Prisma, blacklistedServers, userData } from '@prisma/client';

// Type guard functions
function isUserType(list: blacklistedServers | userData): list is userData {
  return list && 'username' in list;
}

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

    for (const data of list) {
      const hubData = data.blacklistedFrom.find((d) => d.hubId === hubId);
      const moderator = hubData?.moderatorId
        ? await interaction.client.users.fetch(hubData.moderatorId).catch(() => null)
        : null;

      fields.push(
        this.createFieldData(data, type, { hubData, moderator, locale: interaction.user.locale }),
      );

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
    type: string,
    {
      moderator,
      locale,
      hubData,
    }: {
      moderator: User | null;
      locale?: supportedLocaleCodes;
      hubData?: Prisma.$hubBlacklistPayload['scalars'];
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
