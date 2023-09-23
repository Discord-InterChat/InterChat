import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { cancelJob } from 'node-schedule';
import { getDb } from '../../Utils/utils';
import { modActions } from '../networkLogs/modActions';
import emojis from '../../Utils/JSON/emoji.json';
import { addUserBlacklist, scheduleUnblacklist } from '../../Utils/blacklist';

export default {
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const hubName = interaction.options.getString('hub', true);
    const reason = interaction.options.getString('reason');
    let userOpt = interaction.options.getString('user', true);
    let user;


    try {
      userOpt = userOpt.replaceAll(/<@|!|>/g, '');
      user = interaction.client.users.cache.find(u => u.tag === userOpt);
      if (user === undefined) user = await interaction.client.users.fetch(userOpt);
    }
    catch {
      return interaction.reply('Could not find user. Use an ID instead.');
    }

    const db = getDb();
    const hubInDb = await db.hubs.findFirst({
      where: {
        name: hubName,
        OR: [
          { moderators: { some: { userId: interaction.user.id } } },
          { ownerId: interaction.user.id },
        ],
      },
    });
    if (!hubInDb) return await interaction.reply('Hub with that name not found. Or you are not a moderator of that hub.');

    const userInBlacklist = await db.blacklistedUsers.findFirst({ where: { userId: user.id } });
    if (subcommandGroup == 'add') {
      await interaction.deferReply();

      let expires: Date | undefined;
      const mins = interaction.options.getNumber('minutes');
      const hours = interaction.options.getNumber('hours');
      const days = interaction.options.getNumber('days');

      if (userInBlacklist) {
        interaction.followUp(`**${user.username}** is already blacklisted.`);
        return;
      }
      if (user.id === interaction.user.id) return interaction.followUp('You cannot blacklist yourself.');
      if (user.id === interaction.client.user?.id) return interaction.followUp('You cannot blacklist the bot wtf.');

      if (mins || hours || days) {
        expires = new Date();
        mins ? expires.setMinutes(expires.getMinutes() + mins) : null;
        hours ? expires.setHours(expires.getHours() + hours) : null;
        days ? expires.setDate(expires.getDate() + days) : null;
      }

      await addUserBlacklist(hubInDb.id, interaction.user, user, String(reason), expires);
      if (expires) scheduleUnblacklist('user', interaction.client, user.id, hubInDb.id, expires);

      const successEmbed = new EmbedBuilder()
        .setDescription(`${emojis.normal.tick} **${user.username}** has been successfully blacklisted!`)
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
    }


    else if (subcommandGroup == 'remove') {
      if (!userInBlacklist) return interaction.reply(`The user **@${user.username}** is not blacklisted.`);
      const userBeforeUnblacklist = await db.blacklistedUsers.findFirst({ where: { userId: user.id } });

      await db.blacklistedUsers.delete({ where: { userId: user.id } });
      interaction.reply(`**${user.username}** has been removed from the blacklist.`);

      cancelJob(`blacklist-${user.id}`);
      modActions(interaction.user, {
        user,
        action: 'unblacklistUser',
        blacklistReason: userBeforeUnblacklist?.reason,
        reason,
      });
    }
  },
};
