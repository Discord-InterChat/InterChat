import {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  ApplicationCommandType,
  RESTPostAPIApplicationCommandsJSONBody,
  ModalSubmitInteraction,
  userMention,
  Message,
  User,
} from 'discord.js';
import db from '../../utils/Db.js';
import BaseCommand from '../../core/BaseCommand.js';
import { HubSettingsBitField } from '../../utils/BitFields.js';
import { checkIfStaff, getAttachmentURL, replaceLinks, userVotedToday } from '../../utils/Utils.js';
import { censor } from '../../utils/Profanity.js';
import { RegisterInteractionHandler } from '../../decorators/Interaction.js';
import { CustomID } from '../../utils/CustomID.js';
import { t } from '../../utils/Locale.js';
import { emojis } from '../../utils/Constants.js';

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

    const target = interaction.targetMessage;

    if (!checkIfStaff(interaction.user.id) && !(await userVotedToday(interaction.user.id))) {
      await interaction.reply({
        content: t(
          { phrase: 'errors.mustVote', locale: interaction.user.locale },
          { emoji: emojis.no },
        ),
        ephemeral: true,
      });
      return;
    }

    const messageInDb = await db.originalMessages.findFirst({
      where: {
        OR: [
          { messageId: target.id },
          { broadcastMsgs: { some: { messageId: interaction.targetId } } },
        ],
      },
      include: { hub: true, broadcastMsgs: true },
    });

    if (!messageInDb) {
      await interaction.reply({
        content: t(
          {
            phrase: 'errors.unknownNetworkMessage',
            locale: interaction.user.locale,
          },
          { emoji: emojis.no },
        ),
        ephemeral: true,
      });
      return;
    }
    else if (interaction.user.id !== messageInDb.authorId) {
      await interaction.reply({
        content: t(
          { phrase: 'errors.notMessageAuthor', locale: interaction.user.locale },
          { emoji: emojis.no },
        ),
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
              `${target.content ?? target.embeds[0]?.description ?? ''}\n${
                target.embeds[0]?.image?.url ?? ''
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
  static async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const messageId = customId.args[0];

    const target = await interaction.channel?.messages.fetch(messageId).catch(() => null);
    if (!target) {
      await interaction.reply(t({ phrase: 'errors.unknownNetworkMessage' }, { emoji: emojis.no }));
      return;
    }

    const messageInDb = await db.originalMessages.findFirst({
      where: {
        OR: [{ messageId: target.id }, { broadcastMsgs: { some: { messageId: target.id } } }],
      },
      include: { hub: true, broadcastMsgs: true },
    });

    if (!messageInDb?.hub) {
      await interaction.reply(
        t(
          { phrase: 'errors.unknownNetworkMessage', locale: interaction.user.locale },
          { emoji: emojis.no },
        ),
      );
      return;
    }

    // defer it because it takes a while to edit the message
    await interaction.deferReply({ ephemeral: true });

    // get the new message input by user
    const userInput = interaction.fields.getTextInputValue('newMessage');
    const hubSettings = new HubSettingsBitField(messageInDb.hub.settings);
    const newMessage = hubSettings.has('HideLinks') ? replaceLinks(userInput) : userInput;
    const { newEmbed, censoredEmbed, compactMsg, censoredCmpctMsg } =
      await EditMessage.fabricateNewMsg(interaction.user, target, newMessage, messageInDb.serverId);

    const inviteLinks = ['discord.gg', 'discord.com/invite', 'dsc.gg'];
    const hasBlockInvites = hubSettings.has('BlockInvites');
    const hasDiscordInvite = inviteLinks.some((link) => newMessage.includes(link));

    if (hasBlockInvites && hasDiscordInvite) {
      await interaction.editReply(
        t({ phrase: 'errors.inviteLinks', locale: interaction.user.locale }, { emoji: emojis.no }),
      );
      return;
    }

    // find all the messages through the network
    const channelSettingsArr = await db.connectedList.findMany({
      where: { channelId: { in: messageInDb.broadcastMsgs.map((c) => c.channelId) } },
    });

    const results = messageInDb.broadcastMsgs.map(async (element) => {
      const channelSettings = channelSettingsArr.find((c) => c.channelId === element.channelId);
      if (!channelSettings) return false;

      const webhookURL = channelSettings.webhookURL.split('/');
      const webhook = await interaction.client
        .fetchWebhook(webhookURL[webhookURL.length - 2])
        ?.catch(() => null);

      if (webhook?.owner?.id !== interaction.client.user.id) return false;

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
    const edited = resultsArray.reduce((acc, cur) => acc + (cur ? 1 : 0), 0).toString();
    await interaction.editReply(
      t(
        { phrase: 'network.editSuccess', locale: interaction.user.locale },
        {
          edited,
          total: resultsArray.length.toString(),
          emoji: emojis.yes,
          user: userMention(messageInDb.authorId),
        },
      ),
    );
  }

  static async getImageUrls(target: Message, newMessage: string) {
    // get image from embed
    // get image from content
    const oldImageUrl = target.content
      ? await getAttachmentURL(target.content)
      : target.embeds[0]?.image?.url;
    const newImageUrl = await getAttachmentURL(newMessage);
    return { oldImageUrl, newImageUrl };
  }

  static async buildNewEmbed(
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

  static async fabricateNewMsg(user: User, target: Message, newMessage: string, serverId: string) {
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
