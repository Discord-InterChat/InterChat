import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import VoteBasedLimiter from '#main/modules/VoteBasedLimiter.js';
import { HubSettingsBitField } from '#main/utils/BitFields.js';
import Constants, { ConnectionMode, emojis } from '#main/utils/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { censor } from '#main/utils/Profanity.js';
import {
  containsInviteLinks,
  getAttachmentURL,
  handleError,
  replaceLinks,
} from '#main/utils/Utils.js';
import { originalMessages } from '@prisma/client';
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

interface ImageUrls {
  oldURL?: string | null;
  newURL?: string | null;
}

export default class EditMessage extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Edit Message',
    dm_permission: false,
  };

  readonly cooldown = 10_000;

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    const isOnCooldown = await this.checkOrSetCooldown(interaction);
    if (isOnCooldown) return;

    const { userManager } = interaction.client;
    const target = interaction.targetMessage;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const voteLimiter = new VoteBasedLimiter('editMsg', interaction.user.id, userManager);

    if (await voteLimiter.hasExceededLimit()) {
      await interaction.reply({
        content: `${emojis.topggSparkles} You've hit your daily limit for message edits. [Vote for InterChat](${Constants.Links.Vote}) on top.gg to get unlimited edits!`,
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

    let targetMsgData = await db.originalMessages.findFirst({
      where: { messageId: target.id },
      include: { hub: true, broadcastMsgs: true },
    });

    if (!targetMsgData) {
      const broadcastedMsg = await db.broadcastedMessages.findFirst({
        where: { messageId: target.id },
        include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
      });

      targetMsgData = broadcastedMsg?.originalMsg ?? null;
    }

    if (!targetMsgData?.hub) {
      await interaction.editReply(
        t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
      );
      return;
    }

    // get the new message input by user
    const userInput = interaction.fields.getTextInputValue('newMessage');
    const hubSettings = new HubSettingsBitField(targetMsgData.hub.settings);
    const messageToEdit = this.sanitizeMessage(userInput, hubSettings);

    if (hubSettings.has('BlockInvites') && containsInviteLinks(messageToEdit)) {
      await interaction.editReply(
        t({ phrase: 'errors.inviteLinks', locale }, { emoji: emojis.no }),
      );
      return;
    }

    const imageURLs = await this.getImageURLs(target, targetMsgData.mode, messageToEdit);
    const newContents = this.getCompactContents(messageToEdit, imageURLs);
    const newEmbeds = await this.buildEmbeds(target, targetMsgData, messageToEdit, {
      serverId: targetMsgData.serverId,
      user: interaction.user,
      imageURLs,
    });

    // find all the messages through the network
    const channelSettingsArr = await db.connectedList.findMany({
      where: { channelId: { in: targetMsgData.broadcastMsgs.map((c) => c.channelId) } },
    });

    const results = targetMsgData.broadcastMsgs.map(async (msg) => {
      const connection = channelSettingsArr.find((c) => c.channelId === msg.channelId);
      if (!connection) return false;

      const webhookURL = connection.webhookURL.split('/');
      const webhook = await interaction.client
        .fetchWebhook(webhookURL[webhookURL.length - 2])
        ?.catch(() => null);

      if (webhook?.owner?.id !== interaction.client.user.id) return false;

      let content;
      let embeds;

      if (msg.mode === ConnectionMode.Embed) {
        embeds = connection.profFilter ? [newEmbeds.censored] : [newEmbeds.normal];
      }
      else {
        content = connection.profFilter ? newContents.censored : newContents.normal;
      }

      // finally, edit the message
      return await webhook
        .editMessage(msg.messageId, {
          content,
          embeds,
          threadId: connection.parentId ? connection.channelId : undefined,
        })
        .then(() => true)
        .catch(() => false);
    });

    const resultsArray = await Promise.all(results);
    const edited = resultsArray.reduce((acc, cur) => acc + (cur ? 1 : 0), 0).toString();

    await interaction
      .editReply(
        t(
          { phrase: 'network.editSuccess', locale },
          {
            edited,
            total: resultsArray.length.toString(),
            emoji: emojis.yes,
            user: userMention(targetMsgData.authorId),
          },
        ),
      )
      .catch(handleError);

    const voteLimiter = new VoteBasedLimiter('editMsg', interaction.user.id, userManager);
    await voteLimiter.decrementUses();
  }

  private async getImageURLs(
    target: Message,
    mode: ConnectionMode,
    newMessage: string,
  ): Promise<ImageUrls> {
    const oldURL =
      mode === ConnectionMode.Compact
        ? await getAttachmentURL(target.content)
        : target.embeds[0]?.image?.url;

    const newURL = await getAttachmentURL(newMessage);

    return { oldURL, newURL };
  }

  private async buildEmbeds(
    target: Message,
    targetMsgData: originalMessages,
    messageToEdit: string,
    opts: { user: User; serverId: string; imageURLs?: ImageUrls },
  ) {
    let embedContent = messageToEdit;
    let embedImage = null;

    // This if check must come on top of the next one at all times
    // because we want newImage Url to be given priority for the embedImage
    if (opts.imageURLs?.newURL) {
      embedContent = embedContent.replace(opts.imageURLs.newURL, '');
      embedImage = opts.imageURLs.newURL;
    }
    if (opts.imageURLs?.oldURL) {
      embedContent = embedContent.replace(opts.imageURLs.oldURL, '');
      embedImage = opts.imageURLs.oldURL;
    }

    let embed: EmbedBuilder;

    if (targetMsgData.mode === ConnectionMode.Embed) {
      // utilize the embed directly from the message
      embed = EmbedBuilder.from(target.embeds[0]).setDescription(embedContent).setImage(embedImage);
    }
    else {
      const guild = await target.client.fetchGuild(opts.serverId);

      // create a new embed if the message being edited is in compact mode
      embed = new EmbedBuilder()
        .setAuthor({ name: opts.user.username, iconURL: opts.user.displayAvatarURL() })
        .setDescription(embedContent)
        .setColor(Constants.Colors.invisible)
        .setImage(embedImage)
        .addFields(
          target.embeds.at(0)?.fields.at(0)
            ? [{ name: 'Replying-to', value: `${target.embeds[0].description}` }]
            : [],
        )
        .setFooter({ text: `Server: ${guild?.name}` });
    }

    const censored = EmbedBuilder.from({ ...embed.data, description: censor(embedContent) });

    return { normal: embed, censored };
  }

  private sanitizeMessage(content: string, settings: HubSettingsBitField) {
    const newMessage = settings.has('HideLinks') ? replaceLinks(content) : content;
    return newMessage;
  }

  private getCompactContents(messageToEdit: string, imageUrls: ImageUrls) {
    let compactMsg = messageToEdit;

    if (imageUrls.oldURL && imageUrls.newURL) {
      // use the new url instead
      compactMsg = compactMsg.replace(imageUrls.oldURL, imageUrls.newURL);
    }

    return { normal: compactMsg, censored: censor(compactMsg) };
  }
}
