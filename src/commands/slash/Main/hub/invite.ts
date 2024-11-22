import { handleError } from '#main/utils/Utils.js';
import Constants, { emojis } from '#utils/Constants.js';
import db from '#utils/Db.js';
import { supportedLocaleCodes, t } from '#utils/Locale.js';
import { CacheType, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import ms from 'ms';
import HubCommand from './index.js';
import { HubService } from '#main/services/HubService.js';
import { isHubManager } from '#main/utils/hub/utils.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';

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

    const hubService = new HubService(db);
    const hubInDb = await hubService.getHubByName(hubName);

    if (!hubInDb) {
      await this.replyEmbed(interaction, 'hub.notFound_mod', {
        t: { emoji: emojis.no },
        ephemeral: true,
      });
      return;
    }
    else if (!hubInDb?.private) {
      await this.replyEmbed(interaction, 'hub.notPrivate', {
        t: { emoji: emojis.no },
        ephemeral: true,
      });
      return;
    }

    if (!isHubManager(interaction.user.id, hubInDb)) {
      await this.replyEmbed(interaction, 'hub.notManager', {
        t: { emoji: emojis.no },
        ephemeral: true,
      });
      return;
    }

    if (!Date.parse(expires.toString())) {
      await interaction.reply({
        content: `${emojis.no} Invalid Expiry Duration provided!`,
        ephemeral: true,
      });
      return;
    }

    const createdInvite = await db.hubInvite.create({
      data: {
        hub: { connect: { name: hubName } },
        expires,
      },
    });

    const embed = new EmbedBuilder()
      .setDescription(
        t('hub.invite.create.success', locale, {
          inviteCode: createdInvite.code,
          docs_link: Constants.Links.Docs,
          expiry: `<t:${Math.round(createdInvite.expires.getTime() / 1000)}:R>`,
        }),
      )
      .setColor('Green')
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
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
            { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
          ],
        },
      },
    });

    if (!inviteInDb) {
      await interaction.reply({
        content: t('hub.invite.revoke.invalidCode', locale, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    try {
      await db.hubInvite.delete({ where: { code } });
      await this.replyEmbed(
        interaction,
        t('hub.invite.revoke.success', locale, { emoji: emojis.yes, inviteCode: code }),
        { ephemeral: true },
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
    const hubInDb = await db.hub.findFirst({
      where: {
        name: hubName,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
        ],
      },
    });

    if (!hubInDb?.private) {
      await this.replyEmbed(
        interaction,
        t('hub.invite.list.notPrivate', locale, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    const invitesInDb = await db.hubInvite.findMany({ where: { hubId: hubInDb.id } });
    if (invitesInDb.length === 0) {
      await this.replyEmbed(
        interaction,
        t('hub.invite.list.noInvites', locale, { emoji: emojis.no }),
        { ephemeral: true },
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
      ephemeral: true,
    });
  }
}
