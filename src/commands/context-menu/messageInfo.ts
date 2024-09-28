import Constants, { emojis } from '#main/config/Constants.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { greyOutButton, greyOutButtons } from '#main/utils/ComponentUtils.js';
import { getHubConnections } from '#main/utils/ConnectedListUtils.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { isStaffOrHubMod } from '#main/utils/hub/utils.js';
import { sendHubReport } from '#main/utils/HubLogger/Report.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';
import modActionsPanel from '#main/utils/moderation/modActions/modActionsPanel.js';
import { isValidDbMsgWithHubId } from '#main/utils/moderation/modActions/utils.js';
import type { RemoveMethods } from '#types/index.d.ts';
import type { connectedList, Hub, originalMessages } from '@prisma/client';
import {
  ActionRow,
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonComponent,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ComponentType,
  EmbedBuilder,
  Guild,
  MessageContextMenuCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  TextInputBuilder,
  TextInputStyle,
  User,
  codeBlock,
  time,
} from 'discord.js';

type LocaleInfo = { locale: supportedLocaleCodes };
type AuthorInfo = { author: User };
type ServerInfo = { server: RemoveMethods<Guild> | undefined };
type HubInfo = { hub: Hub | null };
type MsgInfo = { messageId: string };

type UserInfoOpts = LocaleInfo & AuthorInfo;
type MsgInfoOpts = AuthorInfo & ServerInfo & LocaleInfo & HubInfo & MsgInfo;
type ReportOpts = LocaleInfo & HubInfo & MsgInfo;
type ModActionsOpts = { originalMsg: originalMessages };
type ServerInfoOpts = LocaleInfo & ServerInfo & { connection: connectedList | undefined };

