import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import db from '../../../../utils/Db.js';
import BlacklistCommand from './index.js';
import BlacklistManager from '../../../../managers/BlacklistManager.js';
import parse from 'parse-duration';
import { emojis } from '../../../../utils/Constants.js';
import NetworkLogger from '../../../../utils/NetworkLogger.js';
import { simpleEmbed } from '../../../../utils/Utils.js';
import { __ } from '../../../../utils/Locale.js';

export default class Server extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction) {
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
          simpleEmbed(__({ phrase: 'hub.notFound_mod', locale: interaction.user.locale })),
        ],
      });
    }

    const networkLogger = new NetworkLogger(hubInDb.id);

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const userId = interaction.options.getString('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided.';
    const duration = parse(`${interaction.options.getString('duration')}`);

    const blacklistManager = interaction.client.getBlacklistManager();

    if (subcommandGroup == 'add') {
      // get ID if user inputted a @ mention
      const userOpt = userId.replaceAll(/<@|!|>/g, '');
      // find user through username if they are cached or fetch them using ID
      const user =
        interaction.client.users.cache.find((u) => u.username === userOpt) ??
        (await interaction.client.users.fetch(userOpt).catch(() => null));

      if (!user) {
        return interaction.followUp(
          __({ phrase: 'errors.userNotFound', locale: interaction.user.locale }),
        );
      }

      // if (user.id === interaction.user.id) {
      //   return await interaction.followUp('You cannot blacklist yourself.');
      // }
      else if (user.id === interaction.client.user?.id) {
        return interaction.followUp(
          __({
            phrase: 'blacklist.easterEggs.blacklistBot',
            locale: interaction.user.locale,
          }),
        );
      }

      const userInBlacklist = await BlacklistManager.fetchUserBlacklist(hubInDb.id, userOpt);
      if (userInBlacklist) {
        await interaction.followUp(
          __({ phrase: 'blacklist.user.alreadyBlacklisted', locale: interaction.user.locale }),
        );
        return;
      }

      const expires = duration ? new Date(Date.now() + duration) : undefined;
      await blacklistManager.addUserBlacklist(
        hubInDb.id,
        user.id,
        reason,
        interaction.user.id,
        expires,
      );
      if (expires) blacklistManager.scheduleRemoval('user', user.id, hubInDb.id, expires);
      blacklistManager.notifyBlacklist('user', user.id, hubInDb.id, expires, reason);

      const successEmbed = new EmbedBuilder()
        .setDescription(__({ phrase: 'blacklist.user.success', locale: interaction.user.locale }))
        .setColor('Green')
        .addFields(
          {
            name: 'Reason',
            value: reason,
            inline: true,
          },
          {
            name: 'Expires',
            value: expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never.',
            inline: true,
          },
        );

      await interaction.followUp({ embeds: [successEmbed] });

      // send log to hub's log channel
      await networkLogger.logBlacklist(user, interaction.user, reason, expires);
    }
    else if (subcommandGroup == 'remove') {
      // remove the blacklist
      const result = await blacklistManager.removeBlacklist('user', hubInDb.id, userId);
      if (!result) {
        return await interaction.followUp(
          __({ phrase: 'errors.userNotBlacklisted', locale: interaction.user.locale }),
        );
      }
      const user = await interaction.client.users.fetch(userId).catch(() => null);
      await interaction.followUp(
        __(
          { phrase: 'blacklist.user.removed', locale: interaction.user.locale },
          { emoji: emojis.delete, server: result.username },
        ),
      );
      if (user) {
        // send log to hub's log channel
        await networkLogger.logUnblacklist('user', user.id, interaction.user, { reason });
      }
    }
  }
}
