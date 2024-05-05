import { t } from '../utils/Locale.js';
import { emojis } from '../utils/Constants.js';
import { CustomID } from '../utils/CustomID.js';
import { join, dirname } from 'path';
import { Collection, Interaction } from 'discord.js';
import { simpleEmbed, handleError } from '../utils/Utils.js';
import { access, constants, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import BaseCommand, { commandsMap } from '../core/BaseCommand.js';
import Factory from '../core/Factory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default class CommandManager extends Factory {
  public get commandsMap(): Collection<string, BaseCommand> {
    return this.client.commands;
  }

  /** Handle interactions from the `InteractionCreate` event */
  async onInteractionCreate(interaction: Interaction): Promise<void> {
    try {
      interaction.user.locale = await interaction.client.getUserLocale(interaction.user.id);

      if (interaction.isAutocomplete()) {
        const command = this.commandsMap.get(interaction.commandName);
        if (command?.autocomplete) await command.autocomplete(interaction);
      }
      else if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        const command = this.commandsMap.get(interaction.commandName);
        if (!command) return;

        // run the command
        await command?.execute(interaction);
      }
      else {
        const customId = CustomID.parseCustomId(interaction.customId);

        // for components have own component collector
        const ignoreList = ['page_', 'onboarding_'];
        if (ignoreList.includes(customId.prefix)) return;

        // component decorator stuff
        const interactionHandler = this.client.interactions.get(customId.prefix);
        const isExpiredInteraction = customId.expiry && customId.expiry < Date.now();

        if (!interactionHandler || isExpiredInteraction) {
          await interaction.reply({
            embeds: [
              simpleEmbed(
                t(
                  { phrase: 'errors.notUsable', locale: interaction.user.locale },
                  { emoji: emojis.no },
                ),
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        // call function that handles the component
        await interactionHandler(interaction);
      }
    }
    catch (e) {
      handleError(e, interaction);
    }
  }

  /**
   * Recursively loads all command files from the given directory and its subdirectories.
   * @param commandDir The directory to load command files from.
   */
  static async loadCommandFiles(commandDir = join(__dirname, '..', 'commands')): Promise<void> {
    const importPrefix = process.platform === 'win32' ? 'file://' : '';
    const files = readdirSync(commandDir);

    for (const file of files) {
      const filePath = join(commandDir, file);
      const stats = statSync(filePath);

      // If the item is a directory, recursively read its files
      if (stats.isDirectory()) {
        await this.loadCommandFiles(filePath);
      }
      else if (file.endsWith('.js') && file !== 'BaseCommand.js') {
        const imported = await import(importPrefix + filePath);
        const command: BaseCommand = new imported.default();

        // if the command extends BaseCommand (ie. is not a subcommand), add it to the commands map
        if (Object.getPrototypeOf(command.constructor) === BaseCommand) {
          commandsMap.set(command.data.name, command);
        }

        // if the command has subcommands, add them to the parent command's subcommands map
        else {
          const subcommandFile = join(commandDir, '.', 'index.js');
          if (!statSync(subcommandFile).isFile()) return;

          access(subcommandFile, constants.F_OK, (err) => {
            if (err || file === 'index.js') return;

            // get the parent command class from the subcommand
            const parentCommand = Object.getPrototypeOf(command.constructor);
            // set the subcommand class to the parent command's subcommands map
            parentCommand.subcommands.set(file.replace('.js', ''), command);
          });
        }
      }
    }
  }
}
