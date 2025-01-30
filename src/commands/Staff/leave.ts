import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { isDev, resolveEval } from '#utils/Utils.js';
import {
  ApplicationCommandOptionType,
  type Guild,
} from 'discord.js';

export default class Respawn extends BaseCommand {
  constructor() {
    super({
      name: 'leave',
      description: 'Make me leave a server (dev only)',
      staffOnly: true,
      types: { slash: true, prefix: true },
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'server_id',
          description: 'The ID of the server to leave.',
          required: true,
        },
      ],
    });
  }
  async execute(ctx: Context) {
    if (!isDev(ctx.user.id)) {
      await ctx.reply({
        content: `${ctx.getEmoji('dnd_anim')} You are not authorized to use this command.`,
        flags: ['Ephemeral'],
      });
      return;
    }

    const guildId = ctx.options.getString('server_id', true);
    const leftGuild = resolveEval(
      (await ctx.client.cluster.broadcastEval(
        async (client, _serverId) => {
          const guild = client.guilds.cache.get(_serverId);

          return guild ? await guild.leave() : undefined;
        },
        { guildId, context: guildId },
      )) as (Guild | undefined)[],
    );

    await ctx.reply(
      `${ctx.getEmoji('tick')} Successfully Left guild ${leftGuild?.name} (${leftGuild?.id})`,
    );
  }
}
