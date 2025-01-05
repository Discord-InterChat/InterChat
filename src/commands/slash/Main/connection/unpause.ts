import {
  ChannelType,
  type ChatInputCommandInteraction,
  channelMention,
  chatInputApplicationCommandMention as slashCmdMention,
} from 'discord.js';
import { fetchCommands, findCommand } from '#utils/CommandUtils.js';
import { updateConnection } from '#utils/ConnectedListUtils.js';
import db from '#utils/Db.js';
import { t } from '#utils/Locale.js';
import { getOrCreateWebhook } from '#utils/Utils.js';
import Connection from './index.js';

export default class Unpause extends Connection {
  override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channelId = interaction.options.getString('channel') ?? interaction.channelId;
    const connected = await db.connection.findFirst({ where: { channelId } });
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (!connected) {
      await this.replyEmbed(
        interaction,
        `${this.getEmoji('x_icon')} That channel is not connected to a hub!`,
        {
          flags: ['Ephemeral'],
        },
      );
      return;
    }

    if (connected.connected) {
      await this.replyEmbed(
        interaction,
        `${this.getEmoji('x_icon')} This connection is not paused! Use \`/connection pause\` to pause your connection.`,
        { flags: ['Ephemeral'] },
      );
      return;
    }

    const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);

    if (!channel?.isThread() && channel?.type !== ChannelType.GuildText) {
      await this.replyEmbed(
        interaction,
        t('connection.channelNotFound', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        { flags: ['Ephemeral'] },
      );
      return;
    }

    await interaction.reply(
      `${this.getEmoji('loading')} Checking webhook status... May take a few seconds if it needs to be re-created.`,
    );

    const webhook = await getOrCreateWebhook(channel).catch(() => null);
    if (!webhook) {
      await this.replyEmbed(
        interaction,
        t('errors.botMissingPermissions', locale, {
          emoji: this.getEmoji('x_icon'),
          permissions: 'Manage Webhooks',
        }),
      );
      return;
    }

    // reconnect the channel
    await updateConnection({ channelId }, { connected: true, webhookURL: webhook.url });

    let pause_cmd = '`/connection pause`';
    let edit_cmd = '`/connection edit`';

    const command = findCommand('connection', await fetchCommands(interaction.client));
    if (command) {
      pause_cmd = slashCmdMention('connection', 'pause', command.id);
      edit_cmd = slashCmdMention('connection', 'edit', command.id);
    }

    await this.replyEmbed(interaction, 'connection.unpaused.desc', {
      t: {
        tick_emoji: this.getEmoji('tick'),
        channel: channelMention(channelId),
      },
      edit: true,
      content: `-# ${t('connection.unpaused.tips', locale, { pause_cmd, edit_cmd })}`,
    });
  }
}
