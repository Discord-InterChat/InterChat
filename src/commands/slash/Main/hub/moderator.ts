import HubManager from '#main/managers/HubManager.js';
import { emojis } from '#utils/Constants.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import type { HubModerator } from '@prisma/client';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import HubCommand from './index.js';

export default class Moderator extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hubName = interaction.options.getString('hub', true);
    const hub = (await this.hubService.findHubsByName(hubName)).at(0);

    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);
    if (!hub || !(await hub.isManager(interaction.user.id))) {
      await this.replyEmbed(interaction, t('hub.notManager', locale, { emoji: emojis.no }), {
        ephemeral: true,
      });
      return;
    }

    const moderators = await hub.moderators.fetchAll();

    const handlers = {
      add: () => this.handleAddSubcommand(interaction, hub, moderators, locale),
      remove: () => this.handleRemoveSubcommand(interaction, hub, moderators, locale),
      edit: () => this.handleEditSubcommand(interaction, hub, moderators, locale),
      list: () => this.handleListSubcommand(interaction, moderators, locale),
    };

    const subcommand = interaction.options.getSubcommand(true) as keyof typeof handlers;
    await handlers[subcommand]?.();
  }

  private async handleRemoveSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: HubManager,
    moderators: HubModerator[],
    locale: supportedLocaleCodes,
  ) {
    const user = interaction.options.getUser('user', true);
    if (!moderators.find((mod) => mod.userId === user.id)) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.remove.notModerator', locale, { user: user.toString(), emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    const mod = moderators.find((m) => m.userId === user.id);
    const isRestrictedAction = mod?.role === 'MANAGER' || user.id === interaction.user.id;

    /* executor needs to be owner to:
     - change position of other managers
     - change their own position
     */
    if (!hub.isOwner(interaction.user.id) && isRestrictedAction) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.remove.notOwner', locale, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    await hub.moderators.remove(user.id);

    await this.replyEmbed(
      interaction,
      t('hub.moderator.remove.success', locale, { user: user.toString(), emoji: emojis.yes }),
    );
  }

  private async handleEditSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: HubManager,
    moderators: HubModerator[],
    locale: supportedLocaleCodes,
  ) {
    const user = interaction.options.getUser('user', true);
    const role = interaction.options.getString('position', true) as HubModerator['role'];
    const isUserMod = moderators.find((mod) => mod.userId === user.id);
    const isExecutorManager = moderators.find(
      (mod) =>
        mod.userId === interaction.user.id && (mod.role === 'MANAGER' || mod.role === 'OWNER'),
    );

    if (!isExecutorManager) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.update.notAllowed', locale, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }
    else if (!isUserMod) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.update.notModerator', locale, { user: user.toString(), emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }
    else if (isUserMod.role === 'MANAGER' && !hub.isOwner(interaction.user.id)) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.update.notOwner', locale, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    await hub.moderators.update(user.id, role);

    await this.replyEmbed(
      interaction,
      t('hub.moderator.update.success', locale, {
        user: user.toString(),
        position: role,
        emoji: emojis.yes,
      }),
    );
  }

  private async handleListSubcommand(
    interaction: ChatInputCommandInteraction,
    moderators: HubModerator[],
    locale: supportedLocaleCodes,
  ) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Hub Moderators')
          .setDescription(
            moderators.length > 0
              ? moderators
                .map(
                  (mod, index) =>
                    `${index + 1}. <@${mod.userId}> - ${
                      mod.role === 'MODERATOR' ? 'Moderator' : 'Hub Manager'
                    }`,
                )
                .join('\n')
              : t('hub.moderator.noModerators', locale, { emoji: emojis.no }),
          )
          .setColor('Aqua')
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }

  private async handleAddSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: HubManager,
    moderators: HubModerator[],
    locale: supportedLocaleCodes,
  ) {
    const user = interaction.options.getUser('user', true);

    if (moderators.find((mod) => mod.userId === user.id)) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.add.alreadyModerator', locale, {
          user: user.toString(),
          emoji: emojis.no,
        }),
        { ephemeral: true },
      );
      return;
    }

    const role = (interaction.options.getString('position') ??
      'NETWORK_MOD') as HubModerator['role'];

    await hub.moderators.add(user.id, role);

    await this.replyEmbed(
      interaction,
      t('hub.moderator.add.success', locale, {
        user: user.toString(),
        position: role,
        emoji: emojis.yes,
      }),
    );
  }
}
