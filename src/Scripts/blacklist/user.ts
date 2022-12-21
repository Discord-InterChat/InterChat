import { ChatInputCommandInteraction, User } from 'discord.js';
import { scheduleJob, cancelJob } from 'node-schedule';
import { getDb } from '../../Utils/functions/utils';
import { modActions } from '../networkLogs/modActions';
import logger from '../../Utils/logger';

export = {
  async execute(interaction: ChatInputCommandInteraction) {
    let userOpt = interaction.options.getString('user', true);
    const reason = interaction.options.getString('reason');
    const subcommandGroup = interaction.options.getSubcommandGroup();

    let user;
    const blacklistedUsers = getDb().blacklistedUsers;

    try {
      userOpt = userOpt.replaceAll(/<@|!|>/g, '');

      user = interaction.client.users.cache.find(u => u.tag === userOpt);
      if (user === undefined) user = await interaction.client.users.fetch(userOpt);
    }
    catch { return interaction.reply('Could not find user. Use an ID instead.'); }

    const userInBlacklist = await blacklistedUsers.findFirst({ where: { userId: user.id } });

    if (subcommandGroup == 'add') {
      const mins = interaction.options.getNumber('minutes');
      const hours = interaction.options.getNumber('hours');
      const days = interaction.options.getNumber('days');

      await interaction.deferReply();
      if (userInBlacklist) {
        interaction.followUp(`${user.username}#${user.discriminator} is already blacklisted.`);
        return;
      }
      if (user.id === interaction.user.id) return interaction.followUp('You cannot blacklist yourself.');
      if (user.id === interaction.client.user?.id) return interaction.followUp('You cannot blacklist the bot wtf.');


      if (!mins && !hours && !days) {
        await blacklistedUsers.create({
          data: {
            username: `${user.username}#${user.discriminator}`,
            userId: user.id,
            reason: String(reason),
            notified: true,
          },
        });
      }
      else {
        const date = new Date();

        mins ? date.setMinutes(date.getMinutes() + mins) : null;
        hours ? date.setHours(date.getHours() + hours) : null;
        days ? date.setDate(date.getDate() + days) : null;

        await blacklistedUsers.create({
          data: {
            username: `${user.username}#${user.discriminator}`,
            userId: user.id,
            reason: String(reason),
            expires: date,
            notified: true,
          },
        });

        scheduleJob(`blacklist_user-${user.id}`, date, async function(usr: User) {
          await getDb().blacklistedUsers.delete({ where: { userId: usr.id } });

          modActions(usr.client.user, {
            user: usr,
            action: 'unblacklistUser',
            reason: 'Blacklist expired for user.',
            timestamp: new Date(),
          });
        }.bind(null, user));
      }
      try {
        await user.send(`You have been blacklisted from using this bot for reason **${reason}**. Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
      }
      catch {
        await blacklistedUsers.update({ where: { userId: user.id }, data: { notified: false } });
        logger.info(`Could not notify ${user.username}#${user.discriminator} about their blacklist.`);
      }

      interaction.followUp(`**${user.username}#${user.discriminator}** has been blacklisted.`);

      modActions(interaction.user, {
        user,
        action: 'blacklistUser',
        timestamp: new Date(),
        reason,
      });
    }
    else if (subcommandGroup == 'remove') {
      if (!userInBlacklist) return interaction.reply(`The user ${user} is not blacklisted.`);

      await blacklistedUsers.delete({ where: { userId: user.id } });
      interaction.reply(`**${user.username}#${user.discriminator}** has been removed from the blacklist.`);

      cancelJob(`blacklist-${user.id}`);
      modActions(interaction.user, {
        user,
        action: 'unblacklistUser',
        timestamp: new Date(),
        reason,
      });
    }
  },
};
