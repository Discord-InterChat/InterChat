import HubCommand from '#main/commands/slash/Main/hub/index.js';
import { emojis } from '#main/config/Constants.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { HubJoinService } from '#main/modules/HubJoinService.js';
import { Pagination } from '#main/modules/Pagination.js';
import { getHubConnections } from '#main/utils/ConnectedListUtils.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { calculateRating, getStars } from '#main/utils/Utils.js';
import { connectedList, Hub } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedField,
  time,
} from 'discord.js';

export default class BrowseCommand extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    await interaction.deferReply();
    // find all hubs with more than 3 connections
    const hubs = await db.hub.findMany({ where: { private: false, locked: false } });

    if (!hubs.length) {
      await this.replyEmbed(interaction, 'hub.notFound', { t: { emoji: emojis.slash } });
      return;
    }

    const connections = await Promise.all(
      hubs.map(async (h) => (await getHubConnections(h.id)).filter((c) => c.connected)),
    );

    // make paginated embed with 4 hubs in each page as a field
    await new Pagination()
      .addPages(this.getPages(interaction.guildId, hubs, connections))
      .run(interaction);
  }

  private buildEmbed(totalHubs: number, fields: EmbedField[]) {
    return new InfoEmbed().addFields(fields).setDescription(
      stripIndents`### Discoverable Hubs
          There are **${totalHubs}** hubs currently available for you to join.`,
    );
  }

  @RegisterInteractionHandler('hub_browse', 'join')
  async handleJoin(interaction: ButtonInteraction) {
    if (!interaction.inCachedGuild() || !interaction.channel?.isTextBased()) return;
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId] = customId.args;

    const joinService = new HubJoinService(interaction, await this.getLocale(interaction));
    await joinService.joinHub(interaction.channel, hubId);
  }

  private buildField(hub: Hub, connections: connectedList[]) {
    const lastActiveConnection = connections.filter((c) => c.hubId === hub.id).at(0);

    return {
      name: `${hub.name} (${getStars(calculateRating(hub.rating.map((r) => r.rating)))})`,
      value: `${emojis.user_icon} ${connections.length} ・ ${emojis.chat_icon} ${time(lastActiveConnection?.lastActive ?? new Date(), 'R')}\n\n${hub.description}`,
      inline: true,
    };
  }

  private buildButtons(guildId: string, hub: Hub, connections: connectedList[]) {
    const disabled = connections.some((c) => c.serverId === guildId);
    const joinButton = new ButtonBuilder()
      .setCustomId(new CustomID('hub_browse:join', [hub.id]).toString())
      .setDisabled(disabled)
      .setLabel(`Join ${hub.name}`)
      .setStyle(ButtonStyle.Success)
      .setEmoji(emojis.join);
    const rateButton = new ButtonBuilder()
      .setCustomId(new CustomID('hub_browse:rate', [hub.id]).toString())
      .setDisabled(disabled)
      .setLabel(`Rate ${hub.name}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⭐');

    return { joinButton, rateButton };
  }

  private getPages(guildId: string, hubs: Hub[], connections: connectedList[][]) {
    // using foreach loop
    const pages: BaseMessageOptions[] = [];
    let fields: EmbedField[] = [];
    let buttons = {
      join: new ActionRowBuilder<ButtonBuilder>(),
      rate: new ActionRowBuilder<ButtonBuilder>(),
    };

    hubs.forEach((hub, index) => {
      if (index === hubs.length - 1 || fields.length === 4) {
        pages.push({
          content:
            '**✨ NEW**: View and join hubs directly from the website, with a much better experience! - https://interchat.fun/hubs',
          embeds: [this.buildEmbed(hubs.length, fields)],
          components: [buttons.join.toJSON(), buttons.rate.toJSON()],
        });

        fields = [];
        buttons = {
          join: new ActionRowBuilder<ButtonBuilder>(),
          rate: new ActionRowBuilder<ButtonBuilder>(),
        };
      }

      const hubConnections = connections[index];
      fields.push(this.buildField(hub, hubConnections));

      const { joinButton, rateButton } = this.buildButtons(guildId, hub, hubConnections);
      buttons.join.addComponents(joinButton);
      buttons.rate.addComponents(rateButton);
    });

    return pages;
  }
}
