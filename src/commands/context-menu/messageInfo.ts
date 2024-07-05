/* eslint-disable complexity */
import {
  ActionRow,
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonComponent,
  ButtonStyle,
  CacheType,
  EmbedBuilder,
  MessageComponentInteraction,
  MessageContextMenuCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  TextInputBuilder,
  TextInputStyle,
  time,
} from 'discord.js';
import db from '../../utils/Db.js';
import BaseCommand from '../../core/BaseCommand.js';
import { REGEX, colors, emojis } from '../../utils/Constants.js';
import { CustomID } from '../../utils/CustomID.js';
import { RegisterInteractionHandler } from '../../decorators/Interaction.js';
import { supportedLocaleCodes, t } from '../../utils/Locale.js';
import { simpleEmbed } from '../../utils/Utils.js';
import { sendHubReport } from '../../utils/HubLogger/Report.js';
import { getAllConnections } from '../../utils/ConnectedList.js';

export default class MessageInfo extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Message Info/Report',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.targetMessage;
    const originalMsg = (
      await db.broadcastedMessages.findFirst({
        where: { messageId: target.id },
        include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
      })
    )?.originalMsg;

    if (!originalMsg) {
      await interaction.followUp({
        content: t(
          { phrase: 'errors.unknownNetworkMessage', locale: interaction.user.locale },
          { emoji: emojis.no },
        ),
        ephemeral: true,
      });
      return;
    }
    const author = await interaction.client.users.fetch(originalMsg.authorId);
    const server = await interaction.client.fetchGuild(originalMsg.serverId);

    const embed = new EmbedBuilder()
      .setDescription(
        t(
          { phrase: 'msgInfo.message.description', locale: interaction.user.locale },
          {
            emoji: emojis.clipart,
            author: author.discriminator !== '0' ? author.tag : author.username,
            server: `${server?.name}`,
            messageId: target.id,
            hub: `${originalMsg.hub?.name}`,
            createdAt: time(Math.floor(target.createdTimestamp / 1000), 'R'),
          },
        ),
      )
      .setThumbnail(`https://cdn.discordapp.com/icons/${server?.id}/${server?.icon}.png`)
      .setColor('Random');

    const components = MessageInfo.buildButtons(target.id, interaction.user.locale);

    const guildConnected = (await getAllConnections())?.find(
      (c) => c.serverId === originalMsg.serverId && c.hubId === originalMsg.hub?.id,
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

    await interaction.followUp({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  @RegisterInteractionHandler('msgInfo')
  static override async handleComponents(interaction: MessageComponentInteraction) {
    // create a variable to store the profile card buffer
    const customId = CustomID.parseCustomId(interaction.customId);
    const messageId = customId.args[0];

    const originalMsg = (
      await db.broadcastedMessages.findFirst({
        where: { messageId },
        include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
      })
    )?.originalMsg;

    if (!originalMsg) {
      await interaction.update({
        content: t(
          { phrase: 'errors.unknownNetworkMessage', locale: interaction.user.locale },
          { emoji: emojis.no },
        ),
        embeds: [],
        components: [],
      });
      return;
    }

    const author = await interaction.client.users.fetch(originalMsg.authorId);
    const server = await interaction.client.fetchGuild(originalMsg.serverId);
    const guildConnected = (await getAllConnections())?.find((c) => c.serverId === server?.id);

    if (interaction.isButton()) {
      // component builders taken from the original message
      const components = [
        ActionRowBuilder.from<ButtonBuilder>(
          interaction.message.components[0] as ActionRow<ButtonComponent>,
        ),
      ];

      if (interaction.message.components[1]) {
        components.push(
          ActionRowBuilder.from<ButtonBuilder>(
            interaction.message.components[1] as ActionRow<ButtonComponent>,
          ),
        );
      }

      // button responses
      switch (customId.suffix) {
        // server info button
        case 'serverInfo': {
          if (!server) {
            await interaction.update({
              content: t(
                { phrase: 'errors.unknownServer', locale: interaction.user.locale },
                { emoji: emojis.no },
              ),
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
                { phrase: 'msgInfo.server.description', locale: interaction.user.locale },
                {
                  server: server.name,
                  description:
                    server.description ||
                    t({ phrase: 'misc.noDesc', locale: interaction.user.locale }),
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
          MessageInfo.greyOutButton(components[0], 1);

          await interaction.update({ embeds: [serverEmbed], components, files: [] });
          break;
        }

        // user info button
        case 'userInfo': {
          await interaction.deferUpdate();
          const createdAt = Math.round(author.createdTimestamp / 1000);

          const userEmbed = new EmbedBuilder()
            .setThumbnail(author.displayAvatarURL())
            .setColor('Random')
            .setImage(author.bannerURL() ?? null)
            .setDescription(
              t(
                { phrase: 'msgInfo.user.description', locale: interaction.user.locale },
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
          MessageInfo.greyOutButton(components[0], 2);

          await interaction.editReply({
            // attach the profile card to the message
            embeds: [userEmbed],
            components,
          });
          break;
        }

        // message info button
        case 'info': {
          const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);

          if (!message) {
            await interaction.update({
              content: t(
                { phrase: 'errors.unknownMessage', locale: interaction.user.locale },
                { emoji: emojis.no },
              ),
              embeds: [],
              components: [],
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setDescription(
              t(
                { phrase: 'msgInfo.message.description', locale: interaction.user.locale },
                {
                  emoji: emojis.clipart,
                  author: author.discriminator !== '0' ? author.tag : author.username,
                  server: `${server?.name}`,
                  messageId: message.id,
                  hub: `${originalMsg.hub?.name}`,
                  createdAt: time(Math.floor(message.createdTimestamp / 1000), 'R'),
                },
              ),
            )
            .setThumbnail(
              server?.icon
                ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`
                : null,
            )
            .setColor('Random');

          MessageInfo.greyOutButton(components[0], 0);

          await interaction.update({ embeds: [embed], components, files: [] });
          break;
        }

        case 'report': {
          if (!originalMsg.hub?.logChannels?.reports) {
            await interaction.reply({
              embeds: [
                simpleEmbed(
                  t(
                    { phrase: 'msgInfo.report.notEnabled', locale: interaction.user.locale },
                    { emoji: emojis.no },
                  ),
                ),
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
          break;
        }

        default:
          break;
      }
    }
  }

  @RegisterInteractionHandler('msgInfoModal')
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const messageId = customId.args[0];
    const messageInDb = await db.broadcastedMessages.findFirst({
      where: { messageId },
      include: { originalMsg: { include: { hub: true } } },
    });

    if (!messageInDb?.originalMsg.hub?.logChannels?.reports) {
      await interaction.reply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'msgInfo.report.notEnabled', locale: interaction.user.locale },
              { emoji: emojis.no },
            ),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const { authorId, serverId } = messageInDb.originalMsg;

    const reason = interaction.fields.getTextInputValue('reason');
    const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
    const content = message?.content || message?.embeds[0].description || undefined;
    const attachmentUrl =
      content?.match(REGEX.STATIC_IMAGE_URL)?.at(0) ?? message?.embeds[0]?.image?.url;

    await sendHubReport(messageInDb.originalMsg.hub.id, interaction.client, {
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
      embeds: [
        simpleEmbed(
          t(
            { phrase: 'msgInfo.report.success', locale: interaction.user.locale },
            { emoji: emojis.yes },
          ),
        ),
      ],
      ephemeral: true,
    });
  }

  // utility methods
  static greyOutButton(buttons: ActionRowBuilder<ButtonBuilder>, disableElement: number) {
    buttons.components.forEach((c) => c.setDisabled(false));
    buttons.components[disableElement].setDisabled(true);
  }

  static buildButtons(messageId: string, locale: supportedLocaleCodes = 'en') {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(t({ phrase: 'msgInfo.buttons.message', locale }))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'info').addArgs(messageId).toString(),
          ),
        new ButtonBuilder()
          .setLabel(t({ phrase: 'msgInfo.buttons.server', locale }))
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'serverInfo').addArgs(messageId).toString(),
          ),
        new ButtonBuilder()
          .setLabel(t({ phrase: 'msgInfo.buttons.user', locale }))
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'userInfo').addArgs(messageId).toString(),
          ),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(t({ phrase: 'msgInfo.buttons.report', locale }))
          .setStyle(ButtonStyle.Danger)
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'report').addArgs(messageId).toString(),
          ),
      ),
    ];
  }
}
