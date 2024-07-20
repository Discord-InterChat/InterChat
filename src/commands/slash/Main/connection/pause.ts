import { modifyConnection } from '#main/utils/ConnectedList.js';
import { emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { fetchCommands, findCommand, getUserLocale, simpleEmbed } from '#main/utils/Utils.js';
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
    const locale = await getUserLocale(interaction.user.id);

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
    await modifyConnection({ channelId }, { connected: false });

    const commands = await fetchCommands(interaction.client);
    const connectionCmd = findCommand('connection', commands);
    const hubCmd = findCommand('hub', commands);

    const unpause_cmd = connectionCmd
      ? slashCmdMention('connection', 'unpause', connectionCmd.id)
      : '`/connection pause`';
    const leave_cmd = hubCmd ? slashCmdMention('hub', 'leave', hubCmd.id) : '`/hub leave`';

    await interaction.reply({
      content: t(
        { phrase: 'connection.paused.tips', locale },
        { emoji: emojis.dotBlue, unpause_cmd, leave_cmd },
      ),
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
