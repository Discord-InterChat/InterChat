import { Interaction } from 'discord.js';
import fs from 'fs';
import path from 'path';
import Factory from '../Factory.js';
import { CustomID } from './CustomID.js';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

export default class CommandHandler extends Factory {
  public get commandsMap() {
    return this.client.commands;
  }

  /** `InteractionCreate` event handler */
  handleInteraction(interaction: Interaction) {
    if (interaction.isAutocomplete()) {
      const command = this.client.commands.get(interaction.commandName);
      if (command?.autocomplete) command.autocomplete(interaction);
    }

    else if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
      this.client.commands.get(interaction.commandName)?.execute(interaction);
    }

    else {
      const customId = CustomID.toJSON(interaction.customId);
      const handler = this.client.components.find((_, key) => key.startsWith(customId.identifier));
      if (!handler) {
        interaction.reply({ content: 'This button is no longer usable.', ephemeral: true });
        return;
      }
      handler(interaction);
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

      if (stats.isDirectory()) {
        // If the item is a directory, recursively read its files
        await this.loadCommandFiles(filePath);
      }

      // If the item is a .js file, read its contents
      else if (file.endsWith('.js') && file !== 'Command.js') {
        // importing it will automatically add the command to the clientCommands map
        const command = await import(filePath);
        new command.default().loadCommand();
      }
    }
  }
}
