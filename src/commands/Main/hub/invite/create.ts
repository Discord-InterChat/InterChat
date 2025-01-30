import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { HubService } from '#src/services/HubService.js';
import { ApplicationCommandOptionType } from 'discord.js';
import ms from 'ms';

export default class InviteCreateSubcommand extends BaseCommand {
  constructor() {
    super({
      name: 'create',
      description: '🔗 Create a new invite code to your private hub',
      types: { slash: true, prefix: true },
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'hub',
          description: 'The name of the hub you wish to create this invite for',
          required: true,
          autocomplete: true,
        },
        {
          type: ApplicationCommandOptionType.String,
          name: 'expiry',
          description:
						'The expiry of the invite link. Eg. 10h (10 hours from now)',
          required: false,
        },
      ],
    });
  }
  public async execute(ctx: Context) {
    const hubName = ctx.options.getString('hub', true);
    const expiryStr = ctx.options.getString('expiry');
    const duration = expiryStr ? ms(expiryStr) : undefined;
    const expires = new Date(Date.now() + (duration || 60 * 60 * 4000));

    const hubService = new HubService();
    const hub = await (await hubService.findHubsByName(hubName)).at(0);

    if (!hub) {
      await ctx.replyEmbed('hub.notFound_mod', {
        t: { emoji: ctx.getEmoji('x_icon') },
        flags: ['Ephemeral'],
      });
      return;
    }
    if (!hub?.data.private) {
      await ctx.replyEmbed('hub.notPrivate', {
        t: { emoji: ctx.getEmoji('x_icon') },
        flags: ['Ephemeral'],
      });
      return;
    }

    if (!(await hub.isManager(ctx.user.id))) {
      await ctx.replyEmbed('hub.notManager', {
        t: { emoji: ctx.getEmoji('x_icon') },
        flags: ['Ephemeral'],
      });
      return;
    }

    if (!Date.parse(expires.toString())) {
      await ctx.reply({
        content: `${ctx.getEmoji('x_icon')} Invalid Expiry Duration provided!`,
        flags: ['Ephemeral'],
      });
      return;
    }

    const createdInvite = await hub.createInvite(expires);

    await ctx.replyEmbed('hub.invite.create.success', {
      t: {
        inviteCode: createdInvite.code,
        expiry: `<t:${Math.round(createdInvite.expires.getTime() / 1000)}:R>`,
      },
      flags: ['Ephemeral'],
    });
  }
}
