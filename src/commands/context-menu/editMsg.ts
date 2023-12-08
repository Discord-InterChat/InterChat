import {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  ApplicationCommandType,
  RESTPostAPIApplicationCommandsJSONBody,
  CacheType,
  ModalSubmitInteraction,
} from 'discord.js';
import db from '../../utils/Db.js';
import BaseCommand from '../BaseCommand.js';
import { HubSettingsBitField } from '../../utils/BitFields.js';
import { checkIfStaff, hasVoted, replaceLinks } from '../../utils/Utils.js';
import { censor } from '../../utils/Profanity.js';
import { RegisterInteractionHandler } from '../../decorators/Interaction.js';
import { CustomID } from '../../utils/CustomID.js';
import { __ } from '../../utils/Locale.js';

export default class DeleteMessage extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Edit Message',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const target = interaction.targetMessage;

    if (!checkIfStaff(interaction.user.id) && !(await hasVoted(interaction.user.id))) {
      await interaction.reply({
        content: __({ phrase: 'errors.mustVote', locale: interaction.user.locale }),
        ephemeral: true,
      });
      return;
    }

    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: { equals: target.id } } } },
      include: { hub: true },
    });

    if (!messageInDb) {
      await interaction.reply({
        content: __(
          __({
            phrase: 'errors.unknownNetworkMessage',
            locale: interaction.user.locale,
          }),
        ),
        ephemeral: true,
      });
      return;
    }
    else if (interaction.user.id != messageInDb?.authorId) {
      await interaction.reply({
        content: __({ phrase: 'errors.notMessageAuthor', locale: interaction.user.locale }),
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(new CustomID().setIdentifier('editMsg').addArgs(target.id).toString())
      .setTitle('Edit Message')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setRequired(true)
            .setCustomId('newMessage')
            .setStyle(TextInputStyle.Paragraph)
            .setLabel('Please enter your new message.')
            .setValue(
              `${(target.content || target.embeds[0]?.description) ?? ''}\n${
                target.embeds[0]?.image?.url || ''
              }`,
            )
            .setMaxLength(950),
        ),
      );

    await interaction.showModal(modal);
    // TODO
    // if (interaction.inCachedGuild()) networkMsgUpdate(interaction.member, target, newMessage);
  }

  @RegisterInteractionHandler('editMsg')
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const messageId = customId.args[0];

    const target = await interaction.channel?.messages.fetch(messageId).catch(() => null);
    if (!target) {
      return await interaction.reply(__({ phrase: 'errors.unknownNetworkMessage' }));
    }

    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: { equals: target.id } } } },
      include: { hub: true },
    });
    if (!messageInDb?.hub) {
      return await interaction.reply(
        __({ phrase: 'errors.unknownNetworkMessage', locale: interaction.user.locale }),
      );
    }

    // defer it because it takes a while to edit the message
    await interaction.deferReply({ ephemeral: true });

    // get the new message input by user
    const userInput = interaction.fields.getTextInputValue('newMessage');
    const hubSettings = new HubSettingsBitField(messageInDb.hub.settings);
    const newMessage = hubSettings.has('HideLinks') ? replaceLinks(userInput) : userInput;
    const networkManager = interaction.client.getNetworkManager();

    if (
      hubSettings.has('BlockInvites') &&
      (newMessage.includes('discord.gg') ||
        newMessage.includes('discord.com/invite') ||
        newMessage.includes('dsc.gg'))
    ) {
      await interaction.editReply(
        __({ phrase: 'errors.inviteLinks', locale: interaction.user.locale }),
      );
      return;
    }
    // get image from embed
    // get image from content
    const oldImageUrl = target.content
      ? await networkManager.getAttachmentURL(target.content)
      : target.embeds[0]?.image?.url;
    const newImageUrl = await networkManager.getAttachmentURL(newMessage);
    const guild = await interaction.client.fetchGuild(messageInDb.serverId);
    const embedContent = newMessage.replace(oldImageUrl ?? '', '').replace(newImageUrl ?? '', '');

    // if the message being edited is in compact mode
    // then we create a new embed with the new message and old reply
    // else we just use the old embed and replace the description
    const newEmbed = target.content
      ? new EmbedBuilder()
        .setAuthor({ name: target.author.username, iconURL: target.author.displayAvatarURL() })
        .setDescription(embedContent || null)
        .setColor(target.member?.displayHexColor ?? 'Random')
        .setImage(newImageUrl || oldImageUrl || null)
        .addFields(
          target.embeds[0].fields[0]
            ? [{ name: 'Replying-to', value: `${target.embeds[0].description}` }]
            : [],
        )
        .setFooter({ text: `Server: ${guild?.name}` })
      : EmbedBuilder.from(target.embeds[0])
        .setDescription(embedContent || null)
        .setImage(newImageUrl || oldImageUrl || null);

    const censoredEmbed = EmbedBuilder.from(newEmbed).setDescription(
      censor(newEmbed.data.description ?? '') || null,
    );
    let compactMsg = newMessage;

    if (oldImageUrl) {
      if (newImageUrl) {
        compactMsg = compactMsg.replace(oldImageUrl, newImageUrl);
      }
      else if (!newMessage.includes(oldImageUrl)) {
        newEmbed.setImage(null);
        censoredEmbed.setImage(null);
      }
    }

    const censoredCmpctMsg = censor(compactMsg);

    // find all the messages through the network
    const channelSettingsArr = await db.connectedList.findMany({
      where: { channelId: { in: messageInDb.channelAndMessageIds.map((c) => c.channelId) } },
    });

    const results = messageInDb.channelAndMessageIds.map(async (element) => {
      const channelSettings = channelSettingsArr.find((c) => c.channelId === element.channelId);
      if (!channelSettings) return false;

      const webhookURL = channelSettings.webhookURL.split('/');
      const webhook = await interaction.client
        .fetchWebhook(webhookURL[webhookURL.length - 2])
        ?.catch(() => null);

      if (!webhook || webhook.owner?.id !== interaction.client.user.id) return false;

      // finally, edit the message
      return await webhook
        .editMessage(element.messageId, {
          content: channelSettings.compact
            ? channelSettings.profFilter
              ? censoredCmpctMsg
              : compactMsg
            : undefined,
          threadId: channelSettings.parentId ? channelSettings.channelId : undefined,
          embeds: !channelSettings.compact
            ? [channelSettings.profFilter ? censoredEmbed : newEmbed]
            : undefined,
        })
        .then(() => true)
        .catch(() => false);
    });

    const resultsArray = await Promise.all(results);
    const edited = resultsArray.reduce((acc, cur) => acc + (cur ? 1 : 0), 0);
    await interaction.editReply(
      __(
        { phrase: 'editMsg.editSuccess', locale: interaction.user.locale },
        { edited: `${edited}`, total: `${resultsArray.length}` },
      ),
    );
  }
}
