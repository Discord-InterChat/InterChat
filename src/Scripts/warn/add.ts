import { ChatInputCommandInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import crypto from 'crypto';

export = {
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const db = getDb();
    const user = interaction.options.getUser('user', true);
    const userWarns = await db.userWarns.findFirst({ where: { userId: user.id } });

    const emojis = interaction.client.emoji;

    const warning = {
      id: crypto.randomBytes(16).toString('hex'),
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

    // TODO: Send nicer embed like elara
    const notified = await user.send(`**${emojis.icons.exclamation} You have been warned in the network for:** ${warning.reason}`).catch(() => null);
    await interaction.editReply(` ${emojis.normal.yes} Warned ${user.tag}! ${notified ? 'Notified them about their warn.' : 'I couldn\'t DM them!'}`);
  },
};
