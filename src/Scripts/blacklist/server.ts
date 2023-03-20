import { ChatInputCommandInteraction } from 'discord.js';
import { getDb, addServerBlacklist } from '../../Utils/functions/utils';
import { modActions } from '../networkLogs/modActions';

module.exports = {
  async execute(interaction: ChatInputCommandInteraction) {
    const serverOpt = interaction.options.getString('server', true);
    const reason = interaction.options.getString('reason');
    const subCommandGroup = interaction.options.getSubcommandGroup();

    const { blacklistedServers, setup } = getDb();
    const serverInBlacklist = await blacklistedServers.findFirst({ where: { serverId: serverOpt } });

    if (subCommandGroup == 'add') {
      await interaction.deferReply();
      if (serverInBlacklist) return await interaction.followUp('The server is already blacklisted.');

      const server = await interaction.client.guilds.fetch(serverOpt).catch(() => null);
      if (!server) return interaction.followUp('Invalid server ID.');

      const serverSetup = await setup.findFirst({ where: { guildId: serverOpt } });

      let expires: Date | undefined;
      const mins = interaction.options.getNumber('minutes');
      const hours = interaction.options.getNumber('hours');
      const days = interaction.options.getNumber('days');

      if (mins || hours || days) {
        expires = new Date();
        mins ? expires.setMinutes(expires.getMinutes() + mins) : null;
        hours ? expires.setHours(expires.getHours() + hours) : null;
        days ? expires.setDate(expires.getDate() + days) : null;
      }

      await addServerBlacklist(interaction.user, server, String(reason), expires);
      interaction.followUp(`**${server.name}** has been blacklisted for reason \`${reason}\`.`);

      // TODO: Use embeds for notifications?
      if (serverSetup) {
        const { channelId } = serverSetup;
        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (channel?.isTextBased()) channel.send(`This server has been blacklisted from the network for reason \`${reason}\`. Join the support server and contact staff to appeal your blacklist.`).catch(() => null);
      }
      await server.leave();
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
