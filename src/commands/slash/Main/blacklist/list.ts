import { colors, emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';
import { Pagination } from '#main/utils/Pagination.js';
import { toTitleCase } from '#main/utils/Utils.js';
import { blacklistedServers, hubBlacklist, userData } from '@prisma/client';
import { ChatInputCommandInteraction, EmbedBuilder, time, User } from 'discord.js';
import BlacklistCommand from './index.js';

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
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
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

    const fields = [];
    let counter = 0;
    const type = isUserType(list[0]) ? 'user' : 'server';

    const paginator = new Pagination();
    for (const data of list) {
      const hubData = data.blacklistedFrom.find((d) => d.hubId === hubId);
      const moderator = hubData?.moderatorId
        ? await interaction.client.users.fetch(hubData.moderatorId).catch(() => null)
        : null;

      fields.push(this.createFieldData(data, type, { hubData, moderator, locale }));

      counter++;
      if (counter >= options.LIMIT || fields.length === list.length) {
        paginator.addPage({
          embeds: [
            new EmbedBuilder()
              .setFields(fields)
              .setColor(colors.invisible)
              .setAuthor({
                name: `Blacklisted ${toTitleCase(type)}s:`,
                iconURL: options.iconUrl,
              }),
          ],
        });

        counter = 0;
        fields.length = 0; // Clear fields array
      }
    }

    await paginator.run(interaction);
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
