import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { RegisterInteractionHandler } from '#src/decorators/RegisterInteractionHandler.js';
import { hubLeaveConfirmButtons } from '#src/interactions/HubLeaveConfirm.js';
import type ConnectionManager from '#src/managers/ConnectionManager.js';
import HubManager from '#src/managers/HubManager.js';
import { Pagination } from '#src/modules/Pagination.js';
import { HubJoinService } from '#src/services/HubJoinService.js';
import { HubService } from '#src/services/HubService.js';
import { CustomID } from '#src/utils/CustomID.js';
import db from '#src/utils/Db.js';
import { InfoEmbed } from '#src/utils/EmbedUtils.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import { fetchUserLocale } from '#src/utils/Utils.js';
import Constants from '#utils/Constants.js';
import type { Hub } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  type BaseMessageOptions,
  type Client,
  type EmbedField,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  time,
} from 'discord.js';

const HUBS_PER_PAGE = 4;

export default class BrowseCommand extends BaseCommand {
  constructor() {
    super({
      name: 'browse',
      description: '🔍 Browse public hubs and join them!',
      types: { slash: true, prefix: true },
    });
  }
  private readonly hubService = new HubService();
  async execute(ctx: Context): Promise<void> {
    if (!ctx.inGuild()) return;

    await ctx.deferReply();

    const hubs = await this.fetchAvailableHubs();

    if (!hubs.length) {
      await ctx.replyEmbed('hub.notFound', {
        t: { emoji: ctx.getEmoji('slash') },
      });
      return;
    }

    await new Pagination(ctx.client)
      .addPages(await this.generateHubPages(ctx.client, ctx.guildId, hubs))
      .run(ctx);
  }

  @RegisterInteractionHandler('hub_browse', 'joinLeaveMenu')
  async handleJoinLeave(
    interaction: StringSelectMenuInteraction<'cached'>,
  ): Promise<void> {
    if (!interaction.inCachedGuild() || !interaction.channel?.isTextBased()) return;

    const [action, chosenHubId] = interaction.values[0].split(':');

    if (!interaction.memberPermissions.has('ManageMessages', true)) {
      await interaction.deferUpdate();
      return;
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const hub = await this.hubService.fetchHub(chosenHubId);
    if (!hub) {
      await interaction.editReply({ content: 'Hub not found.' });
      return;
    }

    await this.processHubAction(interaction, action, hub);
  }

  private async processHubAction(
    interaction: StringSelectMenuInteraction<'cached'>,
    action: string,
    hub: HubManager,
  ): Promise<void> {
    if (action === 'join') {
      await this.handleJoinAction(interaction, hub);
    }
    else if (action === 'leave') {
      await this.handleLeaveAction(interaction, hub);
    }
  }

  private async handleJoinAction(
    interaction: StringSelectMenuInteraction<'cached'>,
    hub: HubManager,
  ): Promise<void> {
    const joinService = new HubJoinService(
      interaction,
      await fetchUserLocale(interaction.user.id),
    );

    if (!interaction.channel) return;

    await joinService.joinHub(interaction.channel, hub.data.name);
  }

  private async handleLeaveAction(
    interaction: StringSelectMenuInteraction<'cached'>,
    hub: HubManager,
  ): Promise<void> {
    const connection = (await hub.connections.fetch()).find(
      (c) => c.data.serverId === interaction.guildId,
    );

    if (!connection) {
      await interaction.editReply(
        `${getEmoji('neutral', interaction.client)} This server is not in this hub.`,
      );
      return;
    }

    await interaction.editReply({
      content: 'Are you sure you want to leave this hub?',
      components: [
        hubLeaveConfirmButtons(connection.channelId, connection.hubId),
      ],
    });
  }
  /* ------------------------------------------------------------------------------------ */
  private async fetchAvailableHubs(): Promise<HubManager[]> {
    const hubs = await db.hub.findMany({
      where: { private: false, locked: false },
    });
    return hubs.map((hub) => new HubManager(hub));
  }

  private async generateHubPages(
    client: Client,
    guildId: string,
    hubs: HubManager[],
  ): Promise<BaseMessageOptions[]> {
    const pages: BaseMessageOptions[] = [];
    const connectionsByHub = new Map<string, ConnectionManager[]>();

    // Fetch all connections upfront to avoid repeated database calls
    for (const hub of hubs) {
      const connections = (await hub.connections.fetch()).filter(
        (c) => c.data.connected,
      );
      connectionsByHub.set(hub.id, connections);
    }

    for (let i = 0; i < hubs.length; i += HUBS_PER_PAGE) {
      const pageHubs = hubs.slice(i, i + HUBS_PER_PAGE);
      const page = this.buildHubsPage(
        client,
        guildId,
        pageHubs,
        connectionsByHub,
      );
      pages.push(page);
    }

    return pages;
  }

  private buildHubsPage(
    client: Client,
    guildId: string,
    pageHubs: HubManager[],
    connectionsByHub: Map<string, ConnectionManager[]>,
  ): BaseMessageOptions {
    const fields: EmbedField[] = [];
    const joinMenu =
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			  new StringSelectMenuBuilder()
			    .setCustomId(new CustomID('hub_browse:joinLeaveMenu').toString())
			    .setPlaceholder('👋 Select a hub to leave/join...'),
			);

    let fieldIndex = 0;
    for (const hub of pageHubs) {
      if (fieldIndex % 2 === 1) {
        fields.push({ name: '\u200b', value: '\u200b', inline: true });
        fieldIndex++;
      }

      const hubConnections = connectionsByHub.get(hub.id) || [];
      fields.push(this.buildHubField(client, hub.data, hubConnections));
      joinMenu.components[0].addOptions(
        this.buildHubMenuOption(client, guildId, hub, hubConnections),
      );
      fieldIndex++;
    }

    // Pad with empty fields if necessary to ensure proper layout
    while (fields.length % 3 !== 0 && fields.length > 0) {
      fields.push({ name: '\u200b', value: '\u200b', inline: true });
    }

    return {
      content: `**✨ NEW**: View and join hubs directly from the website, with a much better experience! - ${Constants.Links.Website}/hubs`,
      embeds: [this.buildHubListEmbed(pageHubs.length, fields)],
      components: [joinMenu.toJSON()],
    };
  }

