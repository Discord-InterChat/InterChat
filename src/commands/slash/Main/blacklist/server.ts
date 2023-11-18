import { captureException } from '@sentry/node';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { emojis } from '../../../../utils/Constants.js';
import db from '../../../../utils/Db.js';
import BlacklistCommand from './index.js';
import BlacklistManager from '../../../../managers/BlacklistManager.js';
import parse from 'parse-duration';
import NetworkLogger from '../../../../utils/NetworkLogger.js';
import { errorEmbed } from '../../../../utils/Utils.js';

export default class UserBlacklist extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    // defer the reply as it may take a while to fetch and stuff
    await interaction.deferReply();

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
      return await interaction.editReply({
        embeds: [
          errorEmbed(
            `${emojis.no} Unknown hub. Make sure you are the owner or a moderator of the hub.`,
          ),
        ],
      });
    }

    const blacklistManager = interaction.client.getBlacklistManager();
    const subCommandGroup = interaction.options.getSubcommandGroup();
    const serverOpt = interaction.options.getString('server', true);

    const networkLogger = new NetworkLogger(hubInDb.id);

    if (subCommandGroup == 'add') {
      const reason = interaction.options.getString('reason', true);
      const duration = parse(`${interaction.options.getString('duration')}`);
      const expires = duration ? new Date(Date.now() + duration) : undefined;

      const serverInBlacklist = await BlacklistManager.fetchServerBlacklist(hubInDb.id, serverOpt);
      if (serverInBlacklist) {
        return await interaction.followUp('The server is already blacklisted.');
      }

      const server = await interaction.client.guilds.fetch(serverOpt).catch(() => null);
      if (!server) return await interaction.followUp('You have inputted an invalid server ID.');

      try {
        await blacklistManager.addServerBlacklist(
          server.id,
          hubInDb.id,
          reason,
          interaction.user.id,
          expires,
        );
      }
      catch (err) {
        interaction.client.logger.error(err);
        captureException(err);
        interaction.followUp(
          `Failed to blacklist **${server.name}**. Enquire with the bot developer for more information.`,
        );
        return;
      }

      if (expires && interaction.guildId) {
        blacklistManager.scheduleRemoval('server', interaction.guildId, hubInDb.id, expires);
      }

      const successEmbed = new EmbedBuilder()
        .setDescription(`${emojis.tick} **${server.name}** has been successfully blacklisted!`)
        .setColor('Green')
        .addFields(
          {
            name: 'Reason',
            value: reason ?? 'No reason provided.',
            inline: true,
          },
          {
            name: 'Expires',
            value: expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never.',
            inline: true,
          },
        );

      await interaction.followUp({ embeds: [successEmbed] });

      // notify the server that they have been blacklisted
      blacklistManager.notifyBlacklist('server', serverOpt, hubInDb.id, expires, reason);

      // delete all connections from db so they can't reconnect to the hub
      await db.connectedList.deleteMany({ where: { serverId: server.id, hubId: hubInDb.id } });

      // send log to hub's log channel
      await networkLogger.logBlacklist(server, interaction.user, reason, expires);
    }
    else if (subCommandGroup == 'remove') {
      const result = await blacklistManager.removeBlacklist('server', hubInDb.id, serverOpt);
      if (!result) return await interaction.followUp('The server is not blacklisted.');

      // Using name from DB since the bot can't access server through API.
      await interaction.followUp(
        `The server **${result.serverName}** has been removed from the blacklist.`,
      );

      // send log to hub's log channel
      await networkLogger.logUnblacklist('user', serverOpt, interaction.user);
    }
  }
}
