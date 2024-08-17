import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { RemoveMethods } from '#main/typings/index.js';
import { getHubConnections } from '#main/utils/ConnectedList.js';
import { REGEX, colors, emojis } from '#main/utils/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { sendHubReport } from '#main/utils/HubLogger/Report.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';
import { greyOutButton, greyOutButtons, simpleEmbed } from '#main/utils/Utils.js';
import { connectedList, hubs } from '@prisma/client';
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
  time,
} from 'discord.js';

type LocaleInfo = { locale: supportedLocaleCodes };
type AuthorInfo = { author: User };
type ServerInfo = { server: RemoveMethods<Guild> | undefined };
type HubInfo = { hub: hubs | null };
type MsgInfo = { messageId: string };

type UserInfoOpts = LocaleInfo & AuthorInfo;
type MsgInfoOpts = AuthorInfo & ServerInfo & LocaleInfo & HubInfo & MsgInfo;
type ReportOpts = LocaleInfo & HubInfo & MsgInfo;
type ServerInfoOpts = LocaleInfo &
  ServerInfo & {
    guildConnected: connectedList | undefined;
  };

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
      .setDescription(
        t(
          { phrase: 'msgInfo.message.description', locale },
          {
            emoji: emojis.clipart,
            author: author.discriminator !== '0' ? author.tag : author.username,
            server: `${server?.name}`,
            messageId: target.id,
            hub: `${originalMsg.hub.name}`,
            createdAt: time(Math.floor(target.createdTimestamp / 1000), 'R'),
          },
        ),
      )
      .setThumbnail(
        server ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png` : null,
      )
      .setColor('Random');

    const expiry = new Date(Date.now() + (5 * 60 * 1000)); // 5 minutes
    const components = this.buildButtons(expiry, locale);
    const guildConnected = (await getHubConnections(originalMsg.hub.id))?.find(
      (c) => c.connected && c.serverId === originalMsg.serverId,
    );

    if (guildConnected?.invite) {
      components[1].addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.gg/${guildConnected?.invite}`)
          .setEmoji(emojis.join)
          .setLabel('Join Server'),
      );
    }

    const reply = await interaction.followUp({
      embeds: [embed],
      components,
      ephemeral: true,
    });

    const collector = reply.createMessageComponentCollector({
      idle: 60_000,
      componentType: ComponentType.Button,
    });

    collector.on('collect', async (i) => {
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
          this.handleServerInfoButton(i, newComponents, { server, locale, guildConnected });
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

        default:
          break;
      }
    });

    collector.on('end', async () => greyOutButtons(components));
  }

  @RegisterInteractionHandler('msgInfoModal')
  override async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const { originalMsg, messageId, locale } = await this.getModalMessageInfo(interaction);

    if (!originalMsg?.hub?.logChannels?.reports) {
      await interaction.reply({
        embeds: [
          simpleEmbed(t({ phrase: 'msgInfo.report.notEnabled', locale }, { emoji: emojis.no })),
        ],
        ephemeral: true,
      });
      return;
    }

    const { authorId, serverId } = originalMsg;

    const reason = interaction.fields.getTextInputValue('reason');
    const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
    const content = message?.content || message?.embeds[0].description || undefined;
    const attachmentUrl =
      content?.match(REGEX.STATIC_IMAGE_URL)?.at(0) ?? message?.embeds[0]?.image?.url;

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

    await interaction.reply({
      embeds: [simpleEmbed(t({ phrase: 'msgInfo.report.success', locale }, { emoji: emojis.yes }))],
      ephemeral: true,
    });
  }

  private async handleServerInfoButton(
    interaction: ButtonInteraction,
    components: ActionRowBuilder<ButtonBuilder>[],
    { server, locale, guildConnected }: ServerInfoOpts,
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

    const iconUrl = server.icon
      ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`
      : null;
    const bannerUrL = server.icon
      ? `https://cdn.discordapp.com/icons/${server.id}/${server.banner}.png`
      : null;
    const inviteString = guildConnected?.invite ? `${guildConnected.invite}` : 'Not Set.';

    const serverEmbed = new EmbedBuilder()
      .setColor(colors.invisible)
      .setThumbnail(iconUrl)
      .setImage(bannerUrL)
      .setDescription(
        t(
          { phrase: 'msgInfo.server.description', locale },
          {
            server: server.name,
            description: server.description || t({ phrase: 'misc.noDesc', locale }),
            owner: `${owner.username}#${
              owner.discriminator !== '0' ? `#${owner.discriminator}` : ''
            }`,
            createdAt: time(createdAt, 'R'),
            createdAtFull: time(createdAt, 'd'),
            memberCount: `${server.memberCount}`,
            invite: `${inviteString}`,
          },
        ),
      )
      .setFooter({ text: `ID: ${server.id}` });

    // disable the server info button
    greyOutButton(components[0], 1);

    await interaction.update({ embeds: [serverEmbed], components, files: [] });
  }

  private async handleUserInfoButton(
    interaction: ButtonInteraction,
    components: ActionRowBuilder<ButtonBuilder>[],
    { author, locale }: UserInfoOpts,
  ) {
    await interaction.deferUpdate();
    const createdAt = Math.round(author.createdTimestamp / 1000);

    const userEmbed = new EmbedBuilder()
      .setThumbnail(author.displayAvatarURL())
      .setColor('Random')
      .setImage(author.bannerURL() ?? null)
      .setDescription(
        t(
          { phrase: 'msgInfo.user.description', locale },
          {
            username: author.discriminator !== '0' ? author.tag : author.username,
            id: author.id,
            createdAt: time(createdAt, 'R'),
            createdAtFull: time(createdAt, 'd'),
            globalName: author.globalName || 'Not Set.',
            hubsOwned: `${await db.hubs.count({ where: { ownerId: author.id } })}`,
          },
        ),
      )
      .setTimestamp();

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

    if (!message) {
      await interaction.update({
        content: t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
        embeds: [],
        components: [],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setDescription(
        t(
          { phrase: 'msgInfo.message.description', locale },
          {
            emoji: emojis.clipart,
            author: author.discriminator !== '0' ? author.tag : author.username,
            server: `${server?.name}`,
            messageId: message.id,
            hub: `${hub?.name}`,
            createdAt: time(Math.floor(message.createdTimestamp / 1000), 'R'),
          },
        ),
      )
      .setThumbnail(
        server?.icon ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png` : null,
      )
      .setColor('Random');

    greyOutButton(components[0], 0);

    await interaction.update({ embeds: [embed], components, files: [] });
  }

  private async handleReportButton(
    interaction: ButtonInteraction,
    { hub, locale, messageId }: ReportOpts,
  ) {
    if (!hub?.logChannels?.reports) {
      await interaction.reply({
        embeds: [
          simpleEmbed(t({ phrase: 'msgInfo.report.notEnabled', locale }, { emoji: emojis.no })),
        ],
        ephemeral: true,
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

  private buildButtons(expiry: Date, locale: supportedLocaleCodes = 'en') {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(t({ phrase: 'msgInfo.buttons.message', locale }))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'info').setExpiry(expiry).toString(),
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
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(t({ phrase: 'msgInfo.buttons.report', locale }))
          .setStyle(ButtonStyle.Danger)
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'report').setExpiry(expiry).toString(),
          ),
      ),
    ];
  }
}
