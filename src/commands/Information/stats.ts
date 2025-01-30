import { cpus, totalmem } from 'node:os';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  Status,
  time,
} from 'discord.js';
import BaseCommand from '#src/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#src/decorators/RegisterInteractionHandler.js';
import { donateButton } from '#src/utils/ComponentUtils.js';
import Constants from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import { msToReadable } from '#utils/Utils.js';
import type Context from '#src/core/CommandContext/Context.js';

export default class Stats extends BaseCommand {
  constructor() {
    super({
      name: 'stats',
      description: '📊 View InterChat\'s statistics.',
      types: {
        slash: true,
        prefix: true,
      },
      contexts: {
        userInstall: true,
      },
    });
  }

  async execute(ctx: Context) {
    await ctx.deferReply();

    const guildCount: number[] =
      await ctx.client.cluster.fetchClientValues('guilds.cache.size');
    const memberCount: number[] = await ctx.client.cluster.fetchClientValues(
      'guilds.cache.reduce((p, n) => p + n.memberCount, 0)',
    );

    const upSince = new Date(Date.now() - ctx.client.uptime);
    const totalMemory = Math.round(totalmem() / 1024 / 1024 / 1024);
    const memoryUsedRaw = await ctx.client.cluster.broadcastEval(() =>
      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    );
    const memoryUsed = memoryUsedRaw.reduce((p, n) => p + (n ?? 0), 0);

    const embed = new EmbedBuilder()
      .setColor(Constants.Colors.interchatBlue)
      .setDescription(`### ${ctx.getEmoji('fire_icon')} InterChat Statistics`)
      .setFooter({
        text: `InterChat v${ctx.client.version}${Constants.isDevBuild ? '+dev' : ''}`,
        iconURL: ctx.client.user.displayAvatarURL(),
      })
      .addFields([
        {
          name: `${ctx.getEmoji('bot_icon')} Bot Stats`,
          value: stripIndents`
	          Up Since: ${time(upSince, 'R')}
            Servers: ${guildCount.reduce((p, n) => p + n, 0)}
	          Members: ${memberCount.reduce((p, n) => p + n, 0)}`,
          inline: true,
        },
        {
          name: `${ctx.getEmoji('gear_icon')} System Stats`,
          value: stripIndents`
            OS: Linux
            CPU Cores: ${cpus().length}
            RAM Usage: ${memoryUsed} MB / ${totalMemory} GB`,
          inline: true,
        },
      ]);

    const linksRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Invite')
        .setStyle(ButtonStyle.Link)
        .setEmoji(ctx.getEmoji('plus_icon'))
        .setURL(`https://discord.com/application-directory/${ctx.client.user?.id}`),
      new ButtonBuilder()
        .setLabel('Support')
        .setStyle(ButtonStyle.Link)
        .setEmoji(ctx.getEmoji('code_icon'))
        .setURL(Constants.Links.SupportInvite),
      donateButton,
    );
    const otherBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Shard Info')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(ctx.getEmoji('crystal'))
        .setCustomId(new CustomID().setIdentifier('stats', 'shardStats').toString()),
    );

    await ctx.editReply({
      embeds: [embed],
      components: [linksRow, otherBtns],
    });
  }

  @RegisterInteractionHandler('stats', 'shardStats')
  async handleComponents(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);

    const allCusterData = await interaction.client.cluster.broadcastEval((client) =>
      client.ws.shards.map((shard) => ({
        id: shard.id,
        status: shard.status,
        ping: shard.ping,
        uptime: shard.manager.client.uptime,
        totalGuilds: shard.manager.client.guilds.cache.size,
        memUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      })),
    );

    if (customId.suffix !== 'shardStats') return;

    const embed = new EmbedBuilder()
      .setColor(Constants.Colors.invisible)
      .setDescription(
        stripIndents`
					### Shard Stats
					**Total Shards:** ${interaction.client.cluster.info.TOTAL_SHARDS} 
					**On Shard:** ${interaction.guild?.shardId ?? 0}
					`,
      )
      .setFields(
        allCusterData.flat().map((shard) => ({
          name: `Shard #${shard.id} - ${Status[shard.status]}`,
          value: stripIndents`\`\`\`elm
              Ping: ${shard.ping}ms
              Uptime: ${shard.uptime ? msToReadable(shard.uptime) : '0 ms'}
              Servers: ${shard.totalGuilds}
              RAM Usage: ${shard.memUsage} MB
              \`\`\`
            `,
          inline: true,
        })),
      )
      .setFooter({
        text: `InterChat v${interaction.client.version}${Constants.isDevBuild ? '+dev' : ''}`,
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
  }
}
