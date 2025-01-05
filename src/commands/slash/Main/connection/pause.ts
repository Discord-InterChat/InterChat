import {
  type ChatInputCommandInteraction,
  channelMention,
  chatInputApplicationCommandMention as slashCmdMention,
} from 'discord.js';
import { fetchCommands, findCommand } from '#utils/CommandUtils.js';
import { updateConnection } from '#utils/ConnectedListUtils.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';
import Connection from './index.js';

export default class Pause extends Connection {
  override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channelId = interaction.options.getString('channel') ?? interaction.channelId;
    const connected = await db.connection.findFirst({ where: { channelId } });
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (!connected) {
      await interaction.reply({
        content: `${this.getEmoji('x_icon')} That channel is not connected to a hub!`,
        flags: 'Ephemeral',
      });
      return;
    }

    if (!connected.connected) {
      const embed = new InfoEmbed().setDescription(
        `${this.getEmoji('x_icon')} The connection is already paused for this channel. Use \`/connection unpause\` to continue chatting.`,
      );
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }

    // disconnect the channel
    await updateConnection({ channelId }, { connected: false });

    const commands = await fetchCommands(interaction.client);
    const connectionCmd = findCommand('connection', commands);
    const hubCmd = findCommand('hub', commands);

    const unpause_cmd = connectionCmd
      ? slashCmdMention('connection', 'unpause', connectionCmd.id)
      : '`/connection unpause`';
    const leave_cmd = hubCmd ? slashCmdMention('hub', 'leave', hubCmd.id) : '`/hub leave`';

    const successEmbed = new InfoEmbed().removeTitle().setDescription(
      t('connection.paused.desc', locale, {
        clock_emoji: this.getEmoji('timeout'),
        channel: channelMention(channelId),
      }),
    );

    await interaction.reply({
      content: t('connection.paused.tips', locale, { unpause_cmd, leave_cmd }),
      embeds: [successEmbed],
    });
  }
}
