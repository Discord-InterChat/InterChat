import { Interaction } from 'discord.js';
import { checkIfStaff } from '../Utils/misc/utils';
import { captureException } from '@sentry/node';
import logger from '../Utils/logger';
import reactionButton from '../Scripts/reactions/reactionButton';
import viewReactionsMenu from '../Scripts/reactions/viewReactionsMenu';
import { formatErrorCode } from '../Utils/misc/errorHandler';

export default {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    if (interaction.isButton()) {
      const customId = interaction.customId;
      if (customId.startsWith('reaction_')) {
        const cooldown = interaction.client.reactionCooldowns.get(interaction.user.id);
        if (cooldown && cooldown > Date.now()) {
          interaction.reply({
            content: `A little quick there! You can react again <t:${Math.round(cooldown / 1000)}:R>!`,
            ephemeral: true,
          });
          return;
        }

        interaction.client.reactionCooldowns.set(interaction.user.id, Date.now() + 3000);
        reactionButton.execute(interaction);
      }
      else if (customId === 'view_all_reactions') {viewReactionsMenu.execute(interaction);}
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
            content: `You can use this command again <t:${Math.round(cooldown / 1000)}:R>`,
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
      command.execute(interaction)
        .catch((e) => {
          logger.error(e);
          captureException(e);
          (interaction.replied || interaction.deferred
            ? interaction.followUp({ content: formatErrorCode(e), ephemeral: true })
            : interaction.reply({ content: formatErrorCode(e), ephemeral: true })).catch(() => null);
        });
    }
  },
};
