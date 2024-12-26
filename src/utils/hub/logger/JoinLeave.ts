import HubLogManager from '#main/managers/HubLogManager.js';
import { getHubConnections } from '#utils/ConnectedListUtils.js';
import Constants from '#utils/Constants.js';
import { stripIndents } from 'common-tags';
import { EmbedBuilder, Guild } from 'discord.js';
import { sendLog } from './Default.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';

export const logJoinToHub = async (
  hubId: string,
  server: Guild,
  opt?: { totalConnections: number; hubName: string },
) => {
  const logManager = await HubLogManager.create(hubId);
  if (!logManager.config.joinLeaves) return;

  const dotBlueEmoji = getEmoji('dotBlue', server.client);
  const owner = await server.fetchOwner();
  const embed = new EmbedBuilder()
    .setTitle('New Server Joined')
    .setDescription(
      stripIndents`
        ${dotBlueEmoji} **Server:** ${server.name} (${server.id})
        ${dotBlueEmoji} **Owner:** ${owner.user.tag} (${server.ownerId})
        ${dotBlueEmoji} **Member Count:** ${server.memberCount}
      `,
    )
    .setColor(Constants.Colors.interchatBlue)
    .setThumbnail(server.iconURL())
    .setFooter({
      text: `We have ${opt?.totalConnections} server(s) connected to ${opt?.hubName} now!`,
    });

  await sendLog(server.client.cluster, logManager.config.joinLeaves.channelId, embed);
};

export const logGuildLeaveToHub = async (hubId: string, server: Guild) => {
  const logManager = await HubLogManager.create(hubId);
  if (!logManager.config.joinLeaves) return;

  const owner = await server.client.users.fetch(server.ownerId).catch(() => null);
  const totalConnections = (await getHubConnections(hubId))?.reduce(
    (total, c) => total + (c.connected ? 1 : 0),
    0,
  );

  const dotRedEmoji = getEmoji('dotRed', server.client);

  const embed = new EmbedBuilder()
    .setTitle('Server Left')
    .setDescription(
      stripIndents`
        ${dotRedEmoji} **Server:** ${server.name} (${server.id})
        ${dotRedEmoji} **Owner:** ${owner?.username} (${server.ownerId})
        ${dotRedEmoji} **Member Count:** ${server.memberCount}
      `,
    )
    .setColor('Red')
    .setThumbnail(server.iconURL())
    .setFooter({
      text: `We now have ${totalConnections} server(s) connected to the hub now!`,
    });

  await sendLog(server.client.cluster, logManager.config.joinLeaves.channelId, embed);
};
