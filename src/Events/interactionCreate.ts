import { GuildMember, Interaction, PermissionsBitField } from 'discord.js';
import { checkIfStaff } from '../Utils/functions/utils';
import logger from '../Utils/logger';
import * as Sentry from '@sentry/node';

export default {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (command?.autocomplete) command.autocomplete(interaction);
    }

    else if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
      const requiredPerms = new PermissionsBitField(['SendMessages', 'EmbedLinks']);

      if (
        interaction.inCachedGuild() &&
        !interaction.channel?.permissionsFor(interaction.guild?.members.me as GuildMember)
          .has(requiredPerms)
      ) {
        return interaction.reply({
          content: 'I do not have the right permissions in this channel to function properly!',
          ephemeral: true,
        });
      }

      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        // Check if the user is staff/developer
        if (command.staff || command.developer) {
          const permCheck = await checkIfStaff(interaction.user, command.developer);
          if (!permCheck) return interaction.reply({ content: 'You do not have the right permissions to use this command!', ephemeral: true });
        }

        await command.execute(interaction);
      }

      catch (error) {
        logger.error(`[${interaction.commandName}]:`, error);
        Sentry.captureException(error, {
          user: { id: interaction.user.id, username: interaction.user.tag },
          extra: { command: interaction.commandName },
        });

        const errorMsg = {
          content: 'There was an error while executing this command! The developers have been notified.',
          ephemeral: true,
          fetchReply: true,
        };

        interaction.deferred
          ? await interaction.followUp(errorMsg)
          : interaction.replied
            ? await interaction.channel?.send(errorMsg)
            : await interaction.reply(errorMsg);
      }
    }
  },
};
