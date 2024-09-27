import { emojis } from '#main/config/Constants.js';
import BlacklistManager from '#main/modules/BlacklistManager.js';
import UserInfractionManager from '#main/modules/InfractionManager/UserInfractionManager.js';
import { logBlacklist, logUserUnblacklist } from '#main/utils/HubLogger/ModLogs.js';
import { t } from '#main/utils/Locale.js';
import { sendBlacklistNotif } from '#main/utils/moderation/blacklistUtils.js';
import type { ChatInputCommandInteraction, User } from 'discord.js';
import parse from 'parse-duration';
import BlacklistCommand from './index.js';
import { UserInfraction } from '@prisma/client';

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
    const duration = parse(`${interaction.options.getString('duration')}`);
    const expires = duration ? new Date(Date.now() + duration) : null;
    const subcommandGroup = interaction.options.getSubcommandGroup();

    if (subcommandGroup === 'add') {
      const user = interaction.options.getUser('user', true);
      const blacklistManager = new BlacklistManager(new UserInfractionManager(user.id));

      const passedChecks = await this.runUserAddChecks(
        interaction,
        blacklistManager,
        {
          hubId: hub.id,
          userId: user.id,
          duration,
        },
      );

      if (!passedChecks) return;

      await this.addUserBlacklist(interaction, blacklistManager, user, {
        expiresAt: expires,
        hubId: hub.id,
        reason,
      });

      await this.sendSuccessResponse(
        interaction,
        t({ phrase: 'blacklist.success', locale }, { name: user.username, emoji: emojis.tick }),
        { reason, expires },
      );

      // send log to hub's log channel
      await logBlacklist(hub.id, interaction.client, {
        target: user,
        mod: interaction.user,
        reason,
        expiresAt: expires,
      });
    }
    else if (subcommandGroup === 'remove') {
      const userId = interaction.options.getString('user', true);
      const blacklistManager = new BlacklistManager(new UserInfractionManager(userId));

      const result = await this.removeUserBlacklist(interaction, blacklistManager, userId, {
        hubId: hub.id,
        reason,
      });

      if (!result) {
        await this.replyEmbed(
          interaction,
          t({ phrase: 'errors.userNotBlacklisted', locale }, { emoji: emojis.no }),
          { ephemeral: true },
        );
        return;
      }

      const user = await interaction.client.users.fetch(userId).catch(() => null);
      await interaction.followUp(
        t(
          { phrase: 'blacklist.removed', locale },
          { emoji: emojis.delete, name: `${user?.username}` },
        ),
      );
    }
  }

  private async addUserBlacklist(
    interaction: ChatInputCommandInteraction,
    blacklistManager: BlacklistManager<UserInfraction>,
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
    blacklistManager: BlacklistManager<UserInfraction>,
    userId: string,
    opts: { hubId: string; reason: string },
  ) {
    const revoked = await blacklistManager.removeBlacklist(opts.hubId);

    if (revoked) {
      await logUserUnblacklist(interaction.client, opts.hubId, {
        id: userId,
        mod: interaction.user,
        reason: opts.reason,
      });
    }

    return revoked;
  }

  private async runUserAddChecks(
    interaction: ChatInputCommandInteraction,
    blacklistManager: BlacklistManager<UserInfraction>,
    opts: {
      userId: string,
      hubId: string,
      duration?: number
    },
  ) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const hiddenOpt = { ephemeral: true };
    if (opts.userId === interaction.client.user?.id) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'blacklist.user.easterEggs.blacklistBot', locale }),
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
        `${emojis.no} Blacklist duration should be atleast 30 seconds or longer.`,
        hiddenOpt,
      );
      return false;
    }

    const userInBlacklist = await blacklistManager.fetchBlacklist(opts.hubId);
    if (userInBlacklist) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'blacklist.user.alreadyBlacklisted', locale }, { emoji: emojis.no }),
        hiddenOpt,
      );
      return false;
    }
    return true;
  }
}
