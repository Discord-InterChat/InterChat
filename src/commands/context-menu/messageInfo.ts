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
import { stripIndents } from 'common-tags';
import { profileImage } from 'discord-arts';
import { colors, emojis } from '../../utils/Constants.js';
import BaseCommand from '../BaseCommand.js';
import { CustomID } from '../../structures/CustomID.js';
import { Interaction } from '../../decorators/Interaction.js';

export default class MessageInfo extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Message Info',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const target = interaction.targetMessage;
    const networkMessage = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: target.id } } },
      include: { hub: true },
    });

    if (!networkMessage) {
      await interaction.reply({
        content: 'Information about this message is no longer available.',
        ephemeral: true,
      });
      return;
    }
    const guildConnected = await db.connectedList.findFirst({ where: { serverId: networkMessage.serverId } });
    const author = await interaction.client.users.fetch(networkMessage.authorId);
    const server = await interaction.client.fetchGuild(networkMessage.serverId);

    const embed = new EmbedBuilder()
      .setDescription(
        stripIndents`
        ## ${emojis.clipart} Message Info

        **Sent By:** 
        __${author.discriminator !== '0' ? author.tag : author.username}__

        **Sent From:**
        __${server?.name}__

        **Message ID:**
        __${target.id}__
        
        **Sent In (Hub):**
        __${networkMessage.hub?.name}__

        **Message Created:**
        <t:${Math.floor(target.createdTimestamp / 1000)}:R>
        `,
      )
      .setThumbnail(`https://cdn.discordapp.com/icons/${server?.id}/${server?.icon}.png`)
      .setColor('Random');

    const buttonsArr = MessageInfo.buildButtons(target.id);

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
      components: MessageInfo.buildButtons(target.id),
      ephemeral: true,
    });
  }

  @Interaction('msgInfo')
  async handleComponents(interaction: MessageComponentInteraction) {
    // create a variable to store the profile card buffer
    const customId = CustomID.parseCustomId(interaction.customId);
    const messageId = customId.args[0];

    const networkMessage = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId } } },
      include: { hub: true },
    });
    if (!networkMessage) {
      return await interaction.update({
        content: 'Information about this message is no longer available.',
        embeds: [],
        components: [],
      });
    }

    const author = await interaction.client.users.fetch(networkMessage.authorId);
    const server = await interaction.client.fetchGuild(networkMessage.serverId);
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
              content: 'Unable to find server!',
              embeds: [],
              components: [],
            });
          }

          const owner = await interaction.client.users.fetch(server.ownerId);

          if (!server) {
            await interaction.update({ content: 'Unable to find server!', embeds: [] });
            return;
          }

          const createdAt = Math.round(server.createdTimestamp / 1000);

          const iconUrl = server.icon
            ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`
            : null;
          const bannerUrL = server.icon
            ? `https://cdn.discordapp.com/icons/${server.id}/${server.banner}.png`
            : null;
          const inviteString = guildConnected?.invite
            ? `[\`${guildConnected.invite}\`](https://discord.gg/${guildConnected.invite})`
            : 'Not Set.';

          const serverEmbed = new EmbedBuilder()
            .setColor(colors.invisible)
            .setThumbnail(iconUrl)
            .setImage(bannerUrL)
            .setDescription(
              stripIndents`
              ## ${server?.name}
              ${server.description || 'No Description.'}
    
              **Owner:** 
            __${owner.username}__${owner.discriminator !== '0' ? `#${owner.discriminator}` : ''}
    
              **Created:** 
              <t:${createdAt}:d> (<t:${createdAt}:R>)
    
              **Member Count:** 
              __${server.memberCount}__
    
              **Invite:**
              __${inviteString}__,
              `,
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
              stripIndents`
                ## ${author.username}
                __${author.discriminator !== '0' ? author.tag : author.username}__
    
                **ID:**
                __${author.id}__
    
                **Created:**
                <t:${createdAt}:d> (<t:${createdAt}:R>)
                
                **Display Name:**
                __${author.globalName || 'Not Set.'}__
    
                **Hubs Owned:**
                __${await db.hubs.count({ where: { ownerId: author.id } })}__
              `,
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
              content: 'Unable to find message!',
              embeds: [],
              components: [],
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setDescription(
              stripIndents`
              ## ${emojis.clipart} Message Info
      
              **Sent By:** 
              __${author.discriminator !== '0' ? author.tag : author.username}__
      
              **Sent From:**
              __${server?.name}__
      
              **Message ID:**
              __${message.id}__
              
              **Sent In (Hub):**
              __${networkMessage.hub?.name}__
      
              **Message Created:**
              <t:${Math.floor(message?.createdTimestamp / 1000)}:R>
              `,
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

  static buildButtons(messageId: string) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'info').addArgs(messageId).toString(),
          )
          .setLabel('Message Info')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'serverInfo').addArgs(messageId).toString(),
          )
          .setLabel('Server Info')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(
            new CustomID().setIdentifier('msgInfo', 'userInfo').addArgs(messageId).toString(),
          )
          .setLabel('User Info')
          .setStyle(ButtonStyle.Secondary),
      ),
    ];
  }
}
