import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import db from '../../../../utils/Db.js';
import BlacklistCommand from './index.js';
import BlacklistManager from '../../../../managers/BlacklistManager.js';
import parse from 'parse-duration';
import { emojis } from '../../../../utils/Constants.js';

export default class Server extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const hub = interaction.options.getString('hub', true);

    const hubInDb = await db.hubs.findFirst({ where: {
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

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const userId = interaction.options.getString('user', true);
    const reason = interaction.options.getString('reason');
    const duration = parse(`${interaction.options.getString('duration')}`);

    const blacklistManager = interaction.client.getBlacklistManager();

    if (subcommandGroup == 'add') {
      // get ID if user inputted a @ mention
      const userOpt = userId.replaceAll(/<@|!|>/g, '');
      // find user through username if they are cached or fetch them using ID
      const user = interaction.client.users.cache.find((u) => u.username === userOpt) ??
        await interaction.client.users.fetch(userOpt).catch(() => null);

      if (!user) return interaction.followUp('Could not find user. Use an ID instead.');
      // if (user.id === interaction.user.id) return interaction.followUp('You cannot blacklist yourself.');
      if (user.id === interaction.client.user?.id) return interaction.followUp('You cannot blacklist the bot wtf.');

      const userInBlacklist = await BlacklistManager.fetchUserBlacklist(hubInDb.id, userOpt);
      if (userInBlacklist) {
        interaction.followUp(`**${user.username}** is already blacklisted.`);
        return;
      }

      const expires = duration ? new Date(Date.now() + duration) : undefined;
      await blacklistManager.addUserBlacklist(hubInDb.id, user.id, String(reason), interaction.user.id, expires);
      if (expires) blacklistManager.scheduleRemoval('user', user.id, hubInDb.id, expires);
      blacklistManager.notifyBlacklist('user', user.id, hubInDb.id, expires, String(reason));

      const successEmbed = new EmbedBuilder()
        .setDescription(`${emojis.tick} **${user.username}** has been successfully blacklisted!`)
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
      const result = await blacklistManager.removeBlacklist('user', hubInDb.id, userId);
      if (!result) return interaction.followUp('The inputted user is not blacklisted.');


      const user = await interaction.client.users.fetch(userId).catch(() => null);
      await interaction.followUp(`**${user?.username}** has been removed from the blacklist.`);

      // TODO: Logging
      // if (user) {
      //   modActions(interaction.user, {
      //     user,
      //     action: 'unblacklistUser',
      //     blacklistedFor: blacklistedUser.hubs.find(({ hubId }) => hubId === hubInDb.id)?.reason,
      //     hubId: hubInDb.id,
      //   });
      // }
    }
  }
}