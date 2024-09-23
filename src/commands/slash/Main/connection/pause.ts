import { updateConnection } from '#main/utils/ConnectedListUtils.js';
import { emojis } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { simpleEmbed } from '#main/utils/Utils.js';
import {
  ChatInputCommandInteraction,
  channelMention,
  chatInputApplicationCommandMention as slashCmdMention,
} from 'discord.js';
import Connection from './index.js';
import { fetchCommands, findCommand } from '#main/utils/CommandUtls.js';

export default class Pause extends Connection {
  override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channelId = interaction.options.getString('channel', true);
    const connected = await db.connectedList.findFirst({ where: { channelId } });
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (!connected) {
      await interaction.reply({
        embeds: [simpleEmbed(`${emojis.no} That channel is not connected to a hub!`)],
        ephemeral: true,
      });
      return;
    }

    if (!connected.connected) {
      await interaction.reply({
        embeds: [
          simpleEmbed(
            `${emojis.no} The connection is already paused for this channel. Use \`/connection unpause\` to continue chatting. `,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // disconnect the channel
    await updateConnection({ channelId }, { connected: false });

    const commands = await fetchCommands(interaction.client);
    const connectionCmd = findCommand('connection', commands);
    const hubCmd = findCommand('hub', commands);

    const unpause_cmd = connectionCmd
      ? slashCmdMention('connection', 'unpause', connectionCmd.id)
      : '`/connection pause`';
    const leave_cmd = hubCmd ? slashCmdMention('hub', 'leave', hubCmd.id) : '`/hub leave`';

    await interaction.reply({
      content: t({ phrase: 'connection.paused.tips', locale }, { unpause_cmd, leave_cmd }),
      embeds: [
        simpleEmbed(
          t(
            { phrase: 'connection.paused.desc', locale },
            {
              clock_emoji: emojis.timeout,
              channel: channelMention(channelId),
            },
          ),
        ),
      ],
    });
  }
}
