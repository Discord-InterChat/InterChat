import { emojis } from '#main/utils/Constants.js';
import { logBlacklist } from '#main/utils/HubLogger/ModLogs.js';
import { t } from '#main/utils/Locale.js';
import Logger from '#main/utils/Logger.js';
import type { ChatInputCommandInteraction, User } from 'discord.js';
import parse from 'parse-duration';
import BlacklistCommand from './index.js';

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
      const passedChecks = await this.runUserAddChecks(interaction, hub.id, user.id, {
        duration,
      });

      if (!passedChecks) return;

      await this.addUserBlacklist(interaction, user, { expires, hubId: hub.id, reason });
      await this.sendSuccessResponse(
        interaction,
        t(
          { phrase: 'blacklist.user.success', locale },
          { username: user.username, emoji: emojis.tick },
        ),
        { reason, expires },
      );

      // send log to hub's log channel
      await logBlacklist(hub.id, interaction.client, {
        target: user,
        mod: interaction.user,
        reason,
        expires,
      });
    }
    else if (subcommandGroup === 'remove') {
      const userId = interaction.options.getString('user', true);
      const result = await userManager.removeBlacklist(hub.id, userId);

      if (!result) {
        await this.replyEmbed(
          interaction,
          t({ phrase: 'errors.userNotBlacklisted', locale }, { emoji: emojis.no }),
          { ephemeral: true },
        );
        return;
      }

      await interaction.followUp(
        t(
          { phrase: 'blacklist.user.removed', locale },
          { emoji: emojis.delete, username: `${result.username}` },
        ),
      );

      await userManager.logUnblacklist(hub.id, userId, { mod: interaction.user, reason });
    }
  }

  private async addUserBlacklist(
    interaction: ChatInputCommandInteraction,
    user: User,
    { expires, hubId, reason }: { expires: Date | null; reason: string; hubId: string },
  ) {
    const { userManager } = interaction.client;
    await userManager.addBlacklist({ id: user.id, name: user.username }, hubId, {
      reason,
      moderatorId: interaction.user.id,
      expires,
    });

    await userManager
      .sendNotification({ target: user, hubId, expires, reason })
      .catch(Logger.error);
  }

  private async runUserAddChecks(
    interaction: ChatInputCommandInteraction,
    hubId: string,
    userId: string,
    opts?: { duration?: number },
  ) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const hiddenOpt = { ephemeral: true };
    if (userId === interaction.client.user?.id) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'blacklist.user.easterEggs.blacklistBot', locale }),
        hiddenOpt,
      );
      return false;
    }
    else if (userId === interaction.user.id) {
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

    const userInBlacklist = await interaction.client.userManager.fetchBlacklist(hubId, userId);
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
