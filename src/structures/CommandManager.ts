import fs from 'fs';
import path from 'path';
import Factory from '../Factory.js';
import Logger from '../utils/Logger.js';
import Command from '../commands/Command.js';
import { emojis } from '../utils/Constants.js';
import { CustomID } from './CustomID.js';
import { Interaction } from 'discord.js';
import { captureException } from '@sentry/node';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

export default class CommandManager extends Factory {
  public get commandsMap() {
    return this.client.commands;
  }

  /** `InteractionCreate` event handler */
  async handleInteraction(interaction: Interaction) {
    try {
      if (interaction.isAutocomplete()) {
        const command = this.client.commands.get(interaction.commandName);
        if (command?.autocomplete) command.autocomplete(interaction);
      }
      else if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        this.client.commands.get(interaction.commandName)?.execute(interaction);
      }
      else {
        const customId = CustomID.parseCustomId(interaction.customId);

        // for components have own component collector
        const ignoreList = ['page_', 'onboarding_'];
        if (ignoreList.includes(customId.identifier)) {
          return;
        }

        // component decorator stuff
        const handler = this.client.components.find((_, key) =>
          key.startsWith(customId.identifier),
        );

        if (!handler) {
          await interaction.reply({
            content: `${emojis.no} This is no longer usable.`,
            ephemeral: true,
          });
          return;
        }

        handler(interaction);
      }
    }
    catch (e) {
      Logger.error(e);
      captureException(e);
    }
  }

  /**
   * Loads all commands from the Commands directory
   * Commands are automatically added to the `clientCommands` map
   */
  static async loadCommandFiles(
    commandDir = path.join(__dirname, '..', 'commands'),
  ): Promise<void> {
    const files = fs.readdirSync(commandDir);

    for (const file of files) {
      const filePath = path.join(commandDir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory() && file !== 'subcommands') {
        // If the item is a directory, recursively read its files
        await this.loadCommandFiles(filePath);
      }

      // If the item is a .js file, read its contents
      else if (file.endsWith('.js') && file !== 'Command.js') {
        // initializing it will automatically add the command to the clientCommands map
        const imported = await import(filePath);
        const command = new imported.default() as Command;
        command.loadCommand();
        command.loadSubcommands();
      }
    }
  }
}
