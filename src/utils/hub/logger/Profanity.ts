import { HubService } from '#main/services/HubService.js';
import Constants, { emojis } from '#utils/Constants.js';
import { stripIndents } from 'common-tags';
import { EmbedBuilder, Guild, User } from 'discord.js';
import { sendLog } from './Default.js';

/**
 * Logs the detected profanity along with relevant details.
 * @param rawContent - The raw content containing the profanity.
 * @param author - The user who posted the content.
 * @param server - The server where the content was posted.
 */
export default async (hubId: string, rawContent: string, author: User, server: Guild) => {
  const hub = await new HubService().fetchHub(hubId);
  const logConfig = await hub?.fetchLogConfig();

  if (!hub || !logConfig?.config?.profanity) return;

  const embed = new EmbedBuilder()
    .setTitle('Profanity Detected')
    .setDescription(`||${rawContent}||`)
    .setColor(Constants.Colors.interchatBlue)
    .addFields({
      name: 'Details',
      value: stripIndents`
					${emojis.dotBlue} **Author:** @${author.username} (${author.id})
					${emojis.dotBlue} **Server:** ${server.name} (${server.id}})
					${emojis.dotBlue} **Hub:** ${hub.data.name}
				`,
    });

  await sendLog(author.client.cluster, logConfig.config.profanity.channelId, embed);
};
