import { profileImage } from 'discord-arts';
import NetworkLeveling from '../../Structures/levels';
import { EmbedBuilder, SlashCommandBuilder, AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import { badgeToEmoji, getDb } from '../../Utils/functions/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Shows the user\'s rank')
    .addUserOption(option =>
      option
        .setRequired(false)
        .setName('user')
        .setDescription('Check another user\'s rank'),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const levels = new NetworkLeveling();

    const user = await levels.getUser(targetUser.id);
    if (!user) {
      return await interaction.reply({ embeds: [
        new EmbedBuilder()
          .setDescription(`**${targetUser?.id === interaction.user.id ? 'You' : targetUser.tag}** doesn't have any xp.. Chat to gain some xp.`)
          .setColor('Red'),
      ],
      });
    }

    const rankEmbed = new EmbedBuilder()
      .setDescription(`${targetUser.id === interaction.user.id ? 'You are' : `**${targetUser.username}** is`} currently level **${user.level}** and have **${user.xp}** XP (total)!`)
      .setColor('Green')
      .setImage('attachment://rank.png');

    await interaction.reply({ content: `${interaction.client.emoji.normal.loading} Generating card...`, embeds: [rankEmbed] });


    const badgesRaw = await getDb().userBadges.findFirst({ where: { userId: targetUser.id } });
    const badgeUrls: string[] = [];
    if (badgesRaw?.badges) {
      badgeToEmoji(badgesRaw?.badges).forEach(e => {
        const valid = interaction.client.emojis.cache.find(emote => emote.identifier === e.replace('<:', '').replace('>', ''))?.url;
        if (valid) badgeUrls.push(valid);
      });
    }

    const { currentXp, requiredXp } = levels.requiredXp(user.level, user.xp);
    const rankCard = new AttachmentBuilder(await profileImage(targetUser.id, {
      rankData: {
        currentXp,
        requiredXp,
        level: user.level,
      },
      badgesFrame: true,
      overwriteBadges: true,
      customBadges: badgeUrls,
    }), { name: 'rank.png' });

    await interaction.editReply({ content: '', files: [rankCard] });
  },

};
