/* eslint-disable complexity */
import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { SerializedHubSettings } from '#main/modules/BitFields.js';
import VoteBasedLimiter from '#main/modules/VoteBasedLimiter.js';
import { HubService } from '#main/services/HubService.js';
import {
  findOriginalMessage,
  getBroadcast,
  getBroadcasts,
  getOriginalMessage,
} from '#main/utils/network/messageUtils.js';
import Constants, { ConnectionMode } from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { getAttachmentURL } from '#utils/ImageUtils.js';
import { t } from '#utils/Locale.js';
import { censor } from '#utils/ProfanityUtils.js';
import { containsInviteLinks, handleError, replaceLinks } from '#utils/Utils.js';
import {
  ActionRowBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  InteractionContextType,
  Message,
  MessageContextMenuCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
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
  readonly data: RESTPostAPIContextMenuApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Edit Message',
    contexts: [InteractionContextType.Guild],
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
        content: `${this.getEmoji('topggSparkles')} You've hit your daily limit for message edits. [Vote for InterChat](${Constants.Links.Vote}) on top.gg to get unlimited edits!`,
      });
      return;
    }

    const messageInDb =
      (await getOriginalMessage(interaction.targetId)) ??
      (await findOriginalMessage(interaction.targetId));

    if (!messageInDb) {
      await interaction.reply({
        content: t('errors.unknownNetworkMessage', locale, { emoji: this.getEmoji('x_icon') }),
      });
      return;
    }
    else if (interaction.user.id !== messageInDb.authorId) {
      await interaction.reply({
        content: t('errors.notMessageAuthor', locale, { emoji: this.getEmoji('x_icon') }),
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(new CustomID().setIdentifier('editMsg').setArgs(target.id).toString())
      .setTitle('Edit Message')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setRequired(true)
            .setCustomId('newMessage')
            .setStyle(TextInputStyle.Paragraph)
            .setLabel('Please enter your new message.')
            .setValue(messageInDb.content)
            .setMaxLength(950),
        ),
      );

    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('editMsg')
  override async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    // Defer the reply to give the user feedback
    await interaction.deferReply({ ephemeral: true });

    // Parse the custom ID to get the message ID
    const customId = CustomID.parseCustomId(interaction.customId);
    const [messageId] = customId.args;

    // Fetch the original message
    const target = await interaction.channel?.messages.fetch(messageId).catch(() => null);
    if (!target) {
      await this.replyEmbed(interaction, 'errors.unknownNetworkMessage', {
        t: { emoji: this.getEmoji('x_icon') },
      });
      return;
    }

    // Get the original message data
    const originalMsgData =
      (await getOriginalMessage(target.id)) ?? (await findOriginalMessage(target.id));

    if (!originalMsgData?.hubId) {
      await this.replyEmbed(interaction, 'errors.unknownNetworkMessage', {
        t: { emoji: this.getEmoji('x_icon') },
      });
      return;
    }

    // Fetch the hub information
    const hubService = new HubService(db);
    const hub = await hubService.fetchHub(originalMsgData.hubId);
    if (!hub) {
      await interaction.editReply(
        t('errors.unknownNetworkMessage', await this.getLocale(interaction), {
          emoji: this.getEmoji('x_icon'),
        }),
      );
      return;
    }

    // Get the new message input from the user
    const userInput = interaction.fields.getTextInputValue('newMessage');
    const messageToEdit = this.sanitizeMessage(userInput, hub.settings.getAll());

    // Check if the message contains invite links
    if (hub.settings.has('BlockInvites') && containsInviteLinks(messageToEdit)) {
      await interaction.editReply(
        t('errors.inviteLinks', await this.getLocale(interaction), { emoji: this.getEmoji('x_icon') }),
      );
      return;
    }

    const mode =
      target.id === originalMsgData.messageId
        ? ConnectionMode.Compact
        : ((
          await getBroadcast(originalMsgData?.messageId, originalMsgData?.hubId, {
            channelId: target.channelId,
          })
        )?.mode ?? ConnectionMode.Compact);

    // Prepare the new message contents and embeds
    const imageURLs = await this.getImageURLs(target, mode, messageToEdit);
    const newContents = this.getCompactContents(messageToEdit, imageURLs);
    const newEmbeds = await this.buildEmbeds(target, mode, messageToEdit, {
      guildId: originalMsgData.guildId,
      user: interaction.user,
      imageURLs,
    });

    // Find all the messages that need to be edited
    const broadcastedMsgs = Object.values(await getBroadcasts(target.id, originalMsgData.hubId));
    const channelSettingsArr = await db.connection.findMany({
      where: { channelId: { in: broadcastedMsgs.map((c) => c.channelId) } },
    });

    let counter = 0;
    for (const msg of broadcastedMsgs) {
      const connection = channelSettingsArr.find((c) => c.channelId === msg.channelId);
      if (!connection) continue;

      const webhook = await interaction.client
        .fetchWebhook(connection.webhookURL.split('/')[connection.webhookURL.split('/').length - 2])
        .catch(() => null);

      if (webhook?.owner?.id !== interaction.client.user.id) continue;

      let content;
      let embeds;
      if (msg.mode === ConnectionMode.Embed) {
        embeds = connection.profFilter ? [newEmbeds.censored] : [newEmbeds.normal];
      }
      else {
        content = connection.profFilter ? newContents.censored : newContents.normal;
      }

      // Edit the message
      const edited = await webhook
        .editMessage(msg.messageId, {
          content,
          embeds,
          threadId: connection.parentId ? connection.channelId : undefined,
        })
        .catch(() => null);

      if (edited) counter++;
    }

    // Update the reply with the edit results
    await interaction
      .editReply(
        t('network.editSuccess', await this.getLocale(interaction), {
          edited: counter.toString(),
          total: broadcastedMsgs.length.toString(),
          emoji: this.getEmoji('tick_icon'),
          user: userMention(originalMsgData.authorId),
        }),
      )
      .catch(handleError);

    // Decrement the vote limiter
    const voteLimiter = new VoteBasedLimiter(
      'editMsg',
      interaction.user.id,
      interaction.client.userManager,
    );
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
    mode: ConnectionMode,
    messageToEdit: string,
    opts: { user: User; guildId: string; imageURLs?: ImageUrls },
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

    if (mode === ConnectionMode.Embed) {
      // utilize the embed directly from the message
      embed = EmbedBuilder.from(target.embeds[0]).setDescription(embedContent).setImage(embedImage);
    }
    else {
      const guild = await target.client.fetchGuild(opts.guildId);

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

  private sanitizeMessage(content: string, settings: SerializedHubSettings) {
    const newMessage = settings.HideLinks ? replaceLinks(content) : content;
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
