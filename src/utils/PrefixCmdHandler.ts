import type BasePrefixCommand from '#main/core/BasePrefixCommand.js';
import Logger from '#main/utils/Logger.js';
import { isDev } from '#main/utils/Utils.js';
import { Message } from 'discord.js';

const handlePrefixCommand = async (message: Message, prefix: string) => {
  // Split message into command and arguments
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  // Find command by name or alias
  const command =
    message.client.prefixCommands.get(commandName) ||
    message.client.prefixCommands.find((cmd) =>
      (cmd as BasePrefixCommand).data.aliases?.includes(commandName),
    );

  if (!command) return;

  try {
    // Check if command is owner-only
    if (command.data.ownerOnly) {
      if (!isDev(message.author.id)) {
        await message.reply('This command can only be used by the bot owner.');
        return;
      }
    }

    // Check user permissions
    if (command.data.requiredUserPermissions?.length) {
      const missingPerms = command.data.requiredUserPermissions.filter(
        (perm) => !message.member?.permissions.has(perm),
      );

      if (missingPerms.length) {
        await message.reply(`You're missing the following permissions: ${missingPerms.join(', ')}`);
        return;
      }
    }

    // Check bot permissions
    if (command.data.requiredBotPermissions?.length) {
      const botMember = message.guild?.members.cache.get(message.client.user.id);
      const missingPerms = command.data.requiredBotPermissions.filter(
        (perm) => !botMember?.permissions.has(perm),
      );

      if (missingPerms.length) {
        await message.reply(`I'm missing the following permissions: ${missingPerms.join(', ')}`);
        return;
      }
    }

    // Execute command
    await command.execute(message as Message<true>, args);
  }
  catch (error) {
    Logger.error(error);
    await message.reply('There was an error executing this command!');
  }
};

export default handlePrefixCommand;
