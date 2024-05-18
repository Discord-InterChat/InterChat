import { ChatInputCommandInteraction, EmbedBuilder, time } from 'discord.js';
import db from '../../../../utils/Db.js';
import BlacklistCommand from './index.js';
import BlacklistManager from '../../../../managers/BlacklistManager.js';
import parse from 'parse-duration';
import { emojis } from '../../../../utils/Constants.js';
import { simpleEmbed } from '../../../../utils/Utils.js';
import { t } from '../../../../utils/Locale.js';
import Logger from '../../../../utils/Logger.js';
import { captureException } from '@sentry/node';
import { logBlacklist, logUnblacklist } from '../../../../utils/HubLogger/ModLogs.js';

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
          simpleEmbed(
            t(
              { phrase: 'hub.notFound_mod', locale: interaction.user.locale },
              { emoji: emojis.no },
            ),
          ),
        ],
      });
    }

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const userId = interaction.options.getString('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided.';
    const duration = parse(`${interaction.options.getString('duration')}`);

    const blacklistManager = interaction.client.blacklistManager;

    if (subcommandGroup === 'add') {
      // get ID if user inputted a @ mention
      const userOpt = userId.replaceAll(/<@|!|>/g, '');
      // find user through username if they are cached or fetch them using ID
      const user =
        interaction.client.users.cache.find((u) => u.username === userOpt) ??
        (await interaction.client.users.fetch(userOpt).catch(() => null));

      if (!user) {
        return interaction.followUp(
          t(
            { phrase: 'errors.userNotFound', locale: interaction.user.locale },
            { emoji: emojis.no },
          ),
        );
      }

      // if (user.id === interaction.user.id) {
      //   return await interaction.followUp('You cannot blacklist yourself.');
      // }
      else if (user.id === interaction.client.user?.id) {
        return interaction.followUp(
          t({
            phrase: 'blacklist.easterEggs.blacklistBot',
            locale: interaction.user.locale,
          }),
        );
      }

      const userInBlacklist = await BlacklistManager.fetchUserBlacklist(hubInDb.id, userOpt);
      if (userInBlacklist) {
        await interaction.followUp(
          t(
            { phrase: 'blacklist.user.alreadyBlacklisted', locale: interaction.user.locale },
            { emoji: emojis.no },
          ),
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
      await blacklistManager
        .notifyBlacklist('user', user.id, hubInDb.id, expires, reason)
        .catch((e) => {
          Logger.error(e);
          captureException(e);
        });

      const successEmbed = new EmbedBuilder()
        .setDescription(
          t(
            { phrase: 'blacklist.user.success', locale: interaction.user.locale },
            { username: user.username, emoji: emojis.tick },
          ),
        )
        .setColor('Green')
        .addFields(
          {
            name: 'Reason',
            value: reason,
            inline: true,
          },
          {
            name: 'Expires',
            value: expires ? `${time(Math.round(expires.getTime() / 1000), 'R')}` : 'Never.',
            inline: true,
          },
        );

      await interaction.followUp({ embeds: [successEmbed] });

      // send log to hub's log channel
      await logBlacklist(hubInDb.id, {
        userOrServer: user,
        mod: interaction.user,
        reason,
        expires,
      });
    }
    else if (subcommandGroup === 'remove') {
      // remove the blacklist
      const result = await blacklistManager.removeBlacklist('user', hubInDb.id, userId);
      if (!result) {
        return await interaction.followUp(
          t(
            { phrase: 'errors.userNotBlacklisted', locale: interaction.user.locale },
            { emoji: emojis.no },
          ),
        );
      }
      const user = await interaction.client.users.fetch(userId).catch(() => null);
      await interaction.followUp(
        t(
          { phrase: 'blacklist.user.removed', locale: interaction.user.locale },
          { emoji: emojis.delete, username: `${result.username}` },
        ),
      );
      if (user) {
        // send log to hub's log channel
        await logUnblacklist(hubInDb.id, {
          type: 'user',
          userOrServerId: user.id,
          mod: interaction.user,
          reason,
        });
      }
    }
  }
}
