import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type Client,
  EmbedBuilder,
  type Interaction,
  Message,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type Snowflake,
} from 'discord.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import BlacklistManager from '#main/managers/BlacklistManager.js';
import { HubService } from '#main/services/HubService.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';
import { type supportedLocaleCodes, t } from '#main/utils/Locale.js';
import { checkIfStaff } from '#main/utils/Utils.js';
import { isStaffOrHubMod } from '#main/utils/hub/utils.js';
import { isDeleteInProgress } from '#main/utils/moderation/deleteMessage.js';
import RemoveReactionsHandler from '#main/utils/moderation/modPanel/handlers/RemoveReactionsHandler.js';
import {
  BlacklistServerHandler,
  BlacklistUserHandler,
} from '#main/utils/moderation/modPanel/handlers/blacklistHandler.js';
import DeleteMessageHandler from '#main/utils/moderation/modPanel/handlers/deleteMsgHandler.js';
import UserBanHandler from '#main/utils/moderation/modPanel/handlers/userBanHandler.js';
import ViewInfractionsHandler from '#main/utils/moderation/modPanel/handlers/viewInfractions.js';
import { type OriginalMessage, getOriginalMessage } from '#main/utils/network/messageUtils.js';
import Constants from '#utils/Constants.js';

type BuilderOpts = {
  isUserBlacklisted: boolean;
  isServerBlacklisted: boolean;
  isDeleteInProgress: boolean;
  isBanned: boolean;
};

export default class ModPanelHandler {
  private readonly modActionHandlers = {
    deleteMsg: new DeleteMessageHandler(),
    banUser: new UserBanHandler(),
    blacklistUser: new BlacklistUserHandler(),
    blacklistServer: new BlacklistServerHandler(),
    removeAllReactions: new RemoveReactionsHandler(),
    viewInfractions: new ViewInfractionsHandler(),
  };

  @RegisterInteractionHandler('modPanel')
  async handleButtons(interaction: ButtonInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [userId, originalMsgId] = customId.args;
    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);

    if (!(await this.validateUser(interaction, userId, locale))) return;

    const handler = this.modActionHandlers[customId.suffix as keyof typeof this.modActionHandlers];
    if (handler) {
      await handler.handle(interaction, originalMsgId, locale);
    }
  }
  private async validateUser(
    interaction: RepliableInteraction,
    userId: string,
    locale: supportedLocaleCodes,
  ) {
    if (interaction.user.id !== userId) {
      const embed = new InfoEmbed().setDescription(
        t('errors.notYourAction', locale, {
          emoji: getEmoji('x_icon', interaction.client),
        }),
      );

      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return false;
    }

    return true;
  }

  @RegisterInteractionHandler('blacklist_modal')
  async handleBlacklistModal(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferUpdate();

    const customId = CustomID.parseCustomId(interaction.customId);
    const [originalMsgId] = customId.args;
    const originalMsg = await getOriginalMessage(originalMsgId);
    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);

    if (!originalMsg || !(await this.validateMessage(interaction, originalMsg, locale))) {
      return;
    }
    const handlerId = customId.suffix === 'user' ? 'blacklistUser' : 'blacklistServer';
    const handler = this.modActionHandlers[handlerId];
    if (handler?.handleModal) {
      await handler.handleModal(interaction, originalMsg, locale);
    }
  }
  private async validateMessage(
    interaction: RepliableInteraction,
    originalMsg: OriginalMessage,
    locale: supportedLocaleCodes,
  ) {
    const hubService = new HubService(db);
    const hub = await hubService.fetchHub(originalMsg.hubId);
    if (!hub || !(await isStaffOrHubMod(interaction.user.id, hub))) {
      const embed = new InfoEmbed().setDescription(
        t('errors.messageNotSentOrExpired', locale, {
          emoji: getEmoji('x_icon', interaction.client),
        }),
      );
      await interaction.editReply({ embeds: [embed] });
      return false;
    }

    return true;
  }
}

