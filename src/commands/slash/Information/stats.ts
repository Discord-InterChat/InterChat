import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Status,
} from 'discord.js';
import db from '../../../utils/Db.js';
import BaseCommand from '../../BaseCommand.js';
import { cpus, totalmem } from 'os';
import { LINKS, colors, emojis, isDevBuild } from '../../../utils/Constants.js';
import { msToReadable } from '../../../utils/Utils.js';
import { stripIndents } from 'common-tags';
import { CustomID } from '../../../utils/CustomID.js';
import { RegisterInteractionHandler } from '../../../decorators/Interaction.js';

export default class Stats extends BaseCommand {
  readonly data = {
    name: 'stats',
    description: 'View InterChat\'s statistics.',
  };

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const { connectedList, messageData, hubs } = db;
    const totalConnections = await connectedList?.count();
    const totalHubs = await hubs?.count();
    const totalNetworkMessages = await messageData.count();

    const count: number[] = await interaction.client.cluster.fetchClientValues('guilds.cache.size');
    const guildCount = count.reduce((p, n) => p + n, 0);

    const uptime = msToReadable(interaction.client.uptime);
    const docsLink = 'https://discord-interchat.github.io/docs';

    const embed = new EmbedBuilder()
      .setColor('#A0C2EC')
      .setTitle(`${interaction.client.user.username} Statistics`)
      .setFooter({
        text: `InterChat v${interaction.client.version}${isDevBuild ? '+dev' : ''}`,
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .addFields([
        {
          name: 'Bot Stats',
          value: stripIndents`
          - Uptime: \`${uptime}\`
          - Servers ${guildCount}
          - Shards: ${interaction.client.cluster.info.TOTAL_SHARDS}
          `,
          inline: true,
        },
        {
          name: 'System Stats',
          value: stripIndents`
            - OS: Linux
            - CPU Cores: ${cpus().length}
            - RAM Usage: ${Math.round(
    process.memoryUsage().heapUsed / 1024 / 1024,
  )} MB / ${Math.round(totalmem() / 1024 / 1024 / 1024)} GB
            `,
          inline: true,
        },
        { name: '\u200B', value: '\u200B', inline: true },
        {
          name: 'Hub Stats',
          value: stripIndents`
          - Total Hubs: ${totalHubs}
          - Total Connected: ${totalConnections}
          - Messages (Today): ${totalNetworkMessages}
          `,
          inline: true,
        },
      ]);

    const linksRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Guide')
        .setStyle(ButtonStyle.Link)
        .setEmoji(emojis.docs_icon)
        .setURL(docsLink),
      new ButtonBuilder()
        .setLabel('Support')
        .setStyle(ButtonStyle.Link)
        .setEmoji(emojis.code_icon)
        .setURL(LINKS.SUPPORT_INVITE),
      new ButtonBuilder()
        .setLabel('Invite')
        .setStyle(ButtonStyle.Link)
        .setEmoji(emojis.add_icon)
        .setURL(`https://discord.com/application-directory/${interaction.client.user?.id}`),
    );
    const otherBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Shard Info')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.crystal)
        .setCustomId(new CustomID().setIdentifier('stats', 'shardStats').toString()),
    );

    await interaction.editReply({ embeds: [embed], components: [linksRow, otherBtns] });
  }

  @RegisterInteractionHandler('stats')
  async handleComponents(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);

    if (customId.postfix === 'shardStats') {
      const embed = new EmbedBuilder()
        .setColor(colors.invisible)
        .setDescription(
          stripIndents`
          ### Shard Stats
          **Total Shards:** ${interaction.client.cluster.info.TOTAL_SHARDS}
          `,
        )
        .setFields(
          interaction.client.ws.shards.map((shard) => ({
            name: `Shard #${shard.id}`,
            value: stripIndents`
              \`\`\`elm
              Status: ${Status[shard.status]}
              Uptime: ${msToReadable(shard.manager.client.uptime || 0)}
              Servers: ${shard.manager.client.guilds.cache.size}
              Ping: ${shard.ping}ms
              \`\`\`
            `,
            inline: true,
          })),
        )
        .setFooter({
          text: `InterChat v${interaction.client.version}${isDevBuild ? '+dev' : ''}`,
          iconURL: interaction.client.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
