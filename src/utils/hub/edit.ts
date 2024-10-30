import Constants, { emojis } from '#main/config/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { supportedLocaleCodes, t } from '#utils/Locale.js';
import { connectedList, Hub } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';

export const hubEditSelects = (hubId: string, userId: string, locale: supportedLocaleCodes = 'en') =>
  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(
        new CustomID()
          .setIdentifier('hub_edit', 'actions')
          .addArgs(userId)
          .addArgs(hubId)
          .toString(),
      )
      .addOptions([
        {
          label: t('hub.manage.description.selects.label', locale),
          value: 'description',
          description: t('hub.manage.description.selects.description', locale),
          emoji: '📝',
        },
        {
          label: t('hub.manage.icon.selects.label', locale),
          value: 'icon',
          description: t('hub.manage.icon.selects.description', locale),
          emoji: '🖼️',
        },
        {
          label: 'Lock/Unlock Hub',
          value: 'toggle_lock',
          description: 'Lock or unlock the hub chats',
          emoji: '🔒',
        },
        {
          label: t('hub.manage.banner.selects.label', locale),
          value: 'banner',
          description: t('hub.manage.banner.selects.description', locale),
          emoji: '🎨',
        },
      ]),
  );

export const hubEmbed = async (hub: Hub & { connections: connectedList[] }) => {
  const hubBlacklistedUsers = await db.userInfraction.count({
    where: { hubId: hub.id, status: 'ACTIVE' },
  });
  const hubBlacklistedServers = await db.serverInfraction.count({
    where: { hubId: hub.id, status: 'ACTIVE' },
  });

  return new EmbedBuilder()
    .setTitle(hub.name)
    .setColor(Constants.Colors.interchatBlue)
    .setDescription(
      stripIndents`
    ${hub.description}

    ${emojis.dotBlue} __**Visibility:**__ ${hub.private ? 'Private' : 'Public'}
    ${emojis.dotBlue} __**Connections**__: ${hub.connections.length}
    ${emojis.dotBlue} __**Chats Locked:**__ ${hub.locked ? 'Yes' : 'No'}

  `,
    )
    .setThumbnail(hub.iconUrl)
    .setImage(hub.bannerUrl)
    .addFields(
      {
        name: 'Blacklists',
        value: stripIndents`
          Total: ${hubBlacklistedUsers + hubBlacklistedServers}
          Users: ${hubBlacklistedUsers}
          Servers: ${hubBlacklistedServers}
      `,
        inline: true,
      },

      {
        name: 'Hub Stats',
        value: stripIndents`
          Moderators: ${hub.moderators.length.toString()}
          Owner: <@${hub.ownerId}>
      `,
        inline: true,
      },
    );
};
