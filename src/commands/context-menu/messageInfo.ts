import {
  type ActionRow,
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  type ButtonComponent,
  type ButtonInteraction,
  ButtonStyle,
  type CacheType,
  ComponentType,
  EmbedBuilder,
  type Guild,
  InteractionContextType,
  type MessageContextMenuCommandInteraction,
  ModalBuilder,
  type ModalSubmitInteraction,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
  TextInputBuilder,
  TextInputStyle,
  type User,
  codeBlock,
  time,
} from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { modPanelButton } from '#main/interactions/ShowModPanel.js';
import type ConnectionManager from '#main/managers/ConnectionManager.js';
import HubLogManager from '#main/managers/HubLogManager.js';
import type HubManager from '#main/managers/HubManager.js';
import { HubService } from '#main/services/HubService.js';
import { findOriginalMessage, getOriginalMessage } from '#main/utils/network/messageUtils.js';
import type { RemoveMethods } from '#types/CustomClientProps.d.ts';
import { greyOutButton, greyOutButtons } from '#utils/ComponentUtils.js';
import Constants from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import { sendHubReport } from '#utils/hub/logger/Report.js';
import { isStaffOrHubMod } from '#utils/hub/utils.js';
import { fetchUserLocale } from '#main/utils/Utils.js';

type LocaleInfo = { locale: supportedLocaleCodes };
type AuthorInfo = { author: User };
type ServerInfo = { server: RemoveMethods<Guild> | undefined };
type HubInfo = { hub: HubManager | null };
type MsgInfo = { messageId: string };

type UserInfoOpts = LocaleInfo & AuthorInfo;
type MsgInfoOpts = AuthorInfo & ServerInfo & LocaleInfo & HubInfo & MsgInfo;
type ReportOpts = LocaleInfo & HubInfo & MsgInfo;
type ServerInfoOpts = LocaleInfo & ServerInfo & { connection: ConnectionManager | undefined };

export default class MessageInfo extends BaseCommand {
  readonly data: RESTPostAPIContextMenuApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Message Info/Report',
    contexts: [InteractionContextType.Guild],
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    await interaction.deferReply({ flags: ['Ephemeral'] });

    const target = interaction.targetMessage;

    const { locale, originalMsg, hub } = await this.getMessageInfo(interaction);

    if (!hub || !originalMsg) {
      await interaction.followUp({
        content: t('errors.unknownNetworkMessage', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        flags: ['Ephemeral'],
      });
      return;
    }

    const author = await interaction.client.users.fetch(originalMsg.authorId);
    const server = await interaction.client.fetchGuild(originalMsg.guildId);

    const embed = new EmbedBuilder()
      .setDescription(`### ${this.getEmoji('info')} Message Info`)
      .addFields([
        { name: 'Sender', value: codeBlock(author.username), inline: true },
        {
          name: 'From Server',
          value: codeBlock(`${server?.name}`),
          inline: true,
        },
        { name: 'Which Hub?', value: codeBlock(hub.data.name), inline: true },
        {
          name: 'Message ID',
          value: codeBlock(originalMsg.messageId),
          inline: true,
        },
        {
          name: 'Sent At',
          value: time(new Date(originalMsg.timestamp), 't'),
          inline: true,
        },
      ])
      .setThumbnail(author.displayAvatarURL())
      .setColor(Constants.Colors.invisible);

    const connection = (await hub.connections.fetch())?.find(
      (c) => c.data.connected && c.data.serverId === originalMsg.guildId,
    );
    const components = this.buildButtons(target.id, locale, {
      buildModActions: await isStaffOrHubMod(interaction.user.id, hub),
      inviteButtonUrl: connection?.data.invite,
    });

    const reply = await interaction.followUp({
      embeds: [embed],
      components,
      flags: ['Ephemeral'],
    });
    const collector = reply.createMessageComponentCollector({
      idle: 60_000,
      componentType: ComponentType.Button,
    });

    collector.on('collect', (i) => {
      const customId = CustomID.parseCustomId(i.customId);
      // component builders taken from the original message
      const newComponents = [
        ActionRowBuilder.from<ButtonBuilder>(i.message.components[0] as ActionRow<ButtonComponent>),
      ];

      if (i.message.components[1]) {
        newComponents.push(
          ActionRowBuilder.from<ButtonBuilder>(
            i.message.components[1] as ActionRow<ButtonComponent>,
          ),
        );
      }

      // button responses
      switch (customId.suffix) {
        case 'serverInfo':
          this.handleServerInfoButton(i, newComponents, {
            server,
            locale,
            connection,
          });
          break;

        case 'userInfo':
          this.handleUserInfoButton(i, newComponents, { author, locale });
          break;

        case 'msgInfo':
          this.handleMsgInfoButton(i, newComponents, {
            author,
            server,
            locale,
            hub,
            messageId: target.id,
          });
          break;

        case 'report':
          this.handleReportButton(i, { hub, locale, messageId: target.id });
          break;

        default:
          break;
      }
    });

    collector.on('end', async (i) => {
      greyOutButtons(components);
      await i.first()?.editReply({ components });
    });
  }

