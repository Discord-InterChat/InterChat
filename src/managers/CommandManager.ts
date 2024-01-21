import { t } from '../utils/Locale.js';
import { join, dirname } from 'path';
import { CustomID } from '../utils/CustomID.js';
import { Interaction, time } from 'discord.js';
import { simpleEmbed, handleError } from '../utils/Utils.js';
import { access, constants, readdirSync, statSync } from 'fs';
import Factory from '../Factory.js';
import BaseCommand, { commandsMap } from '../commands/BaseCommand.js';
import { emojis } from '../utils/Constants.js';

const __filename = new URL(import.meta.url).pathname;
const __dirname = dirname(__filename);

export default class CommandManager extends Factory {
  public get commandsMap() {
    return this.client.commands;
  }

  /** Handle interactions from the `InteractionCreate` event */
  async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      interaction.user.locale = await interaction.client.getUserLocale(interaction.user.id);

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
          const waitUntil = Math.round((Date.now() + remainingCooldown) / 1000);
          await interaction.reply({
            content: t(
              { phrase: 'errors.cooldown', locale: interaction.user.locale },
              { time: `until ${time(waitUntil, 'T')} (${time(waitUntil, 'R')})`, emoji: emojis.no },
            ),
            ephemeral: true,
          });
          return;
        }

        // run the command
        await command?.execute(interaction);
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
        await handler(interaction);
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
      else if (file.endsWith('.js') && file !== 'BaseCommand.js') {
        const imported = await import(importPrefix + filePath);
        const command = new imported.default();

        // if the command extends BaseCommand (ie. is not a subcommand), add it to the commands map
        if (Object.getPrototypeOf(command.constructor) === BaseCommand) {
          commandsMap.set(command.data.name, command);
        }

        // if the command has subcommands, add them to the parent command's subcommands map
        else {
          const subcommandFile = join(commandDir, '.', 'index.js');
          if (!statSync(subcommandFile).isFile()) return;

          access(subcommandFile, constants.F_OK, async (err) => {
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
