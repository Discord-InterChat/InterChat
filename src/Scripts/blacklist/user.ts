import { hubs } from '@prisma/client';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { modActions } from '../networkLogs/modActions';
import { addUserBlacklist, fetchUserBlacklist, notifyBlacklist, removeBlacklist, scheduleUnblacklist } from '../../Utils/blacklist';
import emojis from '../../Utils/JSON/emoji.json';
import parse from 'parse-duration';

export default {
  async execute(interaction: ChatInputCommandInteraction, hub: hubs) {
    await interaction.deferReply();

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const userId = interaction.options.getString('user', true);
    const reason = interaction.options.getString('reason');
    const duration = parse(`${interaction.options.getString('duration')}`);

    const expires = duration ? new Date(Date.now() + duration) : undefined;

    if (subcommandGroup == 'add') {
      // get ID if user inputted a @ mention
      const userOpt = userId.replaceAll(/<@|!|>/g, '');
      // find user through username if they are cached or fetch them using ID
      const user = interaction.client.users.cache.find((u) => u.username === userOpt) ??
        await interaction.client.users.fetch(userOpt).catch(() => null);

      if (!user) return interaction.followUp('Could not find user. Use an ID instead.');
      if (user.id === interaction.user.id) return interaction.followUp('You cannot blacklist yourself.');
      if (user.id === interaction.client.user?.id) return interaction.followUp('You cannot blacklist the bot wtf.');

      const userInBlacklist = await fetchUserBlacklist(hub.id, userOpt);
      if (userInBlacklist) {
        interaction.followUp(`**${user.username}** is already blacklisted.`);
        return;
      }

      await addUserBlacklist(hub.id, interaction.user, user, String(reason), expires);
      if (expires) scheduleUnblacklist('user', interaction.client, user.id, hub.id, expires);
      notifyBlacklist(user, hub.id, expires, String(reason));

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
      const blacklistedUser = await fetchUserBlacklist(hub.id, userId);
      const user = await interaction.client.users.fetch(userId).catch(() => null);

      if (!blacklistedUser) return interaction.followUp('The inputted user is not blacklisted.');

      await removeBlacklist('user', hub.id, blacklistedUser.userId);
      await interaction.followUp(`**${user?.username || blacklistedUser?.username}** has been removed from the blacklist.`);

      if (user) {
        modActions(interaction.user, {
          user,
          action: 'unblacklistUser',
          blacklistedFor: blacklistedUser.hubs.find(({ hubId }) => hubId === hub.id)?.reason,
          hubId: hub.id,
        });
      }
    }
  },
};
