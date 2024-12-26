import { Pagination } from '#main/modules/Pagination.js';
import Constants from '#utils/Constants.js';
import { t } from '#utils/Locale.js';
import { resolveEval } from '#utils/Utils.js';
import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import HubCommand from './index.js';

export default class Servers extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const hubOpt = interaction.options.getString('hub', true);
    const serverOpt = interaction.options.getString('server');
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const hub = (await this.hubService.findHubsByName(hubOpt)).at(0);
    if (!hub) {
      await this.replyEmbed(interaction, t('hub.notFound', locale, { emoji: this.getEmoji('x_icon') }));
      return;
    }
    else if (!(await hub.isMod(interaction.user.id))) {
      await this.replyEmbed(interaction, t('hub.notFound_mod', locale, { emoji: this.getEmoji('x_icon') }));
      return;
    }

    const connections = await hub.fetchConnections();
    if (connections.length === 0) {
      await this.replyEmbed(
        interaction,
        t('hub.servers.noConnections', locale, { emoji: this.getEmoji('x_icon') }),
      );
      return;
    }

    if (serverOpt) {
      const connection = connections.find((con) => con.serverId === serverOpt);
      if (!connection) {
        await this.replyEmbed(
          interaction,
          t('hub.servers.notConnected', locale, { hub: hub.data.name, emoji: this.getEmoji('x_icon') }),
        );
        return;
      }
      const server = await interaction.client.guilds.fetch(serverOpt).catch(() => null);
      const channel = await server?.channels.fetch(connection.channelId).catch(() => null);
      const embed = new EmbedBuilder()
        .setTitle(`${server?.name} \`(${connection.serverId})\``)
        .setColor(Constants.Colors.interchatBlue)
        .setDescription(
          t('hub.servers.connectionInfo', locale, {
            channelName: `${channel?.name}`,
            channelId: connection.channelId,
            joinedAt: `<t:${Math.round(connection.createdAt.getTime() / 1000)}:d>`,
            invite: connection.invite ? connection.invite : 'Not Set.',
            connected: connection.connected ? 'Yes' : 'No',
          }),
        );

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const paginator = new Pagination(interaction.client);
    let itemsPerPage = 5;

    for (let index = 0; index < connections.length; index += 5) {
      const current = connections?.slice(index, itemsPerPage);

      let itemCounter = index;
      let embedFromIndex = index;
      itemsPerPage += 5;

      const fields = current.map(async (connection) => {
        const evalArr = await interaction.client.cluster.broadcastEval(
          async (client, ctx) => {
            const server = client.guilds.cache.get(ctx.connection.serverId);

            if (server) {
              const channel = await server?.channels
                .fetch(ctx.connection.channelId)
                .catch(() => null);
              return { serverName: server.name, channelName: channel?.name };
            }
            return null;
          },
          { context: { connection } },
        );

        const evalRes = resolveEval(evalArr);

        const value = t('hub.servers.connectionInfo', locale, {
          channelName: `${evalRes?.channelName}`,
          channelId: connection.channelId,
          joinedAt: `<t:${Math.round(connection.createdAt.getTime() / 1000)}:d>`,
          invite: connection.invite ? connection.invite : 'Not Set.',
          connected: connection.connected ? 'Yes' : 'No',
        });

        return { name: `${++itemCounter}. ${evalRes?.serverName}`, value };
      });

      paginator.addPage({
        embeds: [
          new EmbedBuilder()
            .setDescription(
              t('hub.servers.total', locale, {
                from: `${++embedFromIndex}`,
                to: `${itemCounter}`,
                total: `${connections.length}`,
              }),
            )
            .setColor(0x2f3136)
            .setFields(await Promise.all(fields)),
        ],
      });
    }

    await paginator.run(interaction);
  }
}
