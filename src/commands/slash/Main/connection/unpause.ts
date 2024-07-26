import {
  ChannelType,
  ChatInputCommandInteraction,
  channelMention,
  chatInputApplicationCommandMention as slashCmdMention,
} from 'discord.js';
import Connection from './index.js';
import {
  fetchCommands,
  findCommand,
  getOrCreateWebhook,
  getUserLocale,
  simpleEmbed,
} from '#main/utils/Utils.js';
import { emojis } from '#main/utils/Constants.js';
import { t } from '#main/utils/Locale.js';
import { modifyConnection } from '#main/utils/ConnectedList.js';
import db from '#main/utils/Db.js';

export default class Unpause extends Connection {
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

    if (connected.connected) {
      await interaction.reply({
        embeds: [
          simpleEmbed(
            `${emojis.no} This connection is not paused! Use \`/connection pause\` to pause your connection.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);

    if (!channel?.isThread() && channel?.type !== ChannelType.GuildText) {
      await interaction.reply({
        embeds: [
          simpleEmbed(t({ phrase: 'connection.channelNotFound', locale }, { emoji: emojis.no })),
        ],
      });
      return;
    }

    await interaction.reply({
      content: `${emojis.loading} Checking webhook status... May take a few seconds if it needs to be re-created.`,
    });

    const webhook = await getOrCreateWebhook(channel).catch(() => null);
    if (!webhook) {
      await this.replyEmbed(
        interaction,
        t(
          { phrase: 'errors.botMissingPermissions', locale },
          { emoji: emojis.no, permissions: 'Manage Webhooks' },
        ),
      );
      return;
    }

    // reconnect the channel
    await modifyConnection({ channelId }, { connected: true, webhookURL: webhook.url });

    let pause_cmd = '`/connection pause`';
    let customize_cmd = '`/connection customize`';

    const command = findCommand('connection', await fetchCommands(interaction.client));
    if (command) {
      pause_cmd = slashCmdMention('connection', 'pause', command.id);
      customize_cmd = slashCmdMention('connection', 'customize', command.id);
    }

    await interaction.editReply({
      content: t({ phrase: 'connection.unpaused.tips', locale }, { pause_cmd, customize_cmd }),
      embeds: [
        simpleEmbed(
          t(
            { phrase: 'connection.unpaused.desc', locale },
            { tick_emoji: emojis.tick, channel: channelMention(channelId) },
          ),
        ),
      ],
    });
  }
}
