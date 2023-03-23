import { ChatInputCommandInteraction } from 'discord.js';
import { cancelJob } from 'node-schedule';
import { getDb, addUserBlacklist } from '../../Utils/functions/utils';
import { modActions } from '../networkLogs/modActions';

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
      await interaction.deferReply();

      let expires: Date | undefined;
      const mins = interaction.options.getNumber('minutes');
      const hours = interaction.options.getNumber('hours');
      const days = interaction.options.getNumber('days');

      if (userInBlacklist) {
        interaction.followUp(`${user.username}#${user.discriminator} is already blacklisted.`);
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

      await addUserBlacklist(interaction.user, user, String(reason), expires);
      interaction.followUp(`**${user.tag}** has been blacklisted for reason \`${reason}\`.`);
    }


    else if (subcommandGroup == 'remove') {
      if (!userInBlacklist) return interaction.reply(`The user **${user.tag}** is not blacklisted.`);
      const userBeforeUnblacklist = await blacklistedUsers.findFirst({ where: { userId: user.id } });

      await blacklistedUsers.delete({ where: { userId: user.id } });
      interaction.reply(`**${user.username}#${user.discriminator}** has been removed from the blacklist.`);

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
