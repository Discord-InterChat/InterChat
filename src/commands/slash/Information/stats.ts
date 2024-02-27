import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  time,
} from 'discord.js';
import db from '../../../utils/Db.js';
import BaseCommand from '../../../core/BaseCommand.js';
import { cpus, totalmem } from 'os';
import { LINKS, colors, emojis, isDevBuild } from '../../../utils/Constants.js';
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

    const { connectedList, originalMessages, hubs } = db;
    const totalConnections = await connectedList?.count();
    const totalHubs = await hubs?.count();
    const totalNetworkMessages = await originalMessages.count();

    const count: number[] = await interaction.client.cluster.fetchClientValues('guilds.cache.size');
    const guildCount = count.reduce((p, n) => p + n, 0);
    const memberCount = await interaction.client.cluster.fetchClientValues(
      'guilds.cache.reduce((p, n) => p + n.memberCount, 0)',
    );

    const upSince = new Date(Date.now() - interaction.client.uptime);
    const totalMemory = Math.round(totalmem() / 1024 / 1024 / 1024);
    const memoryUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    const embed = new EmbedBuilder()
      .setColor(colors.interchatBlue)
      .setTitle(`${interaction.client.user.username} Statistics`)
      .setFooter({
        text: `InterChat v${interaction.client.version}${isDevBuild ? '+dev' : ''}`,
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .addFields([
        {
          name: 'Bot Stats',
          value: stripIndents`
					- Up Since: ${time(upSince, 'R')}
					- Servers: ${guildCount}
					- Members: ${memberCount}
					`,
          inline: true,
        },
        {
          name: 'System Stats',
          value: stripIndents`
						- OS: Linux
						- CPU Cores: ${cpus().length}
						- RAM Usage: ${memoryUsed} MB / ${totalMemory} GB
						`,
          inline: true,
        },
        {
          name: 'Hub Stats',
          value: stripIndents`- Total Hubs: ${totalHubs}- Total Connected: ${totalConnections}- Messages (Today): ${totalNetworkMessages}`,
          inline: false,
        },
      ]);

    const linksRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Guide')
        .setStyle(ButtonStyle.Link)
        .setEmoji(emojis.docs_icon)
        .setURL(LINKS.DOCS),
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

    const allCusterData = await interaction.client.cluster.broadcastEval((client) => {
      const { Status } = require('discord.js');
      const memoryUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

      const res = client.ws.shards.map((shard) => ({
        name: `Shard #${shard.id} - ${Status[shard.status]}`,
        value: `\`\`\`elm\n\nPing: ${shard.ping}ms\nUptime: ${shard.manager.client.uptime}ms\nTotal Servers: ${shard.manager.client.guilds.cache.size}\nRAM Usage: ${memoryUsed} MB\`\`\``,
        inline: true,
      }));

      return res;
    });

    if (customId.suffix === 'shardStats') {
      const embed = new EmbedBuilder()
        .setColor(colors.invisible)
        .setDescription(
          stripIndents`
					### Shard Stats
					**Total Shards:** ${interaction.client.cluster.info.TOTAL_SHARDS} 
					**On Shard:** ${interaction.guild?.shardId}
					`,
        )
        .setFields(allCusterData.flat().slice(0, 25))
        .setFooter({
          text: `InterChat v${interaction.client.version}${isDevBuild ? '+dev' : ''}`,
          iconURL: interaction.client.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
