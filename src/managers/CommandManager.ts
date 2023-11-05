import { access, constants, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import Factory from '../Factory.js';
import BaseCommand, { commandsMap } from '../commands/BaseCommand.js';
import { emojis } from '../utils/Constants.js';
import { CustomID } from '../structures/CustomID.js';
import { Interaction } from 'discord.js';
import { captureException } from '@sentry/node';
import { errorEmbed } from '../utils/Utils.js';

const __filename = new URL(import.meta.url).pathname;
const __dirname = dirname(__filename);

export default class CommandManager extends Factory {
  public get commandsMap() {
    return this.client.commands;
  }

  /** Handle interactions from the `InteractionCreate` event */
  async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isAutocomplete()) {
        const command = this.client.commands.get(interaction.commandName);
        if (command?.autocomplete) command.autocomplete(interaction);
      }
      else if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        const command = this.client.commands.get(interaction.commandName);
        if (!command) return;

        let remainingCooldown: number | undefined = undefined;

        if (interaction.isChatInputCommand()) {
          const subcommandGroup = interaction.options.getSubcommandGroup(false);
          const subcommand = interaction.options.getSubcommand(false);

          const baseCooldownName = `${interaction.user.id}-${interaction.commandName}`;
          const subcommandKey = subcommandGroup
            ? `${baseCooldownName}-${subcommandGroup}-${subcommand}`
            : subcommand
              ? `${baseCooldownName}-${subcommand}`
              : baseCooldownName;

          remainingCooldown = this.client.commandCooldowns.getRemainingCooldown(subcommandKey);

          if (subcommand) {
            const commandConstructor = command.constructor as typeof BaseCommand;
            // this wont work for blacklist commands because of how that command is structured...
            const subcommandClass = commandConstructor.subcommands?.get(
              subcommandGroup || subcommand,
            );

            if (subcommandClass?.cooldown) {
              this.client.commandCooldowns.setCooldown(subcommandKey, subcommandClass.cooldown);
            }
          }
        }
        else if (interaction.isContextMenuCommand()) {
          remainingCooldown = this.client.commandCooldowns.getCooldown(
            `${interaction.user.id}-${interaction.commandName}`,
          );

          // if command has cooldown, set cooldown for the user
          if (command.cooldown) {
            this.client.commandCooldowns.setCooldown(
              `${interaction.user.id}-${interaction.commandName}`,
              command.cooldown,
            );
          }
        }

        // check if command is in cooldown for the user
        if (remainingCooldown) {
          await interaction.reply({
            content: `${emojis.timeout} This command is on a cooldown! You can use it again: <t:${
              Math.ceil((Date.now() + remainingCooldown) / 1000)}:R>.`,
            ephemeral: true,
          });
          return;
        }

        // run the command
        command?.execute(interaction);
      }
      else {
        const customId = CustomID.parseCustomId(interaction.customId);

        // for components have own component collector
        const ignoreList = ['page_', 'onboarding_'];
        if (ignoreList.includes(customId.prefix)) {
          return;
        }

        // component decorator stuff
        const handler = this.client.interactions.get(customId.prefix);

        if (!handler || (customId.expiry && customId.expiry < Date.now())) {
          await interaction.reply({
            embeds: [errorEmbed(`${emojis.no} This is no longer usable.`)],
            ephemeral: true,
          });
          return;
        }

        // call function that handles the component
        await handler(interaction);
      }
    }
    catch (e) {
      interaction.client.logger.error(e);
      captureException(e);
    }
  }

  /**
   * Recursively loads all command files from the given directory and its subdirectories.
   * @param commandDir The directory to load command files from.
   */
  static async loadCommandFiles(commandDir = join(__dirname, '..', 'commands')): Promise<void> {
    let importPrefix = '';
    if (process.platform === 'win32') {
      importPrefix = 'file://';
      commandDir = commandDir.replace('\\C:\\', 'C:\\');
    }

    const files = readdirSync(commandDir);

    for (const file of files) {
      const filePath = join(commandDir, file);
      const stats = statSync(filePath);

      // If the item is a directory, recursively read its files
      if (stats.isDirectory()) {
        await this.loadCommandFiles(filePath);
      }

      // If the item is a .js file, read its contents
      else if (file.endsWith('.js') && file !== 'BaseCommand.js') {
        const imported = await import(importPrefix + filePath);
        const command = new imported.default();

        // if the command extends BaseCommand (ie. its not a subcommand), add it to the commands map
        if (Object.getPrototypeOf(command.constructor) === BaseCommand) {
          commandsMap.set(command.data.name, command);
        }

        // if the command has subcommands, add them to the parent command's subcommands map
        else {
          const subcommandFile = join(commandDir, '.', 'index.js');
          if (!statSync(subcommandFile).isFile()) return;

          access(subcommandFile, constants.F_OK, async (err) => {
            if (err || file === 'index.js') return;

            const parentCommand = Object.getPrototypeOf(command.constructor);
            parentCommand.subcommands.set(file.replace('.js', ''), command);
          });
        }
      }
    }
  }
}
