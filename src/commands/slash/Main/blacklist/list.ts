import Constants, { emojis } from '#utils/Constants.js';
import db from '#utils/Db.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import { Pagination } from '#main/modules/Pagination.js';
import { toTitleCase } from '#utils/Utils.js';
import { type ChatInputCommandInteraction, EmbedBuilder, time, User } from 'discord.js';
import BlacklistCommand from './index.js';
import type { ServerInfraction, UserInfraction } from '@prisma/client';

// Type guard
const isServerType = (list: ServerInfraction | UserInfraction) => list && 'serverName' in list;

export default class ListBlacklists extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const hubName = interaction.options.getString('hub', true);
    const hubInDb = await db.hub.findFirst({
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
      await this.replyEmbed(interaction, t('hub.notFound_mod', locale, { emoji: emojis.no }));
      return;
    }

    const blacklistType = interaction.options.getString('type') as 'server' | 'user';
    const hubId = hubInDb.id;
    const query = { where: { hubId, type: 'BLACKLIST', status: 'ACTIVE' } } as const;
    const list =
      blacklistType === 'server'
        ? await db.serverInfraction.findMany(query)
        : await db.userInfraction.findMany({
          where: query.where,
          orderBy: { expiresAt: 'desc' },
          include: { userData: { select: { username: true } } },
        });

    const options = { LIMIT: 5, iconUrl: hubInDb.iconUrl };

    const fields = [];
    let counter = 0;
    const type = isServerType(list[0]) ? 'server' : 'user';

    const paginator = new Pagination();
    for (const data of list) {
      const moderator = data.moderatorId
        ? await interaction.client.users.fetch(data.moderatorId).catch(() => null)
        : null;

      fields.push(this.createFieldData(data, type, { moderator, locale }));

      counter++;
      if (counter >= options.LIMIT || fields.length === list.length) {
        paginator.addPage({
          embeds: [
            new EmbedBuilder()
              .setFields(fields)
              .setColor(Constants.Colors.invisible)
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
    data: ServerInfraction | (UserInfraction & { userData: { username: string | null } }),
    type: 'user' | 'server',
    {
      moderator,
      locale,
    }: {
      moderator: User | null;
      locale: supportedLocaleCodes;
    },
  ) {
    return {
      name: (isServerType(data) ? data.serverName : data.userData.username) ?? 'Unknown User.',
      value: t(`blacklist.list.${type}`, locale, {
        id: 'userId' in data ? data.userId : data.serverId,
        moderator: moderator ? `@${moderator.username} (${moderator.id})` : 'Unknown',
        reason: `${data?.reason}`,
        expires: !data?.expiresAt
          ? 'Never.'
          : `${time(Math.round(data?.expiresAt.getTime() / 1000), 'R')}`,
      }),
    };
  }
}
