import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Status,
} from 'discord.js';
import db from '../../../utils/Db.js';
import BaseCommand from '../../BaseCommand.js';
import { cpus, totalmem } from 'os';
import { colors, isDevBuild } from '../../../utils/Constants.js';
import { msToReadable } from '../../../utils/Utils.js';
import { stripIndents } from 'common-tags';

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

    const count = (await interaction.client.cluster.fetchClientValues(
      'guilds.cache.size',
    )) as number[];
    const guildCount = count.reduce((p, n) => p + n, 0);

    const uptime = msToReadable(interaction.client.uptime);
    const docsLink = 'https://discord-interchat.github.io/docs';
    const supportServer = 'https://discord.gg/6bhXQynAPs';

    const embed = new EmbedBuilder()
      .setColor(colors.invisible)
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
          name: 'Shard Stats',
          value: stripIndents`
          - ID: 1
          - State: ${interaction.guild ? Status[interaction.guild.shard.status] : 'Disconnected'}
          - Ping: \`${interaction.guild?.shard.ping}ms\``,
          inline: true,
        },
        {
          name: 'Hub Stats',
          value: stripIndents`
          - Total Hubs: ${totalHubs}
          - Total Connected: ${totalConnections}
          - Messages (Today): ${totalNetworkMessages}
          `,
          inline: true,
        },
        { name: '\u200B', value: '\u200B', inline: true },
      ]);

    const linksRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('Support').setStyle(ButtonStyle.Link).setURL(supportServer),
      new ButtonBuilder().setLabel('Guide').setStyle(ButtonStyle.Link).setURL(docsLink),
      new ButtonBuilder()
        .setLabel('Invite')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/application-directory/${interaction.client.user?.id}`),
    );

    await interaction.editReply({ embeds: [embed], components: [linksRow] });
  }
}
