import type Context from '#src/core/CommandContext/Context.js';
import { HubJoinService } from '#src/services/HubJoinService.js';
import { ApplicationCommandOptionType, ChannelType, type GuildTextBasedChannel } from 'discord.js';
import BaseCommand from '#src/core/BaseCommand.js';
import { hubOption } from '#src/commands/Main/hub/index.js';

export default class HubJoinSubcommand extends BaseCommand {
  constructor() {
    super({
      name: 'join',
      description: '🔗 Join a public/private hub from this server.',
      types: { slash: true, prefix: true },
      options: [
        {
          type: ApplicationCommandOptionType.Channel,
          name: 'channel',
          description: 'The channel you want to use connect to a hub.',
          required: false,
          channel_types: [
            ChannelType.GuildText,
            ChannelType.PublicThread,
            ChannelType.PrivateThread,
          ],
        },
        { ...hubOption, required: false },
        {
          type: ApplicationCommandOptionType.String,
          name: 'invite',
          description: 'The invite code of the private hub you want to join.',
          required: false,
        },
      ],

    });
  }
  async execute(ctx: Context) {
    if (!ctx.inGuild()) return;

    const hubInviteOrName =
			ctx.options.getString('invite') ??
			ctx.options.getString('hub') ??
			undefined;

    const channel = ((await ctx.options.getChannel('channel')) ??
			ctx.channel) as GuildTextBasedChannel;
    const locale = await ctx.getLocale();

    // get random hub if no invite or name is provided
    const hubJoinService = new HubJoinService(ctx, locale);

    if (hubInviteOrName) await hubJoinService.joinHub(channel, hubInviteOrName);
    else await hubJoinService.joinRandomHub(channel);
  }
}