export default class MessageInfo extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Message Info/Report',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.targetMessage;

    const { locale, originalMsg } = await this.getMessageInfo(interaction);

    if (!originalMsg?.hub) {
      await interaction.followUp({
        content: t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    const author = await interaction.client.users.fetch(originalMsg.authorId);
    const server = await interaction.client.fetchGuild(originalMsg.serverId);

    const embed = new EmbedBuilder()
      .setDescription(`### ${emojis.info} Message Info`)
      .addFields([
        { name: 'Sender', value: codeBlock(author.username), inline: true },
        { name: 'From Server', value: codeBlock(`${server?.name}`), inline: true },
        { name: 'Which Hub?', value: codeBlock(originalMsg.hub.name), inline: true },
        { name: 'Message ID', value: codeBlock(originalMsg.messageId), inline: true },
        { name: 'Sent At', value: time(originalMsg.createdAt, 't'), inline: true },
      ])
      .setThumbnail(author.displayAvatarURL())
      .setColor(Constants.Colors.invisible);

    const connection = (await getHubConnections(originalMsg.hub.id))?.find(
      (c) => c.connected && c.serverId === originalMsg.serverId,
    );
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const components = this.buildButtons(expiry, locale, {
      buildModActions: isStaffOrHubMod(interaction.user.id, originalMsg.hub),
      inviteButtonUrl: connection?.invite,
    });

    const reply = await interaction.followUp({
      embeds: [embed],
      components,
      ephemeral: true,
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
          this.handleServerInfoButton(i, newComponents, { server, locale, connection });
          break;

        case 'userInfo':
          this.handleUserInfoButton(i, newComponents, { author, locale });
          break;

        case 'msgInfo':
          this.handleMsgInfoButton(i, newComponents, {
            author,
            server,
            locale,
            hub: originalMsg.hub,
            messageId: target.id,
          });
          break;

        case 'report':
          this.handleReportButton(i, { hub: originalMsg.hub, locale, messageId: target.id });
          break;

        case 'modActions':
          this.handleModActionsButton(i, { originalMsg });
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

    if (!originalMsg?.hub?.logChannels?.reports) {
      const notEnabledEmbed = new InfoEmbed().setDescription(
        t({ phrase: 'msgInfo.report.notEnabled', locale }, { emoji: emojis.no }),
      );

      await interaction.reply({ embeds: [notEnabledEmbed], ephemeral: true });
      return;
    }

    const { authorId, serverId } = originalMsg;

    const reason = interaction.fields.getTextInputValue('reason');
    const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
    const content = message?.content || message?.embeds[0].description || undefined;
    const attachmentUrl =
      content?.match(Constants.Regex.StaticImageUrl)?.at(0) ?? message?.embeds[0]?.image?.url;

    await sendHubReport(originalMsg.hub.id, interaction.client, {
      userId: authorId,
      serverId,
      reason,
      reportedBy: interaction.user,
      evidence: {
        content,
        attachmentUrl,
        messageId,
      },
    });

    const successEmbed = new InfoEmbed().setDescription(
      t({ phrase: 'msgInfo.report.success', locale }, { emoji: emojis.yes }),
    );

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  }

  private async handleServerInfoButton(
    interaction: ButtonInteraction,
    components: ActionRowBuilder<ButtonBuilder>[],
    { server, locale, connection }: ServerInfoOpts,
  ) {
    if (!server) {
      await interaction.update({
        content: t({ phrase: 'errors.unknownServer', locale }, { emoji: emojis.no }),
        embeds: [],
        components: [],
      });
      return;
    }

    const owner = await interaction.client.users.fetch(server.ownerId);
    const createdAt = Math.round(server.createdTimestamp / 1000);
    const ownerName = `${owner.username}#${
      owner.discriminator !== '0' ? `#${owner.discriminator}` : ''
    }`;

    const iconUrl = server.icon
      ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`
      : null;
    const bannerUrL = server.icon
      ? `https://cdn.discordapp.com/icons/${server.id}/${server.banner}.png`
      : null;
    const inviteString = connection?.invite ? `${connection.invite}` : 'Not Set.';

    const serverEmbed = new EmbedBuilder()
      .setDescription(`### ${emojis.info} ${server.name}`)
      .addFields([
        { name: 'Owner', value: codeBlock(ownerName), inline: true },
        { name: 'Member Count', value: codeBlock(String(server.memberCount)), inline: true },
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
    const displayName = author.globalName || 'Not Set.';

    const userEmbed = new EmbedBuilder()
      .setDescription(`### ${emojis.info} ${author.username}`)
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
        content: t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
        embeds: [],
        components: [],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setDescription(`### ${emojis.info} Message Info`)
      .addFields([
        { name: 'Sender', value: codeBlock(author.username), inline: true },
        { name: 'From Server', value: codeBlock(`${server?.name}`), inline: true },
        { name: 'Which Hub?', value: codeBlock(hub.name), inline: true },
        { name: 'Message ID', value: codeBlock(messageId), inline: true },
        { name: 'Sent At', value: time(message.createdAt, 't'), inline: true },
      ])
      .setThumbnail(author.displayAvatarURL())
      .setColor(Constants.Colors.invisible);

    greyOutButton(components[0], 0);

    await interaction.update({ embeds: [embed], components, files: [] });
  }

  private async handleModActionsButton(
    interaction: ButtonInteraction,
    { originalMsg }: ModActionsOpts,
  ) {
    if (!isValidDbMsgWithHubId(originalMsg)) return;
    if (!originalMsg.hub || isStaffOrHubMod(interaction.user.id, originalMsg.hub)) return;


    const { buttons, embed } = await modActionsPanel.buildMessage(interaction, originalMsg);
    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
  }

  private async handleReportButton(
    interaction: ButtonInteraction,
    { hub, locale, messageId }: ReportOpts,
  ) {
    if (!hub?.logChannels?.reports) {
      const notEnabledEmbed = new InfoEmbed().setDescription(
        t({ phrase: 'msgInfo.report.notEnabled', locale }, { emoji: emojis.no }),
      );

      await interaction.reply({ embeds: [notEnabledEmbed], ephemeral: true });
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
  private async getMessageInfo(interaction: MessageContextMenuCommandInteraction) {
    const target = interaction.targetMessage;
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const originalMsg = (
      await db.broadcastedMessages.findFirst({
        where: { messageId: target.id },
        include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
      })
    )?.originalMsg;

    return { target, locale, originalMsg };
  }

  private async getModalMessageInfo(interaction: ModalSubmitInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [messageId] = customId.args;
    const originalMsg = (
      await db.broadcastedMessages.findFirst({
        where: { messageId },
        include: { originalMsg: { include: { hub: true } } },
      })
    )?.originalMsg;
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    return { originalMsg, locale, messageId };
  }

  private buildButtons(
    expiry: Date,
    locale: supportedLocaleCodes = 'en',
    opts?: { buildModActions?: boolean; inviteButtonUrl?: string | null },
  ) {
    const extras = [
      new ButtonBuilder()
        .setLabel(t({ phrase: 'msgInfo.buttons.report', locale }))
        .setStyle(ButtonStyle.Danger)
        .setCustomId(
          new CustomID().setIdentifier('msgInfo', 'report').setExpiry(expiry).toString(),
        ),
    ];

    if (opts?.buildModActions) {
      extras.push(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🛠️')
          .setLabel('Mod Actions')
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'modActions').setExpiry(expiry).toString(),
          ),
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
          .setLabel(t({ phrase: 'msgInfo.buttons.message', locale }))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'msgInfo').setExpiry(expiry).toString(),
          ),
        new ButtonBuilder()
          .setLabel(t({ phrase: 'msgInfo.buttons.server', locale }))
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'serverInfo').setExpiry(expiry).toString(),
          ),
        new ButtonBuilder()
          .setLabel(t({ phrase: 'msgInfo.buttons.user', locale }))
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'userInfo').setExpiry(expiry).toString(),
          ),
      ),
      new ActionRowBuilder<ButtonBuilder>({ components: extras }),
    ];
  }
}
