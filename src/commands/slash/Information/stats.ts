import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { donateButton } from '#main/utils/ComponentUtils.js';
import Constants from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import { msToReadable } from '#utils/Utils.js';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Status,
  time,
} from 'discord.js';
import { cpus, totalmem } from 'os';

export default class Stats extends BaseCommand {
  override readonly data = {
    name: 'stats',
    description: '📊 View InterChat\'s statistics.',
    integration_types: [0, 1], // 0 = GUILD_INSTALL, 1 = USER_INSTALL
    contexts: [0, 1, 2], // 0 = GUILD, 1 = BOT_DM, 2 = PRIVATE_CHANNEL
  };

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildCount: number[] =
      await interaction.client.cluster.fetchClientValues('guilds.cache.size');
    const memberCount: number[] = await interaction.client.cluster.fetchClientValues(
      'guilds.cache.reduce((p, n) => p + n.memberCount, 0)',
    );

    const upSince = new Date(Date.now() - interaction.client.uptime);
    const totalMemory = Math.round(totalmem() / 1024 / 1024 / 1024);
    const memoryUsedRaw = await interaction.client.cluster.broadcastEval(() =>
      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    );
    const memoryUsed = memoryUsedRaw.reduce((p, n) => p + (n ?? 0), 0);

    const embed = new EmbedBuilder()
      .setColor(Constants.Colors.interchatBlue)
      .setDescription(`### ${this.getEmoji('fire_icon')} InterChat Statistics`)
      .setFooter({
        text: `InterChat v${interaction.client.version}${Constants.isDevBuild ? '+dev' : ''}`,
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .addFields([
        {
          name: `${this.getEmoji('bot_icon')} Bot Stats`,
          value: stripIndents`
	          Up Since: ${time(upSince, 'R')}
            Servers: ${guildCount.reduce((p, n) => p + n, 0)}
	          Members: ${memberCount.reduce((p, n) => p + n, 0)}`,
          inline: true,
        },
        {
          name: `${this.getEmoji('gear_icon')} System Stats`,
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
        .setEmoji(this.getEmoji('plus_icon'))
        .setURL(`https://discord.com/application-directory/${interaction.client.user?.id}`),
      new ButtonBuilder()
        .setLabel('Support')
        .setStyle(ButtonStyle.Link)
        .setEmoji(this.getEmoji('code_icon'))
        .setURL(Constants.Links.SupportInvite),
      donateButton,
    );
    const otherBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Shard Info')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(this.getEmoji('crystal'))
        .setCustomId(new CustomID().setIdentifier('stats', 'shardStats').toString()),
    );

    await interaction.editReply({ embeds: [embed], components: [linksRow, otherBtns] });
  }

  @RegisterInteractionHandler('stats', 'shardStats')
  override async handleComponents(interaction: ButtonInteraction) {
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
