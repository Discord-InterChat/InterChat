import type { RepliableInteraction, User } from 'discord.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import Logger from '#utils/Logger.js';
import UserDbService from '#src/services/UserDbService.js';
import type Context from '#src/core/CommandContext/Context.js';

export const handleBan = async (
  interaction: RepliableInteraction | Context,
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

  const userService = new UserDbService();
  const dbUser = await userService.getUser(targetId);

  if (dbUser?.banReason) {
    await interaction.reply({
      content: `${getEmoji('slash', interaction.client)} This user is already banned.`,
      flags: ['Ephemeral'],
    });
    return;
  }

  const targetUsername = target?.username;
  await userService.ban(targetId, reason, targetUsername);

  Logger.info(`User ${targetUsername} (${targetId}) banned by ${interaction.user.username}.`);

  await interaction.reply(
    `${getEmoji('tick', interaction.client)} Successfully banned \`${targetUsername}\`. They can no longer use the bot.`,
  );
};
