import { stripIndents } from 'common-tags';
import { EmbedBuilder, type Guild, type User } from 'discord.js';
import { HubService } from '#main/services/HubService.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';
import Constants from '#utils/Constants.js';
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

  const dotBlueEmoji = getEmoji('dotBlue', server.client);

  const embed = new EmbedBuilder()
    .setTitle('Profanity Detected')
    .setDescription(`||${rawContent}||`)
    .setColor(Constants.Colors.interchatBlue)
    .addFields({
      name: 'Details',
      value: stripIndents`
					${dotBlueEmoji} **Author:** @${author.username} (${author.id})
					${dotBlueEmoji} **Server:** ${server.name} (${server.id}})
					${dotBlueEmoji} **Hub:** ${hub.data.name}
				`,
    });

  await sendLog(author.client.cluster, logConfig.config.profanity.channelId, embed);
};
