import { stripIndents } from 'common-tags';
import { EmbedBuilder, Guild, User } from 'discord.js';
import Constants, { emojis } from '../../config/Constants.js';
import { sendLog } from './Default.js';
import db from '#utils/Db.js';

/**
 * Logs the detected profanity along with relevant details.
 * @param rawContent - The raw content containing the profanity.
 * @param author - The user who posted the content.
 * @param server - The server where the content was posted.
 */
export default async (hubId: string, rawContent: string, author: User, server: Guild) => {
  const hub = await db.hub.findFirst({ where: { id: hubId }, include: { logConfig: true } });
  if (!hub?.logConfig[0]?.profanity) return;

  const embed = new EmbedBuilder()
    .setTitle('Profanity Detected')
    .setDescription(`||${rawContent}||`)
    .setColor(Constants.Colors.interchatBlue)
    .addFields({
      name: 'Details',
      value: stripIndents`
					${emojis.dotBlue} **Author:** @${author.username} (${author.id})
					${emojis.dotBlue} **Server:** ${server.name} (${server.id}})
					${emojis.dotBlue} **Hub:** ${hub.name}
				`,
    });

  await sendLog(author.client.cluster, hub?.logConfig[0]?.profanity, embed);
};
