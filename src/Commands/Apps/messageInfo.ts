import { ActionRowBuilder, ApplicationCommandType, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContextMenuCommandBuilder, EmbedBuilder, MessageContextMenuCommandInteraction } from 'discord.js';
import { constants, getDb } from '../../Utils/utils';
import { stripIndents } from 'common-tags';
import { profileImage } from 'discord-arts';
import emojis from '../../Utils/JSON/emoji.json';

export default {
  description: 'Get information about this message, user and server it was sent from!',
  data: new ContextMenuCommandBuilder()
    .setName('Message Info')
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const db = getDb();
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

    const author = await interaction.client.users.fetch(networkMessage.authorId);
    const server = await interaction.client.guilds.fetch(networkMessage.serverId).catch(() => null);

    const embed = new EmbedBuilder()
      .setThumbnail(author.displayAvatarURL())
      .setDescription(stripIndents`
        ## ${emojis.normal.clipart} Message Info

        **Sent By:** 
        __${author.username}__${author.discriminator !== '0' ? `#${author.discriminator}` : ''} ${author.bot ? '(Bot)' : ''}

        **Sent From:**
        __${server?.name}__

        **Message ID:**
        __${target.id}__
        
        **Sent In (Hub):**
        __${networkMessage.hub?.name}__

        **Message Created:**
        <t:${Math.floor(target.createdTimestamp / 1000)}:R>
      `)
      .setColor('Random');

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('messageInfo')
        .setLabel('Message Info')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('serverInfo')
        .setLabel('Server Info')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('userInfo')
        .setLabel('User Info')
        .setStyle(ButtonStyle.Secondary),
    );

    const replyMsg = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: true,
    });

    // create a variable to store the profile card buffer
    let customCard: AttachmentBuilder | null = null;

    const collector = replyMsg?.createMessageComponentCollector({ idle: 30_000 });
    collector.on('collect', async i => {
      if (i.customId === 'serverInfo') {
        if (!server) {
          i.update({ content: 'Unable to find server!', embeds: [] });
          return;
        }

        const owner = await server.fetchOwner();
        const createdAt = Math.round(server.createdTimestamp / 1000);
        const guildSetup = await db.connectedList.findFirst({ where: { serverId: networkMessage.serverId } });

        const serverEmbed = new EmbedBuilder()
          .setColor(constants.colors.invisible)
          .setThumbnail(server.iconURL())
          .setImage(server.bannerURL())
          .setDescription(stripIndents`
          ## ${server?.name}
          ${server.description || 'No Description.'}

          **Owner:** 
        __${owner.user.username}__${owner.user.discriminator !== '0' ? `#${owner.user.discriminator}` : ''} ${owner.user.bot ? '(Bot)' : ''}

          **Created:** 
          <t:${createdAt}:d> (<t:${createdAt}:R>)

          **Member Count:** 
          __${server.memberCount}__

          **Invite:**
          __${guildSetup?.invite ? `[\`${guildSetup.invite}\`](https://discord.gg/${guildSetup.invite})` : 'Not Set.'}__`)
          .setFooter({ text: `ID: ${server.id}` });

        const components: ActionRowBuilder<ButtonBuilder>[] = [];
        const newButtons = ActionRowBuilder.from<ButtonBuilder>(buttons);
        newButtons.components[0].setDisabled(false);
        newButtons.components[1].setDisabled(true);
        components.push(newButtons);

        if (guildSetup?.invite) {
          components.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setURL(`https://discord.gg/${guildSetup?.invite}`)
              .setEmoji(emojis.icons.join)
              .setLabel('Join')),
          );
        }

        await i.update({ embeds: [serverEmbed], components, files: [] });
      }


      else if (i.customId === 'userInfo') {
        await i.deferUpdate();

        const createdAt = Math.round(author.createdTimestamp / 1000);

        const userEmbed = new EmbedBuilder()
          .setThumbnail(author.displayAvatarURL())
          .setColor('Random')
          .setImage(author.bannerURL() ?? null)
          .setDescription(stripIndents`
            ## ${author.username}${author.discriminator !== '0' ? `#${author.discriminator}` : ''} ${author.bot ? '(Bot)' : ''}

            **ID:**
            __${author.id}__

            **Created:**
            <t:${createdAt}:d> (<t:${createdAt}:R>)
            
            **Display Name:**
            __${author.globalName || 'Not Set.'}__

            **Hubs Owned:**
            __${await db.hubs.count({ where: { ownerId: author.id } })}__
          `)
          .setImage('attachment://customCard.png') // link to image that will be generated afterwards
          .setTimestamp();

        // disable the user info button
        const newButtons = ActionRowBuilder.from<ButtonBuilder>(buttons);
        newButtons.components[0].setDisabled(false);
        newButtons.components[2].setDisabled(true);

        // generate the profile card
        if (!customCard) customCard = new AttachmentBuilder(await profileImage(author.id), { name: 'customCard.png' });

        await interaction.editReply({
          embeds: [userEmbed],
          files: [customCard],
          components: [newButtons],
        });
      }
      else if (i.customId === 'messageInfo') {
        await i.update({ embeds: [embed], components: [buttons], files: [] });
      }
    });
  },
};