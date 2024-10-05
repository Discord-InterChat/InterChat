import Constants from '#main/config/Constants.js';
import { msToReadable, toTitleCase } from '#main/utils/Utils.js';
import { ServerInfraction, UserInfraction } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { EmbedBuilder, User, Client, time } from 'discord.js';

// Type guard
export const isServerInfraction = (
  list: ServerInfraction | UserInfraction | undefined,
): list is ServerInfraction => Boolean(list && 'serverName' in list);

const createFieldData = (
  data: ServerInfraction | UserInfraction,
  { moderator }: { moderator: User | null },
) => {
  let expiresAt = 'Never';
  if (data.expiresAt) {
    expiresAt =
      data.expiresAt > new Date()
        ? msToReadable(data.expiresAt.getTime() - Date.now())
        : `Expired at ${data.expiresAt.toLocaleDateString()}`;
  }

  return {
    name: `${data.id} (${time(data.dateIssued, 'R')})`,
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
  infractions: (ServerInfraction | UserInfraction)[],
  type: 'server' | 'user',
  iconURL: string,
) => {
  let fields: { name: string; value: string }[] = [];
  const options = { LIMIT: 5 };
  let counter = 0;

  const firstInfraction = infractions.at(0);
  const targetId = isServerInfraction(firstInfraction)
    ? firstInfraction.serverId
    : firstInfraction?.userId;

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
