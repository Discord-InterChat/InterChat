import {
  ActionRow,
  ActionRowBuilder,
  ApplicationCommandType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonComponent,
  ButtonStyle,
  EmbedBuilder,
  MessageComponentInteraction,
  MessageContextMenuCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import db from '../../utils/Db.js';
import BaseCommand from '../BaseCommand.js';
import { profileImage } from 'discord-arts';
import { colors, emojis } from '../../utils/Constants.js';
import { CustomID } from '../../utils/CustomID.js';
import { RegisterInteractionHandler } from '../../decorators/Interaction.js';
import { t } from '../../utils/Locale.js';

export default class MessageInfo extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Message Info/Report',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const target = interaction.targetMessage;
    const originalMsg = (await db.broadcastedMessages.findFirst({
      where: { messageId: target.id },
      include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
    }))?.originalMsg;

    if (!originalMsg) {
      await interaction.reply({
        content: t({ phrase: 'errors.unknownNetworkMessage', locale: interaction.user.locale }),
        ephemeral: true,
      });
      return;
    }
    const guildConnected = await db.connectedList.findFirst({
      where: { serverId: originalMsg.serverId },
    });
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
            createdAt: `${Math.floor(target.createdTimestamp / 1000)}`,
          },
        ),
      )
      .setThumbnail(`https://cdn.discordapp.com/icons/${server?.id}/${server?.icon}.png`)
      .setColor('Random');

    const buttonsArr = MessageInfo.buildButtons(target.id, interaction.user.locale);

    if (guildConnected?.invite) {
      buttonsArr.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.gg/${guildConnected?.invite}`)
            .setEmoji(emojis.join)
            .setLabel('Join'),
        ),
      );
    }

    await interaction.reply({
      embeds: [embed],
      components: MessageInfo.buildButtons(target.id, interaction.user.locale),
      ephemeral: true,
    });
  }

  @RegisterInteractionHandler('msgInfo')
  async handleComponents(interaction: MessageComponentInteraction) {
    // create a variable to store the profile card buffer
    const customId = CustomID.parseCustomId(interaction.customId);
    const messageId = customId.args[0];

    const originalMsg = (await db.broadcastedMessages.findFirst({
      where: { messageId },
      include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
    }))?.originalMsg;

    if (!originalMsg) {
      return await interaction.update({
        content: t({ phrase: 'errors.unknownNetworkMessage', locale: interaction.user.locale }),
        embeds: [],
        components: [],
      });
    }

    const author = await interaction.client.users.fetch(originalMsg.authorId);
    const server = await interaction.client.fetchGuild(originalMsg.serverId);
    const guildConnected = await db.connectedList.findFirst({ where: { serverId: server?.id } });

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
      switch (customId.postfix) {
        // server info button
        case 'serverInfo': {
          if (!server) {
            return await interaction.update({
              content: t({ phrase: 'errors.unknownServer', locale: interaction.user.locale }),
              embeds: [],
              components: [],
            });
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
                  createdAt: `${createdAt}`,
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
                  user: author.discriminator !== '0' ? author.tag : author.username,
                  id: author.id,
                  createdAt: `${createdAt}`,
                  globalName: author.globalName || 'Not Set.',
                  hubsOwned: `${await db.hubs.count({ where: { ownerId: author.id } })}`,
                },
              ),
            )
            .setImage('attachment://customCard.png') // link to image that will be generated afterwards
            .setTimestamp();

          // disable the user info button
          MessageInfo.greyOutButton(components[0], 2);

          // generate the profile card
          const customCard = new AttachmentBuilder(await profileImage(author.id), {
            name: 'customCard.png',
          });

          await interaction.editReply({
            // attach the profile card to the message
            files: [customCard],
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
              content: t({ phrase: 'errors.unknownMessage', locale: interaction.user.locale }),
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
                  createdAt: `${Math.floor(message.createdTimestamp / 1000)}`,
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

        default:
          break;
      }
    }
  }

  // utility methods
  static greyOutButton(buttons: ActionRowBuilder<ButtonBuilder>, disableElement: number) {
    buttons.components.forEach((c) => c.setDisabled(false));
    buttons.components[disableElement].setDisabled(true);
  }

  static buildButtons(messageId: string, locale = 'en') {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'info').addArgs(messageId).toString(),
          )
          .setLabel(t({ phrase: 'msgInfo.buttons.message', locale }))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'serverInfo').addArgs(messageId).toString(),
          )
          .setLabel(t({ phrase: 'msgInfo.buttons.server', locale }))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'userInfo').addArgs(messageId).toString(),
          )
          .setLabel(t({ phrase: 'msgInfo.buttons.user', locale }))
          .setStyle(ButtonStyle.Secondary),
      ),
    ];
  }
}
