import HubCommand from '#main/commands/slash/Main/hub/index.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { hubLeaveConfirmButtons } from '#main/interactions/HubLeaveConfirm.js';
import ConnectionManager from '#main/managers/ConnectionManager.js';
import HubManager from '#main/managers/HubManager.js';
import { Pagination } from '#main/modules/Pagination.js';
import { HubJoinService } from '#main/services/HubJoinService.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import Constants from '#utils/Constants.js';
import { Hub } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  BaseMessageOptions,
  ChatInputCommandInteraction,
  EmbedField,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  time,
} from 'discord.js';

export default class BrowseCommand extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    await interaction.deferReply();
    // find all hubs with more than 3 connections
    const hubs = (await db.hub.findMany({ where: { private: false, locked: false } })).map(
      (h) => new HubManager(h),
    );

    if (!hubs.length) {
      await this.replyEmbed(interaction, 'hub.notFound', { t: { emoji: this.getEmoji('slash') } });
      return;
    }

    // make paginated embed with 4 hubs in each page as a field
    await new Pagination(interaction.client)
      .addPages(
        await this.getPages(interaction.guildId, hubs),
      )
      .run(interaction);
  }

  private buildEmbed(totalHubs: number, fields: EmbedField[]) {
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

  @RegisterInteractionHandler('hub_browse', 'joinLeaveMenu')
  async handleJoinLeave(interaction: StringSelectMenuInteraction) {
    if (!interaction.inCachedGuild() || !interaction.channel?.isTextBased()) return;
    const [action, chosenHubId] = interaction.values[0].split(':');

    if (!interaction.memberPermissions.has('ManageMessages', true)) {
      await interaction.deferUpdate();
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const hub = await this.hubService.fetchHub(chosenHubId);
    if (!hub) {
      await interaction.reply({ content: 'Hub not found.', ephemeral: true });
      return;
    }
    if (action === 'join') {
      const joinService = new HubJoinService(interaction, await this.getLocale(interaction));
      await joinService.joinHub(interaction.channel, hub.data.name);
    }
    else if (action === 'leave') {
      const connection = (await hub.connections.toArray()).find(
        (c) => c.data.serverId === interaction.guildId,
      );

      if (!connection) {
        await interaction.editReply(`${this.getEmoji('neutral')} This server is not in this hub.`);
        return;
      }

      await interaction.editReply({
        content: 'Are you sure you want to leave this hub?',
        components: [hubLeaveConfirmButtons(connection.data.channelId, connection.hubId)],
      });
    }
  }

  private buildField(hub: Hub, connections: ConnectionManager[]) {
    const lastActiveConnection = connections.filter((c) => c.hubId === hub.id).at(0);

    return {
      name: `${hub.name}`,
      value:
        `${this.getEmoji('person_icon')} ${connections.length} ・ ${this.getEmoji('chat_icon')} ${time(lastActiveConnection?.data.lastActive ?? new Date(), 'R')}\n\n${hub.description}`.slice(
          0,
          300,
        ),
      inline: true,
    };
  }

  private buildMenuOption(guildId: string, hub: HubManager, connections: ConnectionManager[]) {
    const disabled = connections.some((c) => c.data.serverId === guildId);
    const joinOption = new StringSelectMenuOptionBuilder()
      .setLabel(disabled ? `Leave ${hub.data.name}` : `Join ${hub.data.name}`)
      .setValue(disabled ? `leave:${hub.id}` : `join:${hub.id}`)
      .setEmoji(disabled ? this.getEmoji('hangup_icon') : this.getEmoji('call_icon'));

    return { joinOption };
  }

  private async getPages(guildId: string, hubs: HubManager[]) {
    const pages: BaseMessageOptions[] = [];
    let fields: EmbedField[] = [];

    const connections = await Promise.all(
      hubs.map(async (h) => (await h.connections.toArray()).filter((c) => c.data.connected)),
    );

    const joinMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(new CustomID('hub_browse:joinLeaveMenu').toString())
        .setPlaceholder('👋 Select a hub to leave/join...'),
    );

    hubs.forEach((hub, index) => {
      if (index % 2 === 0 && index !== 0) {
        fields.push({ name: '\u200b', value: '\u200b', inline: true });
      }


      if (index === hubs.length - 1 || fields.length === 6) {
        pages.push({
          content: `**✨ NEW**: View and join hubs directly from the website, with a much better experience! - ${Constants.Links.Website}/hubs`,
          embeds: [this.buildEmbed(hubs.length, fields)],
          components: [joinMenu.toJSON()],
        });

        fields = [];

        // reset the menu
        joinMenu.components[0].spliceOptions(0, joinMenu.components[0].options.length);
      }

      const hubConnections = connections[index];
      fields.push(this.buildField(hub.data, hubConnections));

      const { joinOption } = this.buildMenuOption(guildId, hub, hubConnections);
      joinMenu.components[0].addOptions(joinOption);
    });

    return pages;
  }
}
