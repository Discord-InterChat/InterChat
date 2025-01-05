import { type CacheType, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import ms from 'ms';
import { HubService } from '#main/services/HubService.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { handleError } from '#main/utils/Utils.js';
import db from '#utils/Db.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import HubCommand from './index.js';

export default class Invite extends HubCommand {
  readonly cooldown = 3000; // 3 seconds

  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const handlers = {
      create: () => this.handleCreateSubcommand(interaction, locale),
      revoke: () => this.handleRevokeSubcommand(interaction, locale),
      list: () => this.handleListSubcommand(interaction, locale),
    };

    const subcommand = interaction.options.getSubcommand() as keyof typeof handlers;
    await handlers[subcommand]?.();
  }

  private async handleCreateSubcommand(
    interaction: ChatInputCommandInteraction,
    locale: supportedLocaleCodes,
  ) {
    const hubName = interaction.options.getString('hub', true);
    const expiryStr = interaction.options.getString('expiry');
    const duration = expiryStr ? ms(expiryStr) : undefined;
    const expires = new Date(Date.now() + (duration || 60 * 60 * 4000));

    const hubService = new HubService();
    const hub = await (await hubService.findHubsByName(hubName)).at(0);

    if (!hub) {
      await this.replyEmbed(interaction, 'hub.notFound_mod', {
        t: { emoji: this.getEmoji('x_icon') },
        flags: 'Ephemeral',
      });
      return;
    }
    if (!hub?.data.private) {
      await this.replyEmbed(interaction, 'hub.notPrivate', {
        t: { emoji: this.getEmoji('x_icon') },
        flags: 'Ephemeral',
      });
      return;
    }

    if (!(await hub.isManager(interaction.user.id))) {
      await this.replyEmbed(interaction, 'hub.notManager', {
        t: { emoji: this.getEmoji('x_icon') },
        flags: 'Ephemeral',
      });
      return;
    }

    if (!Date.parse(expires.toString())) {
      await interaction.reply({
        content: `${this.getEmoji('x_icon')} Invalid Expiry Duration provided!`,
        flags: 'Ephemeral',
      });
      return;
    }

    const createdInvite = await hub.createInvite(expires);

    const embed = new EmbedBuilder()
      .setDescription(
        t('hub.invite.create.success', locale, {
          inviteCode: createdInvite.code,
          expiry: `<t:${Math.round(createdInvite.expires.getTime() / 1000)}:R>`,
        }),
      )
      .setColor('Green')
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: 'Ephemeral',
    });
  }

  private async handleRevokeSubcommand(
    interaction: ChatInputCommandInteraction,
    locale: supportedLocaleCodes,
  ) {
    const code = interaction.options.getString('code', true);

    const inviteInDb = await db.hubInvite.findFirst({
      where: {
        code,
        hub: {
          OR: [
            { ownerId: interaction.user.id },
            {
              moderators: {
                some: { userId: interaction.user.id, role: 'MANAGER' },
              },
            },
          ],
        },
      },
    });

    if (!inviteInDb) {
      await interaction.reply({
        content: t('hub.invite.revoke.invalidCode', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        flags: 'Ephemeral',
      });
      return;
    }

    try {
      await db.hubInvite.delete({ where: { code } });
      await this.replyEmbed(
        interaction,
        t('hub.invite.revoke.success', locale, {
          emoji: this.getEmoji('tick_icon'),
          inviteCode: code,
        }),
        { flags: ['Ephemeral'] },
      );
    }
    catch (e) {
      handleError(e, interaction);
      return;
    }
  }

  private async handleListSubcommand(
    interaction: ChatInputCommandInteraction,
    locale: supportedLocaleCodes,
  ) {
    const hubName = interaction.options.getString('hub', true);

    const hub = (await this.hubService.findHubsByName(hubName)).at(0);

    if (!(await hub?.isManager(interaction.user.id))) {
      await this.replyEmbed(
        interaction,
        t('hub.notManager', locale, { emoji: this.getEmoji('x_icon') }),
        { flags: ['Ephemeral'] },
      );
      return;
    }

    if (!hub?.data.private) {
      await this.replyEmbed(
        interaction,
        t('hub.invite.list.notPrivate', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        { flags: ['Ephemeral'] },
      );
      return;
    }

    const invitesInDb = await hub.fetchInvites();
    if (invitesInDb.length === 0) {
      await this.replyEmbed(
        interaction,
        t('hub.invite.list.noInvites', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        { flags: ['Ephemeral'] },
      );
      return;
    }

    const inviteArr = invitesInDb.map(
      (inv, index) =>
        `${index + 1}. \`${inv.code}\` - <t:${Math.round(inv.expires.getTime() / 1000)}:R>`,
    );

    const inviteEmbed = new InfoEmbed()
      .setTitle(t('hub.invite.list.title', locale))
      .setDescription(inviteArr.join('\n'));

    await interaction.reply({
      embeds: [inviteEmbed],
      flags: 'Ephemeral',
    });
  }
}