export async function buildModPanel(
  interaction: Interaction | Message,
  originalMsg: OriginalMessage,
) {
  const user = await interaction.client.users.fetch(originalMsg.authorId);
  const server = await interaction.client.fetchGuild(originalMsg.guildId);
  const deleteInProgress = await isDeleteInProgress(originalMsg.messageId);

  const { userManager } = interaction.client;
  const userBlManager = new BlacklistManager('user', originalMsg.authorId);
  const serverBlManager = new BlacklistManager('server', originalMsg.guildId);

  const isUserBlacklisted = Boolean(await userBlManager.fetchBlacklist(originalMsg.hubId));
  const isServerBlacklisted = Boolean(await serverBlManager.fetchBlacklist(originalMsg.hubId));
  const dbUserTarget = await userManager.getUser(user.id);

  const embed = buildInfoEmbed(
    user.username,
    server?.name ?? 'Unknown Server',
    interaction.client,
    {
      isUserBlacklisted,
      isServerBlacklisted,
      isBanned: Boolean(dbUserTarget?.banReason),
      isDeleteInProgress: deleteInProgress,
    },
  );

  const buttons = buildButtons(interaction, originalMsg.messageId, {
    isUserBlacklisted,
    isServerBlacklisted,
    isBanned: Boolean(dbUserTarget?.banReason),
    isDeleteInProgress: deleteInProgress,
  });

  return { embed, buttons };
}

function buildButtons(interaction: Interaction | Message, messageId: Snowflake, opts: BuilderOpts) {
  const author = interaction instanceof Message ? interaction.author : interaction.user;
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(new CustomID('modPanel:blacklistUser', [author.id, messageId]).toString())
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(getEmoji('person_icon', interaction.client))
      .setDisabled(opts.isUserBlacklisted),
    new ButtonBuilder()
      .setCustomId(new CustomID('modPanel:blacklistServer', [author.id, messageId]).toString())
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(getEmoji('globe_icon', interaction.client))
      .setDisabled(opts.isServerBlacklisted),
    new ButtonBuilder()
      .setCustomId(new CustomID('modPanel:removeAllReactions', [author.id, messageId]).toString())
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(getEmoji('plus_icon', interaction.client)),
    new ButtonBuilder()
      .setCustomId(new CustomID('modPanel:deleteMsg', [author.id, messageId]).toString())
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(getEmoji('deleteDanger_icon', interaction.client))
      .setDisabled(opts.isDeleteInProgress),
  );

  if (checkIfStaff(author.id)) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(new CustomID('modPanel:banUser', [author.id, messageId]).toString())
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmoji('blobFastBan', interaction.client))
        .setDisabled(opts.isBanned),
    );
  }

  const extras = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(new CustomID('modPanel:viewInfractions', [author.id, messageId]).toString())
      .setLabel('View Infractions')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(getEmoji('exclamation', interaction.client)),
  );

  return [buttons, extras];
}

function buildInfoEmbed(username: string, servername: string, client: Client, opts: BuilderOpts) {
  const userEmbedDesc = opts.isUserBlacklisted
    ? `~~User **${username}** is already blacklisted.~~`
    : `Blacklist user **${username}** from this hub.`;

  const serverEmbedDesc = opts.isServerBlacklisted
    ? `~~Server **${servername}** is already blacklisted.~~`
    : `Blacklist server **${servername}** from this hub.`;

  const deleteDesc = opts.isDeleteInProgress
    ? '~~Message is already deleted or is being deleted.~~'
    : 'Delete this message from all connections.';

  const banUserDesc = opts.isBanned
    ? '~~This user is already banned.~~'
    : 'Ban this user from the entire bot.';

  return new EmbedBuilder()
    .setColor(Constants.Colors.invisible)
    .setFooter({
      text: 'Target will be notified of the blacklist. Use /blacklist list to view all blacklists.',
    })
    .setDescription(stripIndents`
        ### ${getEmoji('timeout_icon', client)} Moderation Actions
        **${getEmoji('person_icon', client)} Blacklist User**: ${userEmbedDesc}
        **${getEmoji('globe_icon', client)} Blacklist Server**: ${serverEmbedDesc}
        **${getEmoji('plus_icon', client)} Remove Reactions**: Remove all reactions from this message.
        **${getEmoji('deleteDanger_icon', client)} Delete Message**: ${deleteDesc}
        **${getEmoji('blobFastBan', client)} Ban User**: ${banUserDesc}
    `);
}
