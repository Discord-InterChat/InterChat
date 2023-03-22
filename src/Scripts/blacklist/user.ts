import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { cancelJob } from 'node-schedule';
import { colors, getDb, addUserBlacklist } from '../../Utils/functions/utils';
import { modActions } from '../networkLogs/modActions';
import logger from '../../Utils/logger';

export = {
  async execute(interaction: ChatInputCommandInteraction) {
    let userOpt = interaction.options.getString('user', true);
    const reason = interaction.options.getString('reason');
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const emoji = interaction.client.emotes.normal;

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

      try {
        const expireString = expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never';
        const embed = new EmbedBuilder()
          .setTitle(emoji.blobFastBan + ' Blacklist Notification')
          .setDescription('You have been muted from talking in the network.')
          .setColor(colors('chatbot'))
          .setFields(
            { name: 'Reason', value: String(reason), inline: true },
            { name: 'Expires', value: expireString, inline: true },
          )
          .setFooter({ text: 'Join the support server to appeal the blacklist.' });

        await user.send({ embeds: [embed] });
      }
      catch {
        await blacklistedUsers.update({ where: { userId: user.id }, data: { notified: false } });
        logger.info(`Could not notify ${user.tag} about their blacklist.`);
      }
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
