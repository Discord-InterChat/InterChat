import BlacklistManager from '#main/managers/BlacklistManager.js';


import { logUserUnblacklist } from '#utils/hub/logger/ModLogs.js';
import { t } from '#utils/Locale.js';
import { sendBlacklistNotif } from '#utils/moderation/blacklistUtils.js';
import type { ChatInputCommandInteraction, User } from 'discord.js';
import BlacklistCommand from './index.js';
import ms from 'ms';
import { HubService } from '#main/services/HubService.js';

export default class extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const { id: moderatorId } = interaction.user;
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const hubName = interaction.options.getString('hub');
    const hub = await this.getHub({ name: hubName, userId: moderatorId });
    if (!this.isValidHub(interaction, hub, locale)) return;

    const reason = interaction.options.getString('reason') ?? 'No reason provided.';
    const duration = ms(`${interaction.options.getString('duration')}`);
    const expires = duration ? new Date(Date.now() + duration) : null;
    const subcommandGroup = interaction.options.getSubcommandGroup();

    if (subcommandGroup === 'add') {
      const user = interaction.options.getUser('user', true);
      const blacklistManager = new BlacklistManager('user', user.id);

      const passedChecks = await this.runUserAddChecks(interaction, blacklistManager, {
        hubId: hub.id,
        userId: user.id,
        duration,
      });

      if (!passedChecks) return;

      await this.addUserBlacklist(interaction, blacklistManager, user, {
        expiresAt: expires,
        hubId: hub.id,
        reason,
      });

      await this.sendSuccessResponse(
        interaction,
        t('blacklist.success', locale, { name: user.username, emoji: this.getEmoji('tick') }),
        { reason, expires },
      );

      // send log to hub's log channel
      await blacklistManager.log(hub.id, interaction.client, {
        mod: interaction.user,
        reason,
        expiresAt: expires,
      });
    }
    else if (subcommandGroup === 'remove') {
      const userId = interaction.options.getString('user', true);
      const blacklistManager = new BlacklistManager('user', userId);

      const result = await this.removeUserBlacklist(interaction, blacklistManager, userId, {
        hubId: hub.id,
        reason,
      });

      if (!result) {
        await this.replyEmbed(
          interaction,
          t('errors.userNotBlacklisted', locale, { emoji: this.getEmoji('x_icon') }),
          { ephemeral: true },
        );
        return;
      }

      const user = await interaction.client.users.fetch(userId).catch(() => null);
      await interaction.followUp(
        t('blacklist.removed', locale, { emoji: this.getEmoji('delete'), name: `${user?.username}` }),
      );
    }
  }

  private async addUserBlacklist(
    interaction: ChatInputCommandInteraction,
    blacklistManager: BlacklistManager,
    user: User,
    { expiresAt, hubId, reason }: { expiresAt: Date | null; reason: string; hubId: string },
  ) {
    await blacklistManager.addBlacklist({
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
  }

  private async removeUserBlacklist(
    interaction: ChatInputCommandInteraction,
    blacklistManager: BlacklistManager,
    userId: string,
    opts: { hubId: string; reason: string },
  ) {
    const revoked = await blacklistManager.removeBlacklist(opts.hubId);
    const hub = await new HubService().fetchHub(opts.hubId);

    if (revoked && hub) {
      await logUserUnblacklist(interaction.client, hub, {
        id: userId,
        mod: interaction.user,
        reason: opts.reason,
      });
    }

    return revoked;
  }

  private async runUserAddChecks(
    interaction: ChatInputCommandInteraction,
    blacklistManager: BlacklistManager,
    opts: {
      userId: string;
      hubId: string;
      duration?: number;
    },
  ) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const hiddenOpt = { ephemeral: true };
    if (opts.userId === interaction.client.user?.id) {
      await this.replyEmbed(
        interaction,
        t('blacklist.user.easterEggs.blacklistBot', locale),
        hiddenOpt,
      );
      return false;
    }
    else if (opts.userId === interaction.user.id) {
      await this.replyEmbed(
        interaction,
        '<a:nuhuh:1256859727158050838> Nuh uh! You can\'t blacklist yourself.',
        hiddenOpt,
      );
      return false;
    }

    if (opts?.duration && opts.duration < 30_000) {
      await this.replyEmbed(
        interaction,
        `${this.getEmoji('x_icon')} Blacklist duration should be atleast 30 seconds or longer.`,
        hiddenOpt,
      );
      return false;
    }

    const userInBlacklist = await blacklistManager.fetchBlacklist(opts.hubId);
    if (userInBlacklist) {
      await this.replyEmbed(
        interaction,
        t('blacklist.user.alreadyBlacklisted', locale, { emoji: this.getEmoji('x_icon') }),
        hiddenOpt,
      );
      return false;
    }
    return true;
  }
}
