import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import BlacklistManager from '#main/managers/BlacklistManager.js';
import HubLogManager from '#main/managers/HubLogManager.js';
import ServerInfractionManager from '#main/managers/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import { CustomID } from '#utils/CustomID.js';
import { ErrorEmbed, InfoEmbed } from '#utils/EmbedUtils.js';
import logAppeals from '#utils/hub/logger/Appeals.js';
import { fetchHub } from '#utils/hub/utils.js';
import Logger from '#utils/Logger.js';
import { buildAppealSubmitModal } from '#utils/moderation/blacklistUtils.js';
import { getReplyMethod, msToReadable } from '#utils/Utils.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  ModalSubmitInteraction,
  RepliableInteraction,
  Snowflake,
} from 'discord.js';

export const buildAppealSubmitButton = (type: 'user' | 'server', hubId: string) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(new CustomID('appealSubmit:button', [type, hubId]).toString())
      .setLabel('Appeal Blacklist')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary),
  );


export default class AppealInteraction {
  @RegisterInteractionHandler('appealSubmit', 'button')
  async appealSubmitButton(interaction: ButtonInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [type, hubId] = customId.args as ['user' | 'server', string];

    const appealChannelId = await this.validateBlacklistAppealLogConfig(interaction, hubId);
    const { passedCheck: passed } = await this.checkBlacklistOrSendError(interaction, hubId, type);
    if (!appealChannelId || !passed) return;

    if (
      type === 'server' &&
      (!interaction.inCachedGuild() ||
        !interaction.channel?.permissionsFor(interaction.member).has('ManageMessages', true))
    ) {
      const embed = new InfoEmbed().setDescription(
        'You do not have the required permissions in this channel to appeal this blacklist.',
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const modal = buildAppealSubmitModal(type, hubId);
    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('appealSubmit', 'modal')
  async appealSubmitModal(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const customId = CustomID.parseCustomId(interaction.customId);
    const [type, hubId] = customId.args as ['user' | 'server', string];

    const appealsConfig = await this.validateBlacklistAppealLogConfig(interaction, hubId);
    const { passedCheck } = await this.checkBlacklistOrSendError(interaction, hubId, type);
    if (!appealsConfig || !passedCheck) return;

    const { channelId: appealsChannelId, roleId: appealsRoleId } = appealsConfig;

    let appealIconUrl;
    let appealName;
    let appealTargetId;
    if (type === 'server') {
      appealIconUrl = interaction.guild?.iconURL();
      appealName = interaction.guild?.name;
      appealTargetId = interaction.guildId as string;

      new ServerInfractionManager(appealTargetId).updateInfraction(
        { type: 'BLACKLIST', hubId, status: 'ACTIVE' },
        { appealerUserId: interaction.user.id, appealedAt: new Date() },
      );
    }
    else {
      appealIconUrl = interaction.user.displayAvatarURL();
      appealName = interaction.user.username;
      appealTargetId = interaction.user.id;

      new UserInfractionManager(appealTargetId).updateInfraction(
        { type: 'BLACKLIST', hubId, status: 'ACTIVE' },
        { appealedAt: new Date() },
      );
    }

    await logAppeals(type, hubId, interaction.user, {
      appealsChannelId,
      appealsRoleId,
      appealName,
      appealTargetId,
      appealIconUrl: appealIconUrl ?? undefined,
      fields: {
        blacklistedFor: interaction.fields.getTextInputValue('blacklistedFor'),
        unblacklistReason: interaction.fields.getTextInputValue('unblacklistReason'),
        extras: interaction.fields.getTextInputValue('extras'),
      },
    });

    const embed = new InfoEmbed()
      .setTitle('📝 Appeal Sent')
      .setDescription(
        'Your blacklist appeal has been submitted. You will be notified via DM when the appeal is reviewed.',
      );

    await interaction.editReply({ embeds: [embed] });
  }

  @RegisterInteractionHandler('appealReview')
  async appealReviewButton(interaction: ButtonInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [type, hubId, targetId] = customId.args as ['user' | 'server', string, Snowflake];

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('disabledAppealReview')
        .setDisabled(true)
        .setLabel(
          `${customId.suffix === 'approve' ? 'Approved' : 'Rejected'} by @${interaction.user.username}`,
        )
        .setStyle(customId.suffix === 'approve' ? ButtonStyle.Success : ButtonStyle.Danger),
    );

    await interaction.update({ components: [button] });

    const blacklistManager =
      type === 'user'
        ? new BlacklistManager(new UserInfractionManager(targetId))
        : new BlacklistManager(new ServerInfractionManager(targetId));

    const blacklist = await blacklistManager.fetchBlacklist(hubId);
    if (!blacklist) return;

    if (customId.suffix === 'approve') await blacklistManager.removeBlacklist(hubId);
    const hub = await fetchHub(hubId);

    let appealer;
    let appealTarget;
    let extraServerSteps = '';
    if (type === 'user') {
      appealer = await interaction.client.users.fetch(targetId);
      appealTarget = `user \`${appealer.username}\``;
    }
    else {
      appealTarget =
        'serverName' in blacklist ? `server \`${blacklist.serverName}\`` : 'your server';
      appealer =
        'appealerUserId' in blacklist
          ? await interaction.client.users.fetch(blacklist.appealerUserId as string)
          : await interaction.client.users.fetch(targetId);
      extraServerSteps = `You can re-join the hub by running \`/hub join hub:${hub?.name}\`.`;
    }

    const approvalStatus = customId.suffix === 'approve' ? 'appealed 🎉' : 'rejected';
    const message = `
      ### Blacklist Appeal Review
      Your blacklist appeal for ${appealTarget} in the hub **${hub?.name}** has been ${approvalStatus}. ${extraServerSteps}
    `;

    const embed = new EmbedBuilder()
      .setColor(approvalStatus === 'rejected' ? 'Red' : 'Green')
      .setDescription(message);

    await appealer
      .send({ embeds: [embed] })
      .catch((e) => Logger.error(`Failed to DM appeal approval to ${appealer.tag}`, e));
  }

  async validateBlacklistAppealLogConfig(interaction: RepliableInteraction, hubId: string) {
    const hubLogManager = await HubLogManager.create(hubId);
    if (!hubLogManager.config.appeals?.channelId) {
      const embed = new InfoEmbed().setDescription('Blacklist appeals are disabled in this hub.');
      const replyMethod = getReplyMethod(interaction);

      await interaction[replyMethod]({ embeds: [embed], ephemeral: true });
      return null;
    }

    return hubLogManager.config.appeals;
  }

  async checkBlacklistOrSendError(
    interaction: RepliableInteraction,
    hubId: string,
    type: 'user' | 'server',
  ): Promise<{ passedCheck: boolean }> {
    const infractionManager =
      type === 'user'
        ? new UserInfractionManager(interaction.user.id)
        : new ServerInfractionManager(interaction.guildId as string);


    const blacklistManager = new BlacklistManager(infractionManager);

    const hub = await fetchHub(hubId);
    const allInfractions = await infractionManager.getHubInfractions(hubId, { type: 'BLACKLIST' });

    const sevenDays = 60 * 60 * 24 * 7 * 1000;
    const appealCooldown = hub?.appealCooldownHours
      ? hub.appealCooldownHours * (60 * 60 * 1000)
      : sevenDays;

    const lastAppealed = allInfractions.find(
      (i) => i.appealedAt && i.appealedAt.getTime() + appealCooldown > Date.now(),
    );

    if (lastAppealed?.appealedAt) {
      const embed = new ErrorEmbed().setDescription(
        `You can only appeal once every **${msToReadable(appealCooldown, false)}**.`,
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return { passedCheck: false };
    }

    // if last appeal was less than 7 days ago

    const blacklist = await blacklistManager.fetchBlacklist(hubId);
    if (!blacklist) {
      const embed = new ErrorEmbed().setDescription(
        'You cannot appeal a blacklist that does not exist.',
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return { passedCheck: false };
    }

    return { passedCheck: true };
  }
}
