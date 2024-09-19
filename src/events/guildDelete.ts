import BaseEventListener from '#main/core/BaseEventListener.js';
import { logGuildLeave } from '#main/utils/guilds/goals.js';
import { deleteConnections } from '#main/utils/ConnectedList.js';
import Constants from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { logGuildLeaveToHub } from '#main/utils/HubLogger/JoinLeave.js';
import Logger from '#main/utils/Logger.js';
import { Guild } from 'discord.js';

export default class Ready extends BaseEventListener<'guildDelete'> {
  readonly name = 'guildDelete';
  public async execute(guild: Guild) {
    if (!guild.available) return;

    Logger.info(`Left ${guild.name} (${guild.id})`);

    const connections = await db.connectedList.findMany({ where: { serverId: guild.id } });
    await deleteConnections({ serverId: guild.id });

    connections.forEach(async (connection) => await logGuildLeaveToHub(connection.hubId, guild));

    await logGuildLeave(guild, Constants.Channels.goal);
  }
}
