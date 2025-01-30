import {
  ApplicationCommandOptionType,
  ChannelType,
  channelMention,
  chatInputApplicationCommandMention as slashCmdMention,
} from 'discord.js';
import { fetchCommands, findCommand } from '#utils/CommandUtils.js';
import { updateConnection } from '#utils/ConnectedListUtils.js';
import db from '#utils/Db.js';
import { t } from '#utils/Locale.js';
import { fetchUserLocale, getOrCreateWebhook } from '#utils/Utils.js';
import type Context from '#src/core/CommandContext/Context.js';
import BaseCommand from '#src/core/BaseCommand.js';

export default class ConnectionUnpauseSubcommand extends BaseCommand {
  constructor() {
    super({
      name: 'unpause',
      description: '▶️ Unpause the connection to a joined hub.',
      types: { prefix: true, slash: true },
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'channel',
          description: 'The name of the channel to unpause connection',
          required: false,
          autocomplete: true,
        },
      ],
    });
  }

  override async execute(ctx: Context): Promise<void> {
    const channelId = ctx.options.getString('channel') ?? ctx.channelId;
    const connected = await db.connection.findFirst({ where: { channelId } });

    const locale = await fetchUserLocale(ctx.user.id);

    if (!connected) {
      await ctx.replyEmbed(
        `${ctx.getEmoji('x_icon')} That channel is not connected to a hub!`,
        { flags: ['Ephemeral'] },
      );
      return;
    }

    if (connected.connected) {
      await ctx.replyEmbed(
        `${ctx.getEmoji('x_icon')} This connection is not paused! Use \`/connection pause\` to pause your connection.`,
        { flags: ['Ephemeral'] },
      );
      return;
    }

    const channel = await ctx.guild?.channels
      .fetch(channelId)
      .catch(() => null);

    if (!channel?.isThread() && channel?.type !== ChannelType.GuildText) {
      await ctx.replyEmbed(
        t('connection.channelNotFound', locale, {
          emoji: ctx.getEmoji('x_icon'),
        }),
        { flags: ['Ephemeral'] },
      );
      return;
    }

    await ctx.reply(
      `${ctx.getEmoji('loading')} Checking webhook status... May take a few seconds if it needs to be re-created.`,
    );

    const webhook = await getOrCreateWebhook(channel).catch(() => null);
    if (!webhook) {
      await ctx.replyEmbed(
        t('errors.botMissingPermissions', locale, {
          emoji: ctx.getEmoji('x_icon'),
          permissions: 'Manage Webhooks',
        }),
      );
      return;
    }

    // reconnect the channel
    await updateConnection(
      { channelId },
      { connected: true, webhookURL: webhook.url },
    );

    let pause_cmd = '`/connection pause`';
    let edit_cmd = '`/connection edit`';

    const command = findCommand('connection', await fetchCommands(ctx.client));
    if (command) {
      pause_cmd = slashCmdMention('connection', 'pause', command.id);
      edit_cmd = slashCmdMention('connection', 'edit', command.id);
    }

    await ctx.replyEmbed('connection.unpaused.desc', {
      t: {
        tick_emoji: ctx.getEmoji('tick'),
        channel: channelMention(channelId),
      },
      edit: true,
      content: `-# ${t('connection.unpaused.tips', locale, { pause_cmd, edit_cmd })}`,
    });
  }
}
