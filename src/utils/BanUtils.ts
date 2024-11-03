import { emojis } from '#utils/Constants.js';
import Logger from '#utils/Logger.js';
import type { RepliableInteraction, User } from 'discord.js';

export const handleBan = async (
  interaction: RepliableInteraction,
  targetId: string,
  target: User | null,
  reason: string,
) => {
  if (targetId === interaction.user.id) {
    await interaction.reply({ content: `Let's not go there. ${emojis.bruhcat}`, ephemeral: true });
    return;
  }

  const { userManager } = interaction.client;
  const dbUser = await userManager.getUser(targetId);

  if (dbUser?.banMeta) {
    await interaction.reply({
      content: `${emojis.slash} This user is already banned.`,
      ephemeral: true,
    });
    return;
  }

  const targetUsername = target?.username;
  await userManager.ban(targetId, reason, targetUsername);

  Logger.info(`User ${targetUsername} (${targetId}) banned by ${interaction.user.username}.`);

  await interaction.reply(
    `${emojis.tick} Successfully banned \`${targetUsername}\`. They can no longer use the bot.`,
  );
};
