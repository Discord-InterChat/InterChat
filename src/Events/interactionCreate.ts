import { Interaction } from 'discord.js';
import { checkIfStaff } from '../Utils/functions/utils';
import { captureException } from '@sentry/node';
import logger from '../Utils/logger';
import reactionButton from '../Scripts/message/reactionButton';

export default {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    if (interaction.isButton()) {
      const customId = interaction.customId;
      if (customId.startsWith('reaction_')) reactionButton.execute(interaction);
    }

    else if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (command?.autocomplete) command.autocomplete(interaction);
    }

    else if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      if (command.cooldown) {
        const cooldown = interaction.client.commandCooldowns.get(`${interaction.commandName}-${interaction.user.id}`);
        if (cooldown && cooldown > Date.now()) {
          return interaction.reply({
            content: `You can use this command again <t:${Math.round(new Date(cooldown - Date.now()).getTime() / 1000)}:R>`,
            ephemeral: true,
          });
        }
        interaction.client.commandCooldowns.set(
          `${interaction.commandName}-${interaction.user.id}`, Date.now() + command.cooldown,
        );
      }

      // Check if the user is staff/developer
      if (command.staff || command.developer) {
        const permCheck = checkIfStaff(interaction.user.id, command.developer);
        if (!permCheck) {
          return interaction.reply({
            content: 'You do not have the right permissions to use this command!',
            ephemeral: true,
          });
        }
      }

      try {
        await command.execute(interaction);
      }

      catch (error) {
        logger.error(`[${interaction.commandName}]:`, error);
        captureException(error, {
          user: { id: interaction.user.id, username: interaction.user.username },
          extra: { command: interaction.commandName },
        });

        const errorMsg = {
          content: 'There was an error while executing this command! The developers have been notified.',
          ephemeral: true,
        };
        interaction.replied || interaction.deferred
          ? await interaction.followUp(errorMsg).catch(() => null)
          : await interaction.reply(errorMsg).catch(() => null);
      }
    }
  },
};
