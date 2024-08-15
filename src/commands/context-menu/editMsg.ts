import { HubSettingsBitField } from '#main/utils/BitFields.js';
import { emojis } from '#main/utils/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { censor } from '#main/utils/Profanity.js';
import {
  checkIfStaff,
  containsInviteLinks,
  getAttachmentURL,
  replaceLinks,
} from '#main/utils/Utils.js';
import {
  ActionRowBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  Message,
  MessageContextMenuCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  TextInputBuilder,
  TextInputStyle,
  User,
  userMention,
} from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';

export default class EditMessage extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Edit Message',
    dm_permission: false,
  };
  readonly cooldown = 10_000;

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    const isOnCooldown = await this.checkAndSetCooldown(interaction);
    if (isOnCooldown) return;

    const { userManager } = interaction.client;
    const target = interaction.targetMessage;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (
      !checkIfStaff(interaction.user.id) &&
      !(await userManager.userVotedToday(interaction.user.id))
    ) {
      await interaction.reply({
        content: t({ phrase: 'errors.mustVote', locale }, { emoji: emojis.no }),
      });
      return;
    }

    let messageInDb = await db.originalMessages.findFirst({
      where: { messageId: interaction.targetId },
      include: { hub: true, broadcastMsgs: true },
    });

    if (!messageInDb) {
      const broadcastedMsg = await db.broadcastedMessages.findFirst({
        where: { messageId: interaction.targetId },
        include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
      });

      messageInDb = broadcastedMsg?.originalMsg ?? null;
    }

    if (!messageInDb) {
      await interaction.reply({
        content: t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
      });
      return;
    }
    else if (interaction.user.id !== messageInDb.authorId) {
      await interaction.reply({
        content: t({ phrase: 'errors.notMessageAuthor', locale }, { emoji: emojis.no }),
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
              `${target.content ?? target.embeds[0]?.description ?? ''}\n${
                target.embeds[0]?.image?.url ?? ''
              }`,
            )
            .setMaxLength(950),
        ),
      );

    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('editMsg')
  override async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const customId = CustomID.parseCustomId(interaction.customId);
    const [messageId] = customId.args;
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const target = await interaction.channel?.messages.fetch(messageId).catch(() => null);
    if (!target) {
      await interaction.editReply(
        t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
      );
      return;
    }

    let originalMsg = await db.originalMessages.findFirst({
      where: { messageId: target.id },
      include: { hub: true, broadcastMsgs: true },
    });

    if (!originalMsg) {
      const broadcastedMsg = await db.broadcastedMessages.findFirst({
        where: { messageId: target.id },
        include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
      });

      originalMsg = broadcastedMsg?.originalMsg ?? null;
    }

    if (!originalMsg?.hub) {
      await interaction.editReply(
        t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
      );
      return;
    }

    // get the new message input by user
    const userInput = interaction.fields.getTextInputValue('newMessage');
    const hubSettings = new HubSettingsBitField(originalMsg.hub.settings);
    const newMessage = hubSettings.has('HideLinks') ? replaceLinks(userInput) : userInput;
    const { newEmbed, censoredEmbed, compactMsg, censoredCmpctMsg } = await this.fabricateNewMsg(
      interaction.user,
      target,
      newMessage,
      originalMsg.serverId,
    );

    if (hubSettings.has('BlockInvites') && containsInviteLinks(newMessage)) {
      await interaction.editReply(
        t({ phrase: 'errors.inviteLinks', locale }, { emoji: emojis.no }),
      );
      return;
    }

    // find all the messages through the network
    const channelSettingsArr = await db.connectedList.findMany({
      where: { channelId: { in: originalMsg.broadcastMsgs.map((c) => c.channelId) } },
    });

    const results = originalMsg.broadcastMsgs.map(async (element) => {
      const settings = channelSettingsArr.find((c) => c.channelId === element.channelId);
      if (!settings) return false;

      const webhookURL = settings.webhookURL.split('/');
      const webhook = await interaction.client
        .fetchWebhook(webhookURL[webhookURL.length - 2])
        ?.catch(() => null);

      if (webhook?.owner?.id !== interaction.client.user.id) return false;

      let content;
      let embeds;

      if (!settings.compact) embeds = settings.profFilter ? [censoredEmbed] : [newEmbed];
      else content = settings.profFilter ? censoredCmpctMsg : compactMsg;

      // finally, edit the message
      return await webhook
        .editMessage(element.messageId, {
          content,
          embeds,
          threadId: settings.parentId ? settings.channelId : undefined,
        })
        .then(() => true)
        .catch(() => false);
    });

    const resultsArray = await Promise.all(results);
    const edited = resultsArray.reduce((acc, cur) => acc + (cur ? 1 : 0), 0).toString();
    await interaction.editReply(
      t(
        { phrase: 'network.editSuccess', locale },
        {
          edited,
          total: resultsArray.length.toString(),
          emoji: emojis.yes,
          user: userMention(originalMsg.authorId),
        },
      ),
    );
  }

  private async getImageUrls(target: Message, newMessage: string) {
    // get image from embed
    // get image from content
    const oldImageUrl = target.content
      ? await getAttachmentURL(target.content)
      : target.embeds[0]?.image?.url;
    const newImageUrl = await getAttachmentURL(newMessage);
    return { oldImageUrl, newImageUrl };
  }

  private async buildNewEmbed(
    user: User,
    target: Message,
    newMessage: string,
    serverId: string,
    opts?: {
      oldImageUrl?: string | null;
      newImageUrl?: string | null;
    },
  ) {
    const embedContent =
      newMessage.replace(opts?.oldImageUrl ?? '', '').replace(opts?.newImageUrl ?? '', '') ?? null;
    const embedImage = opts?.newImageUrl ?? opts?.oldImageUrl ?? null;

    if (!target.content) {
      // utilize the embed directly from the message
      return EmbedBuilder.from(target.embeds[0]).setDescription(embedContent).setImage(embedImage);
    }

    const guild = await target.client.fetchGuild(serverId);

    // create a new embed if the message being edited is in compact mode
    return new EmbedBuilder()
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
      .setDescription(embedContent)
      .setColor('Random')
      .setImage(embedImage)
      .addFields(
        target.embeds.at(0)?.fields.at(0)
          ? [{ name: 'Replying-to', value: `${target.embeds[0].description}` }]
          : [],
      )
      .setFooter({ text: `Server: ${guild?.name}` });
  }

  private async fabricateNewMsg(user: User, target: Message, newMessage: string, serverId: string) {
    const { oldImageUrl, newImageUrl } = await this.getImageUrls(target, newMessage);
    const newEmbed = await this.buildNewEmbed(user, target, newMessage, serverId, {
      oldImageUrl,
      newImageUrl,
    });

    // if the message being edited is in compact mode
    // then we create a new embed with the new message and old reply
    // else we just use the old embed and replace the description

    const censoredEmbed = EmbedBuilder.from(newEmbed).setDescription(
      censor(newEmbed.data.description ?? '') || null,
    );
    let compactMsg = newMessage;

    if (oldImageUrl && newImageUrl) {
      compactMsg = compactMsg.replace(oldImageUrl, newImageUrl);
    }
    else if (oldImageUrl && !newMessage.includes(oldImageUrl)) {
      newEmbed.setImage(null);
      censoredEmbed.setImage(null);
    }
    const censoredCmpctMsg = censor(compactMsg);

    return { newEmbed, censoredEmbed, compactMsg, censoredCmpctMsg };
  }
}
