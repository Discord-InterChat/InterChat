import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { constants, getDb } from '../../Utils/utils';
import { randomUUID } from 'crypto';
import emojis from '../../Utils/JSON/emoji.json';

export default {
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const db = getDb();
    const user = interaction.options.getUser('user', true);
    const userWarns = await db.userWarns.findFirst({ where: { userId: user.id } });

    const warning = {
      id: randomUUID(),
      reason: interaction.options.getString('reason', true),
      moderatorId: interaction.user.id,
      timestamp: new Date(),
      automated: false,
    };

    if (!userWarns) {
      await db.userWarns.create({
        data: { userId: user.id, userTag: user.tag, warnings: [warning] },
      });
    }
    else {
      await db.userWarns.update({
        where: { userId: userWarns.userId },
        data: {
          userId: user.id,
          userTag: user.tag,
          warnings: [...userWarns.warnings, warning],
        },
      });
    }

    const notifyEmbed = new EmbedBuilder()
      .setTitle('🔨 You have been warned!')
      .setDescription('You have issued warn in the network.')
      .addFields([
        { name: 'Warning', value: `#${userWarns ? userWarns.warnings.length + 1 : 1}`, inline: true },
        { name: 'Reason', value: warning.reason, inline: true },
      ])
      .setFooter({ text: 'Join the support server if you you think the reason is not valid.', iconURL: interaction.client.user.avatarURL() || undefined })
      .setTimestamp()
      .setColor(constants.colors.invisible);

    const notified = await user.send({ embeds: [notifyEmbed] }).catch(() => null);
    await interaction.editReply(` ${emojis.normal.yes} Warned ${user.tag}! ${notified ? 'Notified them about their warn.' : 'I couldn\'t DM them.'}`);
  },
};