  private buildHubListEmbed(
    totalHubs: number,
    fields: EmbedField[],
  ): InfoEmbed {
    return new InfoEmbed()
      .addFields(fields)
      .setThumbnail('https://i.imgur.com/tWuSzBd.png')
      .setDescription(
        stripIndents`### Discoverable Hubs
          There are **${totalHubs}** hubs currently available for you to join.`,
      )
      .setFooter({
        text: 'Use /hub join <hub name> or use the menu below to join any one of these!',
      });
  }

  private buildHubField(
    client: Client,
    hub: Hub,
    connections: ConnectionManager[],
  ): EmbedField {
    const lastActiveConnection = connections.at(0); // Assuming the first connection is the most recently active

    return {
      name: `${hub.name}`,
      value: stripIndents`${getEmoji('person_icon', client)} ${connections.length}
              ${getEmoji('chat_icon', client)} ${time(lastActiveConnection?.data.lastActive ?? new Date(), 'R')}

              ${hub.description}`.slice(0, 300),
      inline: true,
    };
  }

  private buildHubMenuOption(
    client: Client,
    guildId: string,
    hub: HubManager,
    connections: ConnectionManager[],
  ): StringSelectMenuOptionBuilder {
    const isMember = connections.some((c) => c.data.serverId === guildId);
    const label = isMember ? `Leave ${hub.data.name}` : `Join ${hub.data.name}`;
    const value = isMember ? `leave:${hub.id}` : `join:${hub.id}`;
    const emoji = isMember
      ? getEmoji('hangup_icon', client)
      : getEmoji('call_icon', client);

    return new StringSelectMenuOptionBuilder()
      .setLabel(label)
      .setValue(value)
      .setEmoji(emoji);
  }
}
