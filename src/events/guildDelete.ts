import type { Guild } from 'discord.js';
import BaseEventListener from '#src/core/BaseEventListener.js';
import { deleteConnections } from '#utils/ConnectedListUtils.js';
import Constants from '#utils/Constants.js';
import { logGuildLeave } from '#utils/GuildUtils.js';
import Logger from '#utils/Logger.js';
import { logGuildLeaveToHub } from '#utils/hub/logger/JoinLeave.js';

export default class Ready extends BaseEventListener<'guildDelete'> {
  readonly name = 'guildDelete';
  public async execute(guild: Guild) {
    if (!guild.available) return;

    Logger.info(`Left ${guild.name} (${guild.id})`);

    const deletedConnections = await deleteConnections({ serverId: guild.id });

    deletedConnections.forEach(async (connection) => {
      if (connection) await logGuildLeaveToHub(connection.hubId, guild);
    });

    await logGuildLeave(guild, Constants.Channels.goal);
  }
}
