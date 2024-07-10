import { hubs, connectedList } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } from 'discord.js';
import { colors, emojis } from '../../utils/Constants.js';
import { CustomID } from '../../utils/CustomID.js';
import db from '../../utils/Db.js';
import { supportedLocaleCodes, t } from '../../utils/Locale.js';

export const actionsSelect = (hubId: string, userId: string, locale: supportedLocaleCodes = 'en') =>
  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(
        new CustomID()
          .setIdentifier('hub_manage', 'actions')
          .addArgs(userId)
          .addArgs(hubId)
          .toString(),
      )
      .addOptions([
        {
          label: t({ phrase: 'hub.manage.description.selects.label', locale }),
          value: 'description',
          description: t({ phrase: 'hub.manage.description.selects.description', locale }),
          emoji: '✏️',
        },
        {
          label: t({ phrase: 'hub.manage.visibility.selects.label', locale }),
          value: 'visibility',
          description: t({ phrase: 'hub.manage.visibility.selects.description', locale }),
          emoji: '🔒',
        },
        {
          label: t({ phrase: 'hub.manage.icon.selects.label', locale }),
          value: 'icon',
          description: t({ phrase: 'hub.manage.icon.selects.description', locale }),
          emoji: '🖼️',
        },
        {
          label: t({ phrase: 'hub.manage.banner.selects.label', locale }),
          value: 'banner',
          description: t({ phrase: 'hub.manage.banner.selects.description', locale }),
          emoji: '🎨',
        },
      ]),
  );

export const hubEmbed = async (hub: hubs & { connections: connectedList[] }) => {
  const hubBlacklistedUsers = await db.userData.count({
    where: { blacklistedFrom: { some: { hubId: hub.id } } },
  });
  const hubBlacklistedServers = await db.blacklistedServers.count({
    where: { blacklistedFrom: { some: { hubId: hub.id } } },
  });

  return new EmbedBuilder()
    .setTitle(hub.name)
    .setColor(colors.interchatBlue)
    .setDescription(
      stripIndents`
    ${hub.description}
    __**Public:**__ ${hub.private ? emojis.no : emojis.yes}
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
          Connected: ${hub.connections.length}
          Owner: <@${hub.ownerId}>
      `,
        inline: true,
      },
    );
};
