import type { RepliableInteraction, User } from 'discord.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';
import Logger from '#utils/Logger.js';

export const handleBan = async (
  interaction: RepliableInteraction,
  targetId: string,
  target: User | null,
  reason: string,
) => {
  if (targetId === interaction.user.id) {
    await interaction.reply({
      content: `Let's not go there. ${getEmoji('bruhcat', interaction.client)}`,
      flags: ['Ephemeral'],
    });
    return;
  }

  const { userManager } = interaction.client;
  const dbUser = await userManager.getUser(targetId);

  if (dbUser?.banReason) {
    await interaction.reply({
      content: `${getEmoji('slash', interaction.client)} This user is already banned.`,
      flags: ['Ephemeral'],
    });
    return;
  }

  const targetUsername = target?.username;
  await userManager.ban(targetId, reason, targetUsername);

  Logger.info(`User ${targetUsername} (${targetId}) banned by ${interaction.user.username}.`);

  await interaction.reply(
    `${getEmoji('tick', interaction.client)} Successfully banned \`${targetUsername}\`. They can no longer use the bot.`,
  );
};
