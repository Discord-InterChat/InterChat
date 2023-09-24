import { hubs } from '@prisma/client';
import { captureException } from '@sentry/node';
import { logger } from '@sentry/utils';
import { ChatInputCommandInteraction } from 'discord.js';
import { getDb } from '../../Utils/utils';
import { modActions } from '../networkLogs/modActions';
import { addServerBlacklist, notifyBlacklist, removeBlacklist, scheduleUnblacklist } from '../../Utils/blacklist';

export default {
  async execute(interaction: ChatInputCommandInteraction, hub: hubs) {
    const serverOpt = interaction.options.getString('server', true);
    const subCommandGroup = interaction.options.getSubcommandGroup();

    const { blacklistedServers, connectedList } = getDb();
    const serverInBlacklist = await blacklistedServers.findFirst({
      where: { serverId: serverOpt },
    });

    if (subCommandGroup == 'add') {
      await interaction.deferReply();
      const reason = interaction.options.getString('reason', true);

      if (serverInBlacklist) return await interaction.followUp('The server is already blacklisted.');

      const server = await interaction.client.guilds.fetch(serverOpt).catch(() => null);
      if (!server) return interaction.followUp('Invalid server ID.');

      const serverSetup = await connectedList.findFirst({ where: { serverId: serverOpt, hubId: hub.id } });

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

      try {
        await addServerBlacklist(server.id, interaction.user, hub.id, reason, expires);
        await connectedList.delete({ where: { channelId: serverSetup?.channelId } });
      }
      catch (err) {
        logger.error(err);
        captureException(err);
        interaction.followUp(`Failed to blacklist **${server.name}**. Enquire with the bot developer for more information.`);
      }

      if (expires && interaction.guildId) scheduleUnblacklist('server', interaction.client, interaction.guildId, hub.id, expires);
      await interaction.followUp(`Blacklisted **${server.name}** for reason \`${reason}\`.`);


      // TODO: Use embeds for notifications?
      if (serverSetup) {
        const channel = await interaction.client.channels.fetch(serverSetup.channelId);
        if (channel?.isTextBased()) notifyBlacklist(channel, hub.id, expires, reason).catch(() => null);
      }
    }
    else if (subCommandGroup == 'remove') {
      if (!serverInBlacklist) return await interaction.reply({ content: 'The server is not blacklisted.', ephemeral: true });
      await removeBlacklist('server', hub.id, serverInBlacklist.serverId);

      // Using name from DB since the bot can't access server through API.
      interaction.reply(`The server **${serverInBlacklist.serverName}** has been removed from the blacklist.`);

      modActions(interaction.user, {
        action: 'unblacklistServer',
        oldBlacklist: serverInBlacklist,
        hubId: hub.id,
        timestamp: new Date(),
      });
    }
  },
};
