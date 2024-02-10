import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Collection,
  ContextMenuCommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  time,
  RepliableInteraction,
} from 'discord.js';
import { InteractionFunction } from '../decorators/Interaction.js';
import { t } from '../utils/Locale.js';
import { emojis } from '../utils/Constants.js';

export type CmdInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;

export const commandsMap = new Collection<string, BaseCommand>();
export const interactionsMap = new Collection<string, InteractionFunction | undefined>();

export default abstract class BaseCommand {
  abstract readonly data: RESTPostAPIApplicationCommandsJSONBody;
  readonly staffOnly?: boolean;
  readonly cooldown?: number;
  readonly description?: string;
  static readonly subcommands?: Collection<string, BaseCommand>;

  abstract execute(interaction: CmdInteraction): Promise<unknown>;

  // optional methods
  async handleComponents?(interaction: MessageComponentInteraction): Promise<unknown>;
  async handleModals?(interaction: ModalSubmitInteraction): Promise<unknown>;
  async autocomplete?(interaction: AutocompleteInteraction): Promise<unknown>;

  async handleCooldown(interaction: RepliableInteraction): Promise<boolean> {
    const remainingCooldown = this.getRemainingCooldown(interaction);

    if (remainingCooldown) {
      await this.sendCooldownError(interaction, remainingCooldown);
      return true;
    }

    this.setCooldownFor(interaction);
    return false;
  }

  async sendCooldownError(
    interaction: RepliableInteraction,
    remainingCooldown: number,
  ): Promise<void> {
    const waitUntil = Math.round((Date.now() + remainingCooldown) / 1000);

    await interaction.reply({
      content: t(
        { phrase: 'errors.cooldown', locale: interaction.user.locale },
        { time: `until ${time(waitUntil, 'T')} (${time(waitUntil, 'R')})`, emoji: emojis.no },
      ),
      ephemeral: true,
    });
  }

  getRemainingCooldown(interaction: RepliableInteraction): number {
    let remainingCooldown: number | undefined = undefined;

    if (interaction.isChatInputCommand()) {
      const subcommand = interaction.options.getSubcommand(false);
      const subcommandGroup = interaction.options.getSubcommandGroup(false);

      remainingCooldown = interaction.client.commandCooldowns?.getRemainingCooldown(
        `${interaction.user.id}-${interaction.commandName}${subcommandGroup ? `-${subcommandGroup}` : ''}${subcommand ? `-${subcommand}` : ''}`,
      );
    }
    else if (interaction.isContextMenuCommand()) {
      remainingCooldown = interaction.client.commandCooldowns?.getRemainingCooldown(
        `${interaction.user.id}-${interaction.commandName}`,
      );
    }

    return remainingCooldown || 0;
  }

  setCooldownFor(interaction: RepliableInteraction): void {
    if (!this.cooldown) return;

    if (interaction.isChatInputCommand()) {
      const subcommand = interaction.options.getSubcommand(false);
      const subcommandGroup = interaction.options.getSubcommandGroup(false);

      interaction.client.commandCooldowns?.setCooldown(
        `${interaction.user.id}-${interaction.commandName}${subcommandGroup ? `-${subcommandGroup}` : ''}${subcommand ? `-${subcommand}` : ''}`,
        this.cooldown,
      );
    }
    else if (interaction.isContextMenuCommand()) {
      interaction.client.commandCooldowns?.setCooldown(
        `${interaction.user.id}-${interaction.commandName}`,
        this.cooldown,
      );
    }
  }
}
