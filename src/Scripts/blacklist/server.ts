import { ChatInputCommandInteraction, Guild, GuildTextBasedChannel } from 'discord.js';
import { scheduleJob } from 'node-schedule';
import { getDb } from '../../Utils/functions/utils';
import { modActions } from '../networkLogs/modActions';

module.exports = {
  async execute(interaction: ChatInputCommandInteraction) {
    const serverOpt = interaction.options.getString('server', true);
    const reason = interaction.options.getString('reason', true);
    const subCommandGroup = interaction.options.getSubcommandGroup();

    const { blacklistedServers, setup } = getDb();
    const serverInBlacklist = await blacklistedServers.findFirst({ where: { serverId: serverOpt } });

    if (subCommandGroup == 'add') {
      if (serverInBlacklist) return await interaction.reply('The server is already blacklisted.');
      const server = await interaction.client.guilds.fetch(serverOpt).catch(() => null);
      if (!server) return interaction.reply('Invalid server ID.');

      const serverSetup = await setup.findFirst({ where: { guildId: serverOpt } });

      const mins = interaction.options.getNumber('minutes');
      const hours = interaction.options.getNumber('hours');
      const days = interaction.options.getNumber('days');

      if (!mins && !hours && !days) {
        await blacklistedServers.create({
          data: {
            serverName: server.name,
            serverId: serverOpt,
            reason: `${reason}`,
          },
        });
      }
      else {
        const date = new Date();
        mins ? date.setMinutes(date.getMinutes() + mins) : null;
        hours ? date.setHours(date.getHours() + hours) : null;
        days ? date.setDate(date.getDate() + days) : null;

        await blacklistedServers.create({
          data: {
            serverName: server.name,
            serverId: serverOpt,
            expires: date,
            reason: `${reason}`,
          },
        });
        scheduleJob(`blacklist_server-${server.id}`, date, async function(guild: Guild) {
          await getDb().blacklistedServers.delete({ where: { serverId: guild.id } });
        }.bind(null, server));
      }

      await interaction.reply(`**${server.name}** has been blacklisted for reason \`${reason}\`.`);

      if (serverSetup) {
        const { channelId } = serverSetup;
        const channel = await interaction.client.channels.fetch(channelId).catch(() => null) as GuildTextBasedChannel;
        channel?.send(`This server has been blacklisted from the network for reason \`${reason}\`. Join the support server and contact staff to appeal your blacklist.`).catch(() => null);
      }
      await server.leave();

      modActions(interaction.user, {
        guild: { id: server.id, resolved: server },
        action: 'blacklistServer',
        timestamp: new Date(),
        reason,
      });
    }
    else if (subCommandGroup == 'remove') {
      if (!serverInBlacklist) return await interaction.reply('The server is not blacklisted.');
      await blacklistedServers.delete({ where: { serverId: serverOpt } });

      // Using name from DB since the bot can't access server through API.
      interaction.reply(`The server **${serverInBlacklist.serverName}** has been removed from the blacklist.`);

      modActions(interaction.user, {
        dbGuild: serverInBlacklist,
        action: 'unblacklistServer',
        timestamp: new Date(),
        reason,
      });
    }
  },
};
