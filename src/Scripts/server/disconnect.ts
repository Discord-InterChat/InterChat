import { ChatInputCommandInteraction } from 'discord.js';
import { getDb, getGuildName } from '../../Utils/functions/utils';
import { modActions } from '../networkLogs/modActions';
import { disconnect } from '../../Structures/network';
import logger from '../../Utils/logger';

export async function execute(interaction: ChatInputCommandInteraction) {
  const serverId = interaction.options.getString('serverid', true);
  const guildInDb = await getDb().connectedList.findFirst({ where: { serverId } });

  if (!guildInDb) return await interaction.reply('Server is not connected to the network.');

  await disconnect(guildInDb.channelId);

  modActions(interaction.user, {
    guild: { id: serverId },
    action: 'disconnect',
    reason: 'Force disconnect by moderator.',
  });

  await interaction.reply(`Disconnected ${getGuildName(interaction.client, guildInDb.serverId)} from the network.`);
  logger.info(`${getGuildName(interaction.client, guildInDb.serverId)} (${guildInDb.serverId}) has been force disconnected from the network by ${interaction.user.tag}.`);
}
