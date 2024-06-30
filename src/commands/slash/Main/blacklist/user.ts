import { ChatInputCommandInteraction, EmbedBuilder, time } from 'discord.js';
import db from '../../../../utils/Db.js';
import BlacklistCommand from './index.js';
import parse from 'parse-duration';
import { emojis } from '../../../../utils/Constants.js';
import { checkIfStaff, simpleEmbed } from '../../../../utils/Utils.js';
import { t } from '../../../../utils/Locale.js';
import Logger from '../../../../utils/Logger.js';
import { logBlacklist, logUserUnblacklist } from '../../../../utils/HubLogger/ModLogs.js';

export default class Server extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const hub = interaction.options.getString('hub', true);
    const hubInDb = await db.hubs.findFirst({ where: { name: hub } });

    const isStaffOrHubMod =
      hubInDb?.ownerId === interaction.user.id ||
      hubInDb?.moderators.find((mod) => mod.userId === interaction.user.id) ||
      checkIfStaff(interaction.user.id);

    if (!hubInDb || !isStaffOrHubMod) {
      await interaction.editReply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'hub.notFound_mod', locale: interaction.user.locale },
              { emoji: emojis.no },
            ),
          ),
        ],
      });
      return;
    }

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const userId = interaction.options.getString('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided.';
    const duration = parse(`${interaction.options.getString('duration')}`);

    const { userBlacklists } = interaction.client;

    if (subcommandGroup === 'add') {
      // get ID if user inputted a @ mention
      const userOpt = userId.replaceAll(/<@|!|>/g, '');
      // find user through username if they are cached or fetch them using ID
      const user =
        interaction.client.users.cache.find((u) => u.username === userOpt) ??
        (await interaction.client.users.fetch(userOpt).catch(() => null));

      if (!user) {
        await interaction.followUp(
          t(
            { phrase: 'errors.userNotFound', locale: interaction.user.locale },
            { emoji: emojis.no },
          ),
        );
        return;
      }

      // if (user.id === interaction.user.id) {
      //   return await interaction.followUp('You cannot blacklist yourself.');
      // }
      else if (user.id === interaction.client.user?.id) {
        await interaction.followUp(
          t({
            phrase: 'blacklist.easterEggs.blacklistBot',
            locale: interaction.user.locale,
          }),
        );
        return;
      }
      else if (user.id === interaction.user.id) {
        await interaction.reply({
          content: '<a:nuhuh:1256859727158050838> Nuh uh! You\'re stuck with us.',
          ephemeral: true,
        });
        return;
      }

      const userInBlacklist = await userBlacklists.fetchBlacklist(hubInDb.id, userOpt);
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
      await userBlacklists.addBlacklist(hubInDb.id, user, reason, interaction.user.id, expires);
      await userBlacklists
        .notifyUser(user, { hubId: hubInDb.id, expires, reason })
        .catch(Logger.error);

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
      await logBlacklist(hubInDb.id, interaction.client, {
        target: user,
        mod: interaction.user,
        reason,
        expires,
      });
    }
    else if (subcommandGroup === 'remove') {
      // remove the blacklist
      const result = await userBlacklists.removeBlacklist(hubInDb.id, userId);

      if (!result) {
        await interaction.followUp(
          t(
            { phrase: 'errors.userNotBlacklisted', locale: interaction.user.locale },
            { emoji: emojis.no },
          ),
        );
        return;
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
        await logUserUnblacklist(interaction.client, hubInDb.id, {
          userId: user.id,
          mod: interaction.user,
          reason,
        });
      }
    }
  }
}
