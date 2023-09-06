import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { toHuman, getDb, colors } from '../../Utils/functions/utils';
import { totalmem } from 'os';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Shows the bot\'s statistics'),
  async execute(interaction: ChatInputCommandInteraction) {
    const { connectedList, messageData } = getDb();
    const allConnected = await connectedList?.findMany({});
    const connectionCount = allConnected.length;
    const totalNetworkMessages = await messageData.count();

    const uptime = toHuman(interaction.client.uptime);
    const docsLink = 'https://discord-interchat.github.io/docs';
    const supportServer = 'https://discord.gg/6bhXQynAPs';

    const embed = new EmbedBuilder()
      .setColor(colors('chatbot'))
      .setTitle(`${interaction.client.user.username} Statistics`)
      .setDescription(`__Networks__: ${connectionCount} • __Network Messges__: ${totalNetworkMessages}`)
      .setFooter({ text: 'Network Messages reset every 24 hours.' })
      .addFields([
        { name: 'Uptime', value: uptime, inline: true },
        { name: 'Ping:', value: `${interaction.client.ws.ping}ms`, inline: true },
        { name: 'Bot Version:', value: `v${interaction.client.version}`, inline: true },
        { name: 'Servers:', value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: 'Ram Usage:', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB / ${Math.round(totalmem() / 1024 / 1024 / 1024)} GB`, inline: true },
        { name: 'Commands', value: `${interaction.client.commands.size}`, inline: true },
      ]);

    const linksRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Support')
        .setStyle(ButtonStyle.Link)
        .setURL(supportServer),
      new ButtonBuilder()
        .setLabel('Guide')
        .setStyle(ButtonStyle.Link)
        .setURL(docsLink),
      new ButtonBuilder()
        .setLabel('Invite')
        .setStyle(ButtonStyle.Link)
        .setURL(interaction.client.invite),
    );

    await interaction.reply({ embeds: [embed], components: [linksRow] });
  },

};
