import { Pagination } from '#main/modules/Pagination.js';
import Constants, { emojis } from '#utils/Constants.js';
import db from '#utils/Db.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import { toTitleCase } from '#utils/Utils.js';
import { Infraction } from '@prisma/client';
import { type ChatInputCommandInteraction, EmbedBuilder, time, User } from 'discord.js';
import BlacklistCommand from './index.js';

// Type guard
const isServerType = (list: Infraction) => list.serverId && list.serverName;

export default class ListBlacklists extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const hubName = interaction.options.getString('hub', true);
    const hub = await this.findHubsByName(hubName, interaction.user.id, 1);

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    if (!hub) {
      await this.replyEmbed(interaction, t('hub.notFound_mod', locale, { emoji: emojis.no }));
      return;
    }

    const hubId = hub.id;
    const query = { where: { hubId, type: 'BLACKLIST', status: 'ACTIVE' } } as const;
    const list = await db.infraction.findMany({
      where: query.where,
      orderBy: { expiresAt: 'desc' },
      include: { user: { select: { username: true } } },
    });

    const options = { LIMIT: 5, iconUrl: hub.data.iconUrl };

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
