import BlacklistManager from '#main/managers/BlacklistManager.js';
import type { ChatInputCommandInteraction, User } from 'discord.js';
import ms from 'ms';
import { HubService } from '#main/services/HubService.js';
import { supportedLocaleCodes, t } from '#utils/Locale.js';
import { logUserUnblacklist } from '#utils/hub/logger/ModLogs.js';
import { sendBlacklistNotif } from '#utils/moderation/blacklistUtils.js';
import BlacklistCommand from './index.js';
import { Infraction } from '@prisma/client';

interface BlacklistOptions {
  expiresAt: Date | null;
  hubId: string;
  reason: string;
}

interface UserCheckOptions {
  userId: string;
  hubId: string;
  duration?: number;
}

export default class extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const commandData = await this.extractCommandData(interaction);
    if (!commandData) return;

    const { hub, reason, expires, subcommandGroup } = commandData;

    if (subcommandGroup === 'add') {
      await this.handleAddBlacklist(interaction, hub.id, reason, expires);
    }
    else if (subcommandGroup === 'remove') {
      await this.handleRemoveBlacklist(interaction, hub.id, reason);
    }
  }

  private async extractCommandData(interaction: ChatInputCommandInteraction) {
    const moderatorId = interaction.user.id;
    const locale = await interaction.client.userManager.getUserLocale(moderatorId);

    const hubName = interaction.options.getString('hub');
    const hub = await this.getHub({ name: hubName, userId: moderatorId });

    if (!this.isValidHub(interaction, hub, locale)) return null;

    const reason = interaction.options.getString('reason') ?? 'No reason provided.';
    const durationString = interaction.options.getString('duration');
    const duration = durationString ? ms(durationString) : null;
    const expires = duration ? new Date(Date.now() + duration) : null;
    const subcommandGroup = interaction.options.getSubcommandGroup();

    return { hub, reason, duration, expires, subcommandGroup };
  }

  private async handleAddBlacklist(
    interaction: ChatInputCommandInteraction,
    hubId: string,
    reason: string,
    expires: Date | null,
  ) {
    const user = interaction.options.getUser('user', true);
    const blacklistManager = new BlacklistManager('user', user.id);

    const passedChecks = await this.runUserAddChecks(interaction, blacklistManager, {
      hubId,
      userId: user.id,
      duration: expires ? expires.getTime() - Date.now() : undefined,
    });

    if (!passedChecks) return;

    const blacklist = await this.addUserBlacklist(interaction, blacklistManager, user, {
      expiresAt: expires,
      hubId,
      reason,
    });

    await this.sendSuccessNotifications(interaction, user, blacklist, blacklistManager, hubId);
  }

  private async handleRemoveBlacklist(
    interaction: ChatInputCommandInteraction,
    hubId: string,
    reason: string,
  ) {
    const userId = interaction.options.getString('user', true);
    const blacklistManager = new BlacklistManager('user', userId);
    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);

    const wasRemoved = await this.removeUserBlacklist(interaction, blacklistManager, userId, {
      hubId,
      reason,
    });

    if (!wasRemoved) {
      await this.sendUserNotBlacklistedError(interaction, locale);
      return;
    }

    await this.sendRemovalConfirmation(interaction, userId, locale);
  }

  private async sendSuccessNotifications(
    interaction: ChatInputCommandInteraction,
    user: User,
    blacklist: Infraction,
    blacklistManager: BlacklistManager,
    hubId: string,
  ) {
    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);
    const { reason, expiresAt: expires } = blacklist;

    await this.sendSuccessResponse(
      interaction,
      t('blacklist.success', locale, {
        name: user.username,
        emoji: this.getEmoji('tick'),
      }),
      { reason, expires },
    );

    await blacklistManager.log(hubId, interaction.client, {
      mod: interaction.user,
      reason,
      expiresAt: expires,
    });
  }

  private async sendUserNotBlacklistedError(
    interaction: ChatInputCommandInteraction,
    locale: supportedLocaleCodes,
  ) {
    await this.replyEmbed(
      interaction,
      t('errors.userNotBlacklisted', locale, { emoji: this.getEmoji('x_icon') }),
      { flags: ['Ephemeral'] },
    );
  }

  private async sendRemovalConfirmation(
    interaction: ChatInputCommandInteraction,
    userId: string,
    locale: supportedLocaleCodes,
  ) {
    const user = await interaction.client.users.fetch(userId).catch(() => null);
    await interaction.followUp(
      t('blacklist.removed', locale, {
        emoji: this.getEmoji('delete'),
        name: user?.username ?? userId,
      }),
    );
  }

  private async addUserBlacklist(
    interaction: ChatInputCommandInteraction,
    blacklistManager: BlacklistManager,
    user: User,
    { expiresAt, hubId, reason }: BlacklistOptions,
  ) {
    const blacklist = await blacklistManager.addBlacklist({
      hubId,
      reason,
      expiresAt,
      moderatorId: interaction.user.id,
    });

    await sendBlacklistNotif('user', interaction.client, {
      target: user,
      expiresAt,
      hubId,
      reason,
    });

    return blacklist;
  }

  private async removeUserBlacklist(
    interaction: ChatInputCommandInteraction,
    blacklistManager: BlacklistManager,
    userId: string,
    { hubId, reason }: Omit<BlacklistOptions, 'expiresAt'>,
  ) {
    const revoked = await blacklistManager.removeBlacklist(hubId);
    const hub = await new HubService().fetchHub(hubId);

    if (revoked && hub) {
      await logUserUnblacklist(interaction.client, hub, {
        id: userId,
        mod: interaction.user,
        reason,
      });
    }

    return revoked;
  }

  private async runUserAddChecks(
    interaction: ChatInputCommandInteraction,
    blacklistManager: BlacklistManager,
    { userId, hubId, duration }: UserCheckOptions,
  ) {
    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);
    const hiddenOpt = { flags: ['Ephemeral'] } as const;

    if (await this.hasBlockingCondition(interaction, userId, duration, locale)) {
      return false;
    }

    const userInBlacklist = await blacklistManager.fetchBlacklist(hubId);
    if (userInBlacklist) {
      await this.replyEmbed(
        interaction,
        t('blacklist.user.alreadyBlacklisted', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        hiddenOpt,
      );
      return false;
    }

    return true;
  }

  private async hasBlockingCondition(
    interaction: ChatInputCommandInteraction,
    userId: string,
    duration: number | undefined,
    locale: supportedLocaleCodes,
  ) {
    const hiddenOpt = { flags: ['Ephemeral'] } as const;

    if (userId === interaction.client.user?.id) {
      await this.replyEmbed(
        interaction,
        t('blacklist.user.easterEggs.blacklistBot', locale),
        hiddenOpt,
      );
      return true;
    }

    if (userId === interaction.user.id) {
      await this.replyEmbed(
        interaction,
        '<a:nuhuh:1256859727158050838> Nuh uh! You can\'t blacklist yourself.',
        hiddenOpt,
      );
      return true;
    }

    if (duration && duration < 30_000) {
      await this.replyEmbed(
        interaction,
        `${this.getEmoji('x_icon')} Blacklist duration should be atleast 30 seconds or longer.`,
        hiddenOpt,
      );
      return true;
    }

    return false;
  }
}
