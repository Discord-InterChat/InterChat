import Constants, { emojis } from '#utils/Constants.js';
import { msToReadable, toTitleCase } from '#utils/Utils.js';
import { Infraction } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { EmbedBuilder, User, Client, time } from 'discord.js';

const createFieldData = (data: Infraction, { moderator }: { moderator: User | null }) => {
  let expiresAt = 'Never';
  if (data.expiresAt) {
    expiresAt =
      data.expiresAt > new Date()
        ? msToReadable(data.expiresAt.getTime() - Date.now())
        : `Expired at ${data.expiresAt.toLocaleDateString()}`;
  }

  return {
    name: `${data.id} (${time(data.createdAt, 'R')})`,
    value: stripIndents`
    > \`\`\`yaml
    > Type: ${data.type}
    > Status: ${data.status}
    > Reason: ${data.reason}
    > Moderator: ${moderator ? moderator.tag : 'Unknown.'}
    > Expires: ${expiresAt}
    > \`\`\`
    `,
  };
};

export const buildInfractionListEmbeds = async (
  client: Client,
  targetName: string,
  infractions: Infraction[],
  type: 'server' | 'user',
  iconURL: string,
) => {
  let fields: { name: string; value: string }[] = [];
  const options = { LIMIT: 5 };
  let counter = 0;

  const firstInfraction = infractions.at(0);
  const targetId = firstInfraction?.serverId ?? firstInfraction?.userId;

  const pages = [];
  for (const infraction of infractions) {
    const moderator = infraction.moderatorId
      ? await client.users.fetch(infraction.moderatorId).catch(() => null)
      : null;

    fields.push(createFieldData(infraction, { moderator }));

    counter++;
    if (counter >= options.LIMIT || fields.length === infractions.length) {
      pages.push({
        embeds: [
          new EmbedBuilder()
            .setTitle(`ID: ${targetId} | ${infractions.length} Total Infractions`)
            .setDescription(`${emojis.exclamation} **Currently Blacklisted:** ${infractions.some((i) => i.type === 'BLACKLIST' && i.status === 'ACTIVE')}`)
            .setFields(fields)
            .setColor(Constants.Colors.invisible)
            .setAuthor({
              name: `${toTitleCase(type)} ${targetName} Infractions`,
              iconURL,
            }),
        ],
      });

      counter = 0;
      fields = []; // Clear fields array
    }
  }

  return pages;
};
