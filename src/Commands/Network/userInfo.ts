import { ApplicationCommandType, ContextMenuCommandBuilder, EmbedBuilder, MessageContextMenuCommandInteraction } from 'discord.js';
import { badgeToEmoji, colors, getDb } from '../../Utils/functions/utils';

export default {
  data: new ContextMenuCommandBuilder()
    .setName('User Info')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const db = getDb();
    const target = interaction.targetId;
    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: target } } },
    });

    if (!messageInDb) return interaction.reply({ content: 'This message has expired! Please try another message.', ephemeral: true });
    const user = await interaction.client.users.fetch(messageInDb.authorId, { force: true }).catch(() => null);
    if (!user) return interaction.reply(`${interaction.client.emoji.normal.no} Something went wrong while trying to get user details.`);

    const userBadgesRaw = await db.userBadges.findFirst({ where: { userId: user.id } });
    const createdAt = Math.round(user.createdTimestamp / 1000);

    const userBadges = userBadgesRaw ? badgeToEmoji(userBadgesRaw?.badges) || 'No Badges.' : 'No Badges.';

    const embed = new EmbedBuilder()
      .setTitle(user.tag)
      .setThumbnail(user.avatarURL() ?? user.defaultAvatarURL)
      .setImage(user.bannerURL({ size: 2048 }) ?? null)
      .setColor(colors('invisible'))
      .addFields(
        {
          name: 'Badges',
          value: userBadges,
        },
        {
          name: 'General Info',
          value: `**ID:** ${user.id}\n**Discrim:** ${user.tag}\n**Bot Account:** ${user.bot}\n**Created:** <t:${createdAt}:d> (<t:${createdAt}:R>)`,
        },
      )
      .setFooter({ text:`ID: ${user.id}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
