import type { Collection, Message } from 'discord.js';
import BasePrefixCommand, { type CommandData } from '#main/core/BasePrefixCommand.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';

export default class Help extends BasePrefixCommand {
  public readonly data: CommandData = {
    name: 'help',
    description: 'List all of my commands or info about a specific command.',
    category: 'Utility',
    usage: 'help ` [command] `',
    aliases: ['h', 'commands'],
    requiredArgs: 0,
    examples: ['help', 'help prefix'],
  };

  protected async run(message: Message, args: string[]): Promise<void> {
    const { prefixCommands } = message.client;

    const command = args.at(0);
    if (!command) {
      const embed = this.getHelpEmbed(prefixCommands);
      await message.reply({ embeds: [embed] });
      return;
    }

    const cmd =
      prefixCommands.get(command) || prefixCommands.find((c) => c.data.aliases.includes(command));

    if (!cmd) {
      await message.reply(`I couldn't find a command named \`${command}\``);
      return;
    }

    const embed = new InfoEmbed()
      .setTitle(`Command: ${cmd.data.name}`)
      .setDescription(`**Description:** ${cmd.data.description}`)
      .addFields(
        { name: '**Usage:**', value: cmd.data.usage },
        {
          name: '**Aliases:**',
          value: cmd.data.aliases.map((a) => `\`${a}\``).join(', '),
        },
      );

    await message.reply({ embeds: [embed] });
  }

  private getHelpEmbed(prefixCommands: Collection<string, BasePrefixCommand>) {
    const embed = new InfoEmbed()
      .setTitle('Available Prefix Commands')
      .setFooter({ text: 'Use c!help [command] for more info' });

    let description = '';
    for (const command of prefixCommands.values()) {
      const aliases = command.data.aliases.map((a) => `\`${a}\``).join(', ');
      description += `\nc!${command.data.name} (${aliases})\n-# > ${command.data.description}`;
    }

    embed.setDescription(description);
    return embed;
  }
}
