import Constants, { emojis } from '#main/config/Constants.js';
import BlacklistManager from '#main/managers/BlacklistManager.js';
import ServerInfractionManager from '#main/managers/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import { CustomID } from '#main/utils/CustomID.js';
import { isDeleteInProgress } from '#main/utils/moderation/deleteMessage.js';
import { ModActionsDbMsgT } from '#main/utils/moderation/modActions/utils.js';
import { checkIfStaff } from '#main/utils/Utils.js';
import { stripIndents } from 'common-tags';
import {
  type Interaction,
  type Snowflake,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

type BuilderOpts = {
  isUserBlacklisted: boolean;
  isServerBlacklisted: boolean;
  isDeleteInProgress: boolean;
  isBanned: boolean;
};

const buildButtons = (interaction: Interaction, messageId: Snowflake, opts: BuilderOpts) => {
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        new CustomID('modActions:blacklistUser', [interaction.user.id, messageId]).toString(),
      )
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emojis.user_icon)
      .setDisabled(opts.isUserBlacklisted),
    new ButtonBuilder()
      .setCustomId(
        new CustomID('modActions:blacklistServer', [interaction.user.id, messageId]).toString(),
      )
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emojis.globe_icon)
      .setDisabled(opts.isServerBlacklisted),
    new ButtonBuilder()
      .setCustomId(
        new CustomID('modActions:removeAllReactions', [interaction.user.id, messageId]).toString(),
      )
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emojis.add_icon),
    new ButtonBuilder()
      .setCustomId(
        new CustomID('modActions:deleteMsg', [interaction.user.id, messageId]).toString(),
      )
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emojis.deleteDanger_icon)
      .setDisabled(opts.isDeleteInProgress),
  );

  if (checkIfStaff(interaction.user.id)) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(
          new CustomID('modActions:banUser', [interaction.user.id, messageId]).toString(),
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.blobFastBan)
        .setDisabled(opts.isBanned),
    );
  }

  const extras = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        new CustomID('modActions:viewInfractions', [interaction.user.id, messageId]).toString(),
      )
      .setLabel('View Infractions')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emojis.exclamation),
  );

  return [buttons, extras];
};

const buildInfoEmbed = (username: string, servername: string, opts: BuilderOpts) => {
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

  return new EmbedBuilder().setColor(Constants.Colors.invisible).setFooter({
    text: 'Target will be notified of the blacklist. Use /blacklist list to view all blacklists.',
  }).setDescription(stripIndents`
        ### ${emojis.timeout_icon} Moderation Actions
        **${emojis.user_icon} Blacklist User**: ${userEmbedDesc}
        **${emojis.globe_icon} Blacklist Server**: ${serverEmbedDesc}
        **${emojis.add_icon} Remove Reactions**: Remove all reactions from this message.
        **${emojis.deleteDanger_icon} Delete Message**: ${deleteDesc}
        **${emojis.blobFastBan} Ban User**: ${banUserDesc}
    `);
};

const buildMessage = async (
  interaction: Interaction,
  originalMsg: ModActionsDbMsgT & { hubId: string },
) => {
  const user = await interaction.client.users.fetch(originalMsg.authorId);
  const server = await interaction.client.fetchGuild(originalMsg.serverId);
  const deleteInProgress = await isDeleteInProgress(originalMsg.messageId);


  const { userManager } = interaction.client;
  const userBlManager = new BlacklistManager(new UserInfractionManager(originalMsg.authorId));
  const serverBlManager = new BlacklistManager(new ServerInfractionManager(originalMsg.serverId));

  const isUserBlacklisted = Boolean(await userBlManager.fetchBlacklist(originalMsg.hubId));
  const isServerBlacklisted = Boolean(await serverBlManager.fetchBlacklist(originalMsg.hubId));
  const dbUserTarget = await userManager.getUser(user.id);

  const embed = buildInfoEmbed(user.username, server?.name ?? 'Unknown Server', {
    isUserBlacklisted,
    isServerBlacklisted,
    isBanned: Boolean(dbUserTarget?.banMeta?.reason),
    isDeleteInProgress: deleteInProgress,
  });

  const buttons = buildButtons(interaction, originalMsg.messageId, {
    isUserBlacklisted,
    isServerBlacklisted,
    isBanned: Boolean(dbUserTarget?.banMeta?.reason),
    isDeleteInProgress: deleteInProgress,
  });

  return { embed, buttons };
};

export default { buildButtons, buildInfoEmbed, buildMessage };
