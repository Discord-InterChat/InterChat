import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getDb } from '../../Utils/utils';
import { addServerBlacklist, fetchServerBlacklist, notifyBlacklist, removeBlacklist, scheduleUnblacklist } from '../../Utils/blacklist';
import { hubs } from '@prisma/client';
import { captureException } from '@sentry/node';
import parse from 'parse-duration';
import logger from '../../Utils/logger';
import emojis from '../../Utils/JSON/emoji.json';

export default {
  async execute(interaction: ChatInputCommandInteraction, hub: hubs) {
    // defer the reply as it may take a while to fetch and stuff
    await interaction.deferReply();

    const db = getDb();
    const subCommandGroup = interaction.options.getSubcommandGroup();
    const serverOpt = interaction.options.getString('server', true);

    if (subCommandGroup == 'add') {
      const reason = interaction.options.getString('reason', true);
      const duration = parse(`${interaction.options.getString('duration')}`);
      const expires = duration ? new Date(Date.now() + duration) : undefined;

      const serverInBlacklist = await fetchServerBlacklist(hub.id, serverOpt);
      if (serverInBlacklist) return await interaction.followUp('The server is already blacklisted.');

      const server = await interaction.client.guilds.fetch(serverOpt).catch(() => null);
      if (!server) return interaction.followUp('You have inputted an invalid server ID.');

      try {
        await addServerBlacklist(server.id, interaction.user, hub.id, reason, expires);
      }
      catch (err) {
        logger.error(err);
        captureException(err);
        interaction.followUp(`Failed to blacklist **${server.name}**. Enquire with the bot developer for more information.`);
        return;
      }

      if (expires && interaction.guildId) scheduleUnblacklist('server', interaction.client, interaction.guildId, hub.id, expires);

      const successEmbed = new EmbedBuilder()
        .setDescription(`${emojis.normal.tick} **${server.name}** has been successfully blacklisted!`)
        .setColor('Green')
        .addFields(
          {
            name: 'Reason',
            value: reason ? reason : 'No reason provided.',
            inline: true,
          },
          {
            name: 'Expires',
            value: expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never.',
            inline: true,
          },
        );

      await interaction.followUp({ embeds: [successEmbed] });

      const connected = await db.connectedList.findFirst({ where: { serverId: serverOpt, hubId: hub.id } });
      if (connected) {
        // notify the server that they have been blacklisted
        const channel = await interaction.client.channels.fetch(connected.channelId).catch(() => null);
        if (channel?.isTextBased()) notifyBlacklist(channel, hub.id, expires, reason).catch(() => null);

        // delete the connected channel from db so they can't reconnect
        await db.connectedList.delete({ where: { channelId: connected.channelId } });
      }
    }

    else if (subCommandGroup == 'remove') {
      const blacklistedServer = await db.blacklistedServers.findFirst({ where: { serverId: serverOpt } });
      if (!blacklistedServer) return await interaction.followUp({ content: 'The server is not blacklisted.', ephemeral: true });

      await removeBlacklist('server', hub.id, blacklistedServer.serverId);

      // Using name from DB since the bot can't access server through API.
      interaction.followUp(`The server **${blacklistedServer.serverName}** has been removed from the blacklist.`);
    }
  },
};
