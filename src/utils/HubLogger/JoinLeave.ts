import { stripIndents } from 'common-tags';
import { EmbedBuilder, Guild } from 'discord.js';
import { getHubConnections } from '../ConnectedList.js';
import Constants, { emojis } from '../../config/Constants.js';
import { fetchHub } from '../Utils.js';
import { sendLog } from './Default.js';

export const logJoinToHub = async (
  hubId: string,
  server: Guild,
  opt?: { totalConnections: number; hubName: string },
) => {
  const hub = await fetchHub(hubId);
  if (!hub?.logChannels?.joinLeaves) return;

  const owner = await server.fetchOwner();

  const embed = new EmbedBuilder()
    .setTitle('New Server Joined')
    .setDescription(
      stripIndents`
        ${emojis.dotBlue} **Server:** ${server.name} (${server.id})
        ${emojis.dotBlue} **Owner:** ${owner.user.tag} (${server.ownerId})
        ${emojis.dotBlue} **Member Count:** ${server.memberCount}
      `,
    )
    .setColor(Constants.Colors.interchatBlue)
    .setThumbnail(server.iconURL())
    .setFooter({
      text: `We have ${opt?.totalConnections} server(s) connected to ${opt?.hubName} now!`,
    });

  await sendLog(server.client, hub?.logChannels?.joinLeaves, embed);
};

export const logGuildLeaveToHub = async (hubId: string, server: Guild) => {
  const hub = await fetchHub(hubId);
  if (!hub?.logChannels?.joinLeaves) return;

  const owner = await server.client.users.fetch(server.ownerId).catch(() => null);
  const totalConnections = (await getHubConnections(hub.id))?.reduce(
    (total, c) => total + (c.connected ? 1 : 0),
    0,
  );

  const embed = new EmbedBuilder()
    .setTitle('Server Left')
    .setDescription(
      stripIndents`
        ${emojis.dotRed} **Server:** ${server.name} (${server.id})
        ${emojis.dotRed} **Owner:** ${owner?.username} (${server.ownerId})
        ${emojis.dotRed} **Member Count:** ${server.memberCount}
      `,
    )
    .setColor('Red')
    .setThumbnail(server.iconURL())
    .setFooter({
      text: `We now have ${totalConnections} server(s) connected to ${hub.name} now!`,
    });

  await sendLog(server.client, hub.logChannels.joinLeaves, embed);
};
