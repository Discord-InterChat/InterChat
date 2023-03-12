import { ApplicationCommandType, AttachmentBuilder, ContextMenuCommandBuilder, EmbedBuilder, MessageContextMenuCommandInteraction } from 'discord.js';
import { badgeToEmoji, colors, getDb } from '../../Utils/functions/utils';
import { profileImage } from 'discord-arts';

export default {
  data: new ContextMenuCommandBuilder()
    .setName('User Info')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const db = getDb();
    const target = interaction.targetId;
    const emoji = interaction.client.emoji.normal;
    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: target } } },
    });

    if (!messageInDb) return interaction.reply({ content: 'This message has expired! Please try another message.', ephemeral: true });
    const user = await interaction.client.users.fetch(messageInDb.authorId, { force: true }).catch(() => null);
    if (!user) return interaction.reply(`${emoji.no} Unable to fetch user details.`);

    const userBadgesRaw = await db.userBadges.findFirst({ where: { userId: user.id } });
    const createdAt = Math.round(user.createdTimestamp / 1000);

    const userBadges = userBadgesRaw ? badgeToEmoji(userBadgesRaw?.badges) || 'No Badges.' : 'No Badges.';


    const embed = new EmbedBuilder()
      .setTitle(user.tag)
      .setThumbnail(user.avatarURL() ?? user.defaultAvatarURL)
      .setColor(colors('invisible'))
      .setImage('attachment://customCard.png') // link to image that will be generated afterwards
      .setDescription(userBadges)
      .addFields({
        name: 'General Info',
        value: `**Name:** ${user.tag}\n**Bot Account:** ${user.bot}\n**Created:** <t:${createdAt}:D> (<t:${createdAt}:R>)`,
      })
      .setFooter({ text:`ID: ${user.id}` });

    await interaction.reply({ content: `${emoji.loading} Generating profile card...`, embeds: [embed], ephemeral: true });

    // generate the profile card
    const customCard = new AttachmentBuilder(await profileImage(user.id), { name: 'customCard.png' });
    await interaction.editReply({ content: '', files: [customCard] });
  },
};
