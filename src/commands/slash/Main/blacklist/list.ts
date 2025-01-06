import type { Infraction } from '@prisma/client';
import { type ChatInputCommandInteraction, EmbedBuilder, type User, time } from 'discord.js';
import { Pagination } from '#main/modules/Pagination.js';
import Constants from '#utils/Constants.js';
import db from '#utils/Db.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import { fetchUserLocale, toTitleCase } from '#utils/Utils.js';
import BlacklistCommand from './index.js';

// Type guard
const isServerType = (list: Infraction) => list.serverId && list.serverName;

export default class ListBlacklists extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const hubName = interaction.options.getString('hub', true);
    const hub = await this.findHubsByName(hubName, interaction.user.id, 1);

    const locale = await fetchUserLocale(interaction.user.id);
    if (!hub) {
      await this.replyEmbed(
        interaction,
        t('hub.notFound_mod', locale, { emoji: this.getEmoji('x_icon') }),
      );
      return;
    }

    const list = await db.infraction.findMany({
      where: { hubId: hub.id, type: 'BLACKLIST', status: 'ACTIVE' },
      orderBy: { expiresAt: 'desc' },
      include: { user: { select: { username: true } } },
    });

    const options = { LIMIT: 5, iconUrl: hub.data.iconUrl };

    const fields = [];
    let counter = 0;
    const type = isServerType(list[0]) ? 'server' : 'user';

    const paginator = new Pagination(interaction.client);
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
    data: Infraction & { user: { username: string | null } | null },
    type: 'user' | 'server',
    {
      moderator,
      locale,
    }: {
      moderator: User | null;
      locale: supportedLocaleCodes;
    },
  ) {
    const name = isServerType(data)
      ? (data.serverName ?? 'Unknown Server.')
      : (data.user?.username ?? 'Unknown User.');

    return {
      name,
      value: t(`blacklist.list.${type}`, locale, {
        id: (data.userId ?? data.serverId) as string,
        moderator: moderator ? `@${moderator.username} (${moderator.id})` : 'Unknown',
        reason: `${data?.reason}`,
        expires: !data?.expiresAt
          ? 'Never.'
          : `${time(Math.round(data?.expiresAt.getTime() / 1000), 'R')}`,
      }),
    };
  }
}
