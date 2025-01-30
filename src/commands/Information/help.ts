import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { InfoEmbed } from '#src/utils/EmbedUtils.js';
import { ApplicationCommandOptionType, type Collection } from 'discord.js';

export default class Help extends BaseCommand {
  constructor() {
    super({
      name: 'help',
      description: 'List all of my commands or info about a specific command.',
      types: {
        prefix: true,
      },
      options: [
        {
          name: 'command',
          description: 'The command to get info on.',
          type: ApplicationCommandOptionType.String,
          required: false,
          autocomplete: true,
        },
      ],
    });
  }

  async execute(ctx: Context) {
    const { commands } = ctx.client;

    const command = ctx.options.getString('command');
    if (!command) {
      const embed = this.getHelpEmbed(commands);
      await ctx.reply({ embeds: [embed] });
      return;
    }

    const cmd = commands.get(command);
    if (!cmd) {
      await ctx.reply(`I couldn't find a command named \`${command}\``);
      return;
    }

    const embed = new InfoEmbed()
      .setTitle(`Command: ${cmd.name}`)
      .setDescription(`**Description:** ${cmd.description}`)
      .addFields(
        // { name: '**Usage:**', value: cmd.usage },
        // {
        //   name: '**Aliases:**',
        //   value: cmd.aliases.map((a) => `\`${a}\``).join(', '),
        // },
      );

    await ctx.reply({ embeds: [embed] });
  }

  private getHelpEmbed(commands: Collection<string, BaseCommand>) {
    const embed = new InfoEmbed()
      .setTitle('Available Commands')
      .setFooter({ text: 'Use c!help [command] for more info' });

    let description = '';
    for (const command of commands.values()) {
      description += `\nc!${command.name} \n-# > ${command.description}`;
    }

    embed.setDescription(description);
    return embed;
  }
}
