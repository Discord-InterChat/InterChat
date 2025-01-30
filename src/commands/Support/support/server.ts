import { EmbedBuilder } from 'discord.js';
import Constants from '#utils/Constants.js';
import type Context from '#src/core/CommandContext/Context.js';
import BaseCommand from '#src/core/BaseCommand.js';

export default class SupportServer extends BaseCommand {
  constructor() {
    super({
      name: 'server',
      description: 'Join the InterChat support server.',
      types: { slash: true, prefix: true },
    });
  }
  async execute(ctx: Context) {
    const embed = new EmbedBuilder()
      .setTitle('InterChat Central')
      .setDescription(`[Click Here](${Constants.Links.SupportInvite}) to join the support server.`)
      .setColor(Constants.Colors.interchatBlue)
      .setTimestamp();
    await ctx.reply({ embeds: [embed] });
  }
}
