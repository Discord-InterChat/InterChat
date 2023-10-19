import { captureException } from '@sentry/node';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { emojis } from '../../../../utils/Constants.js';
import db from '../../../../utils/Db.js';
import BlacklistCommand from './index.js';
import Logger from '../../../../utils/Logger.js';
import BlacklistManager from '../../../../structures/BlacklistManager.js';
import parse from 'parse-duration';

export default class UserBlacklist extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const hub = interaction.options.getString('hub', true);

    const hubInDb = await db.hubs.findFirst({
      where: {
        name: hub,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id } } },
        ],
      },
    });

    if (!hubInDb) {
      return await interaction.reply({
        content: 'Unknown hub. Make sure you are the owner or a moderator of the hub.',
        ephemeral: true,
      });
    }

    // defer the reply as it may take a while to fetch and stuff
    await interaction.deferReply();

    const blacklistManager = interaction.client.getBlacklistManager();
    const subCommandGroup = interaction.options.getSubcommandGroup();
    const serverOpt = interaction.options.getString('server', true);

    if (subCommandGroup == 'add') {
      const reason = interaction.options.getString('reason', true);
      const duration = parse(`${interaction.options.getString('duration')}`);
      const expires = duration ? new Date(Date.now() + duration) : undefined;

      const serverInBlacklist = await BlacklistManager.fetchServerBlacklist(hubInDb.id, serverOpt);
      if (serverInBlacklist) {return await interaction.followUp('The server is already blacklisted.');}

      const server = await interaction.client.guilds.fetch(serverOpt).catch(() => null);
      if (!server) return await interaction.followUp('You have inputted an invalid server ID.');

      try {
        await blacklistManager.addServerBlacklist(server.id, hubInDb.id, reason, expires);
      }
      catch (err) {
        Logger.error(err);
        captureException(err);
        interaction.followUp(
          `Failed to blacklist **${server.name}**. Enquire with the bot developer for more information.`,
        );
        return;
      }

      if (expires && interaction.guildId) {blacklistManager.scheduleRemoval('server', interaction.guildId, hubInDb.id, expires);}

      const successEmbed = new EmbedBuilder()
        .setDescription(`${emojis.tick} **${server.name}** has been successfully blacklisted!`)
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

      const connected = await db.connectedList.findFirst({
        where: { serverId: serverOpt, hubId: hubInDb.id },
      });
      if (connected) {
        // notify the server that they have been blacklisted
        const channel = await interaction.client.channels
          .fetch(connected.channelId)
          .catch(() => null);
        if (channel?.isTextBased()) {blacklistManager.notifyBlacklist(channel, hubInDb.id, expires, reason).catch(() => null);}

        // delete the connected channel from db so they can't reconnect
        await db.connectedList.delete({ where: { channelId: connected.channelId } });
      }
    }
    else if (subCommandGroup == 'remove') {
      const blacklistedServer = await db.blacklistedServers.findFirst({
        where: { serverId: serverOpt, hubs: { some: { hubId: hubInDb.id } } },
      });
      if (!blacklistedServer) {
        return await interaction.followUp({
          content: 'The server is not blacklisted.',
          ephemeral: true,
        });
      }

      await blacklistManager.removeBlacklist('server', hubInDb.id, blacklistedServer.serverId);

      // Using name from DB since the bot can't access server through API.
      await interaction.followUp(
        `The server **${blacklistedServer.serverName}** has been removed from the blacklist.`,
      );
    }
  }
}
