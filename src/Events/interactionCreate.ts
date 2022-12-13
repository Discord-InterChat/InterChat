import { GuildMember, Interaction, PermissionsBitField } from 'discord.js';
import { checkIfStaff } from '../Utils/functions/utils';
import logger from '../Utils/logger';

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
        const noPermsMsg = {
          content: 'You do not have the right permissions to use this command!',
          ephemeral: true,
        };
        if (command.staff === true && await checkIfStaff(interaction.client, interaction.user) === false) {
          interaction.reply(noPermsMsg);
          return;
        }
        if (command.developer === true && await checkIfStaff(interaction.client, interaction.user, true) === false) {
          interaction.reply(noPermsMsg);
          return;
        }
        await command.execute(interaction);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      catch (error: any) {
        logger.error(`[${interaction.commandName}]:`, error);

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