  @RegisterInteractionHandler('msgInfoModal')
  override async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const { originalMsg, messageId, locale } = await this.getModalMessageInfo(interaction);

    if (
      !originalMsg?.hubId ||
      !(await HubLogManager.create(originalMsg?.hubId)).config.reports?.channelId
    ) {
      const notEnabledEmbed = new InfoEmbed().setDescription(
        t('msgInfo.report.notEnabled', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
      );

      await interaction.reply({
        embeds: [notEnabledEmbed],
        flags: ['Ephemeral'],
      });
      return;
    }

    const { authorId, guildId } = originalMsg;

    const reason = interaction.fields.getTextInputValue('reason');
    const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
    const content = originalMsg.content;
    const attachmentUrl =
      content?.match(Constants.Regex.StaticImageUrl)?.at(0) ?? message?.embeds[0]?.image?.url;

    await sendHubReport(originalMsg.hubId, interaction.client, {
      userId: authorId,
      serverId: guildId,
      reason,
      reportedBy: interaction.user,
      evidence: {
        content,
        attachmentUrl,
        messageId,
      },
    });

    const successEmbed = new InfoEmbed().setDescription(
      t('msgInfo.report.success', locale, {
        emoji: this.getEmoji('tick_icon'),
      }),
    );

    await interaction.reply({ embeds: [successEmbed], flags: ['Ephemeral'] });
  }

  private async handleServerInfoButton(
    interaction: ButtonInteraction,
    components: ActionRowBuilder<ButtonBuilder>[],
    { server, locale, connection }: ServerInfoOpts,
  ) {
    if (!server) {
      await interaction.update({
        content: t('errors.unknownServer', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        embeds: [],
        components: [],
      });
      return;
    }

    const owner = await interaction.client.users.fetch(server.ownerId);
    const createdAt = Math.round(server.createdTimestamp / 1000);
    const inviteString = connection?.data.invite ?? 'Not Set.';
    const ownerName = `${owner.username}#${
      owner.discriminator !== '0' ? `#${owner.discriminator}` : ''
    }`;
    const iconUrl = server.icon
      ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`
      : null;
    const bannerUrL = server.icon
      ? `https://cdn.discordapp.com/icons/${server.id}/${server.banner}.png`
      : null;

    const serverEmbed = new EmbedBuilder()
      .setDescription(`### ${this.getEmoji('info')} ${server.name}`)
      .addFields([
        { name: 'Owner', value: codeBlock(ownerName), inline: true },
        {
          name: 'Member Count',
          value: codeBlock(String(server.memberCount)),
          inline: true,
        },
        { name: 'Server ID', value: codeBlock(server.id), inline: true },
        { name: 'Invite', value: inviteString, inline: true },
        { name: 'Created At', value: time(createdAt, 'R'), inline: true },
      ])
      .setThumbnail(iconUrl)
      .setImage(bannerUrL)
      .setColor(Constants.Colors.invisible);

    // disable the server info button
    greyOutButton(components[0], 1);

    await interaction.update({ embeds: [serverEmbed], components, files: [] });
  }

  private async handleUserInfoButton(
    interaction: ButtonInteraction,
    components: ActionRowBuilder<ButtonBuilder>[],
    { author }: UserInfoOpts,
  ) {
    await interaction.deferUpdate();
    const createdAt = Math.round(author.createdTimestamp / 1000);
    const hubsOwned = await db.hub.count({ where: { ownerId: author.id } });
    const displayName = author.globalName ?? 'Not Set.';

    const userEmbed = new EmbedBuilder()
      .setDescription(`### ${this.getEmoji('info')} ${author.username}`)
      .addFields([
        { name: 'Display Name', value: codeBlock(displayName), inline: true },
        { name: 'User ID', value: codeBlock(author.id), inline: true },
        { name: 'Hubs Owned', value: codeBlock(`${hubsOwned}`), inline: true },
        {
          name: 'Created At',
          value: `${time(createdAt, 'd')} (${time(createdAt, 'R')})`,
          inline: true,
        },
      ])
      .setThumbnail(author.displayAvatarURL())
      .setImage(author.bannerURL() ?? null)
      .setColor(Constants.Colors.invisible);

    // disable the user info button
    greyOutButton(components[0], 2);

    await interaction.editReply({ embeds: [userEmbed], components });
  }

