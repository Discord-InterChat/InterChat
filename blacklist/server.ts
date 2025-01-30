import BlacklistManager from '#src/managers/BlacklistManager.js';

import type { ChatInputCommandInteraction, Snowflake } from 'discord.js';
import ms from 'ms';
import { deleteConnections } from '#utils/ConnectedListUtils.js';
import { t } from '#utils/Locale.js';
import { logServerUnblacklist } from '#utils/hub/logger/ModLogs.js';
import { sendBlacklistNotif } from '#utils/moderation/blacklistUtils.js';
import BlacklistCommand from './index.js';
import { fetchUserLocale } from '#src/utils/Utils.js';

export default class extends BlacklistCommand {
  async execute(ctx: Context) {
    await interaction.deferReply();

    const { id: moderatorId } = interaction.user;
    const locale = await fetchUserLocale(interaction.user.id);

    const hubName = interaction.options.getString('hub');
    const hub = await this.getHub({ name: hubName, userId: moderatorId });
    if (!this.isValidHub(interaction, hub, locale)) return;

    const subCommandGroup = interaction.options.getSubcommandGroup();
    const serverId = interaction.options.getString('server', true);

    const blacklistManager = new BlacklistManager('server', serverId);

    if (subCommandGroup === 'add') {
      const reason = interaction.options.getString('reason', true);
      const duration = ms(`${interaction.options.getString('duration')}`);
      const expires = duration ? new Date(Date.now() + duration) : null;

      const checksPassed = await this.runAddChecks(interaction, hub.id, serverId, { duration });
      if (!checksPassed) return;

      const server = await interaction.client.fetchGuild(serverId).catch(() => null);
      if (!server) {
        await interaction.followUp(
          t('errors.unknownServer', locale, { emoji: this.getEmoji('x_icon') }),
        );
        return;
      }

      await blacklistManager.addBlacklist({
        reason,
        expiresAt: expires,
        moderatorId,
        serverName: server.name,
        hubId: hub.id,
      });

      await sendBlacklistNotif('server', interaction.client, {
        target: { id: serverId },
        hubId: hub.id,
        expiresAt: expires,
        reason,
      });

      await this.sendSuccessResponse(
        interaction,
        t('blacklist.success', locale, {
          name: server.name,
          emoji: this.getEmoji('tick'),
        }),
        { reason, expires },
      );

      // delete all connections from db so they can't reconnect to the hub
      await deleteConnections({ serverId, hubId: hub.id });

      // send log to hub's log channel
      await blacklistManager.log(hub.id, interaction.client, {
        reason,
        mod: interaction.user,
        expiresAt: expires,
      });
    }
    else if (subCommandGroup === 'remove') {
      const result = await blacklistManager.removeBlacklist(hub.id);

      if (!result || !BlacklistManager.isServerBlacklist(result)) {
        await ctx.replyEmbed(
          interaction,
          t('errors.serverNotBlacklisted', locale, {
            emoji: this.getEmoji('x_icon'),
          }),
        );
        return;
      }

      // Using name from DB since the bot can't access server through API.
      await ctx.replyEmbed(
        interaction,
        t('blacklist.removed', locale, {
          emoji: this.getEmoji('delete'),
          name: result.serverName ?? 'Unknown Server.',
        }),
      );

      // send log to hub's log channel
      await logServerUnblacklist(interaction.client, hub, {
        id: serverId,
        mod: interaction.user,
      });
    }
  }
  private async runAddChecks(
    interaction: ChatInputCommandInteraction,
    hubId: string,
    serverId: Snowflake,
    opts: { duration?: number },
  ) {
    const blacklistManager = new BlacklistManager('server', serverId);
    const blacklist = await blacklistManager.fetchBlacklist(hubId);
    const hiddenOpt = { flags: ['Ephemeral'] } as const;

    if (blacklist) {
      await ctx.replyEmbed(
        interaction,
        t('blacklist.server.alreadyBlacklisted', 'en', {
          emoji: this.getEmoji('x_icon'),
        }),
        hiddenOpt,
      );
      return false;
    }
    if (opts?.duration && opts.duration < 30_000) {
      await ctx.replyEmbed(
        interaction,
        `${this.getEmoji('x_icon')} Blacklist duration should be atleast 30 seconds or longer.`,
        hiddenOpt,
      );
      return false;
    }
    return true;
  }
}
