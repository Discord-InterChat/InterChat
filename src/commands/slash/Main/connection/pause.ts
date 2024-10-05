import { emojis } from '#main/config/Constants.js';
import { fetchCommands, findCommand } from '#main/utils/CommandUtils.js';
import { updateConnection } from '#main/utils/ConnectedListUtils.js';
import db from '#main/utils/Db.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { t } from '#main/utils/Locale.js';
import {
  ChatInputCommandInteraction,
  channelMention,
  chatInputApplicationCommandMention as slashCmdMention,
} from 'discord.js';
import Connection from './index.js';

export default class Pause extends Connection {
  override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channelId = interaction.options.getString('channel', true);
    const connected = await db.connectedList.findFirst({ where: { channelId } });
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (!connected) {
      await interaction.reply({
        content: `${emojis.no} That channel is not connected to a hub!`,
        ephemeral: true,
      });
      return;
    }

    if (!connected.connected) {
      const embed = new InfoEmbed().setDescription(
        `${emojis.no} The connection is already paused for this channel. Use \`/connection unpause\` to continue chatting.`,
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
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

    const successEmbed = new InfoEmbed().setDescription(
      t(
        { phrase: 'connection.paused.desc', locale },
        { clock_emoji: emojis.timeout, channel: channelMention(channelId) },
      ),
    );

    await interaction.reply({
      content: t({ phrase: 'connection.paused.tips', locale }, { unpause_cmd, leave_cmd }),
      embeds: [successEmbed],
    });
  }
}