  private async handleMsgInfoButton(
    interaction: ButtonInteraction,
    components: ActionRowBuilder<ButtonBuilder>[],
    { author, server, locale, hub, messageId }: MsgInfoOpts,
  ) {
    const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);

    if (!message || !hub) {
      await interaction.update({
        content: t('errors.unknownNetworkMessage', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        embeds: [],
        components: [],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setDescription(`### ${this.getEmoji('info')} Message Info`)
      .addFields([
        { name: 'Sender', value: codeBlock(author.username), inline: true },
        {
          name: 'From Server',
          value: codeBlock(`${server?.name}`),
          inline: true,
        },
        { name: 'Which Hub?', value: codeBlock(hub.data.name), inline: true },
        { name: 'Message ID', value: codeBlock(messageId), inline: true },
        { name: 'Sent At', value: time(message.createdAt, 't'), inline: true },
      ])
      .setThumbnail(author.displayAvatarURL())
      .setColor(Constants.Colors.invisible);

    greyOutButton(components[0], 0);

    await interaction.update({ embeds: [embed], components, files: [] });
  }

  private async handleReportButton(
    interaction: ButtonInteraction,
    { hub, locale, messageId }: ReportOpts,
  ) {
    if (!hub || !(await HubLogManager.create(hub.id)).config.reports?.channelId) {
      const notEnabledEmbed = new InfoEmbed().setDescription(
        t('msgInfo.report.notEnabled', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
      );

      await interaction.reply({
        embeds: [notEnabledEmbed],
        flags: ['Ephemeral'],
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(new CustomID('msgInfoModal:report', [messageId]).toString())
      .setTitle('Report Message')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for report')
            .setPlaceholder('Spamming text, sending NSFW content etc.')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true),
        ),
      );

    await interaction.showModal(modal);
  }

  // utils
  private async fetchHub(hubId: string | undefined) {
    const hubService = new HubService(db);
    return hubId ? await hubService.fetchHub(hubId) : null;
  }

  private async getMessageInfo(interaction: MessageContextMenuCommandInteraction) {
    const locale = await fetchUserLocale(interaction.user.id) ?? 'en';
    const target = interaction.targetMessage;
    const originalMsg =
      (await getOriginalMessage(target.id)) ?? (await findOriginalMessage(target.id));
    const hub = await this.fetchHub(originalMsg?.hubId);

    return { target, locale, originalMsg, hub };
  }

  private async getModalMessageInfo(interaction: ModalSubmitInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [messageId] = customId.args;
    const originalMsg =
      (await getOriginalMessage(messageId)) ?? (await findOriginalMessage(messageId));

    const locale = await fetchUserLocale(interaction.user.id) ?? 'en';

    return { originalMsg, locale, messageId };
  }

  private buildButtons(
    targetMsgId: string,
    locale: supportedLocaleCodes = 'en',
    opts?: { buildModActions?: boolean; inviteButtonUrl?: string | null },
  ) {
    const extras = [
      new ButtonBuilder()
        .setLabel(t('msgInfo.buttons.report', locale))
        .setStyle(ButtonStyle.Danger)
        .setCustomId(new CustomID().setIdentifier('msgInfo', 'report').toString()),
    ];

    if (opts?.buildModActions) {
      extras.push(
        modPanelButton(targetMsgId, this.getEmoji('blobFastBan')).setStyle(ButtonStyle.Secondary),
      );
    }
    if (opts?.inviteButtonUrl) {
      extras.push(
        new ButtonBuilder()
          .setLabel('Join Server')
          .setStyle(ButtonStyle.Link)
          .setURL(opts.inviteButtonUrl)
          .setDisabled(false),
      );
    }

    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(t('msgInfo.buttons.message', locale))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
          .setCustomId(new CustomID().setIdentifier('msgInfo', 'msgInfo').toString()),
        new ButtonBuilder()
          .setLabel(t('msgInfo.buttons.server', locale))
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(new CustomID().setIdentifier('msgInfo', 'serverInfo').toString()),
        new ButtonBuilder()
          .setLabel(t('msgInfo.buttons.user', locale))
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(new CustomID().setIdentifier('msgInfo', 'userInfo').toString()),
      ),
      new ActionRowBuilder<ButtonBuilder>({ components: extras }),
    ];
  }
}
