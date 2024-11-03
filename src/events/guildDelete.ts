import Constants from '#main/config/Constants.js';
import BaseEventListener from '#main/core/BaseEventListener.js';
import { deleteConnections } from '#utils/ConnectedListUtils.js';
import { logGuildLeave } from '#utils/GuildUtils.js';
import { logGuildLeaveToHub } from '#utils/HubLogger/JoinLeave.js';
import Logger from '#utils/Logger.js';
import { Guild } from 'discord.js';

export default class Ready extends BaseEventListener<'guildDelete'> {
  readonly name = 'guildDelete';
  public async execute(guild: Guild) {
    if (!guild.available) return;

    Logger.info(`Left ${guild.name} (${guild.id})`);

    const deletedConnections = await deleteConnections({ serverId: guild.id });

    deletedConnections.forEach(
      async (connection) => await logGuildLeaveToHub(connection.hubId, guild),
    );

    await logGuildLeave(guild, Constants.Channels.goal);
  }
}
