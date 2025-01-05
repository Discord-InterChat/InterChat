import type HubManager from '#main/managers/HubManager.js';

import { type HubModerator, Role } from '@prisma/client';
import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import HubCommand from './index.js';

export default class Moderator extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hubName = interaction.options.getString('hub', true);
    const hub = (await this.hubService.findHubsByName(hubName)).at(0);

    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);
    if (!hub || !(await hub.isManager(interaction.user.id))) {
      await this.replyEmbed(
        interaction,
        t('hub.notManager', locale, { emoji: this.getEmoji('x_icon') }),
        {
          flags: ['Ephemeral'],
        },
      );
      return;
    }

    const handlers = {
      add: () => this.handleAddSubcommand(interaction, hub, locale),
      remove: () => this.handleRemoveSubcommand(interaction, hub, locale),
      edit: () => this.handleEditSubcommand(interaction, hub, locale),
      list: () => this.handleListSubcommand(interaction, hub, locale),
    };

    const subcommand = interaction.options.getSubcommand(true) as keyof typeof handlers;
    await handlers[subcommand]?.();
  }

  private async handleRemoveSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: HubManager,
    locale: supportedLocaleCodes,
  ) {
    const user = interaction.options.getUser('user', true);
    if (!(await hub.isMod(user.id))) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.remove.notModerator', locale, {
          user: user.toString(),
          emoji: this.getEmoji('x_icon'),
        }),
        { flags: ['Ephemeral'] },
      );
      return;
    }

    const mod = await hub.moderators.fetch(user.id);
    const isRestrictedAction = mod?.role === 'MANAGER' || user.id === interaction.user.id;

    /* executor needs to be owner to:
     - change position of other managers
     - change their own position
     */
    if (!hub.isOwner(interaction.user.id) && isRestrictedAction) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.remove.notOwner', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        { flags: ['Ephemeral'] },
      );
      return;
    }

    await hub.moderators.remove(user.id);

    await this.replyEmbed(
      interaction,
      t('hub.moderator.remove.success', locale, {
        user: user.toString(),
        emoji: this.getEmoji('tick_icon'),
      }),
    );
  }

  private async handleEditSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: HubManager,
    locale: supportedLocaleCodes,
  ) {
    const user = interaction.options.getUser('user', true);
    const role = interaction.options.getString('position', true) as HubModerator['role'];
    const userPosition = await hub.moderators.fetch(user.id);

    if (!(await hub.isManager(interaction.user.id))) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.update.notAllowed', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        { flags: ['Ephemeral'] },
      );
      return;
    }
    if (!userPosition) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.update.notModerator', locale, {
          user: user.toString(),
          emoji: this.getEmoji('x_icon'),
        }),
        { flags: ['Ephemeral'] },
      );
      return;
    }
    if (userPosition.role === 'MANAGER' && !hub.isOwner(interaction.user.id)) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.update.notOwner', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
        { flags: ['Ephemeral'] },
      );
      return;
    }

    await hub.moderators.update(user.id, role);

    await this.replyEmbed(
      interaction,
      t('hub.moderator.update.success', locale, {
        user: user.toString(),
        position: role,
        emoji: this.getEmoji('tick_icon'),
      }),
    );
  }

  private async handleListSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: HubManager,
    locale: supportedLocaleCodes,
  ) {
    const moderators = await hub.moderators.fetchAll();
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Hub Moderators')
          .setDescription(
            moderators.size > 0
              ? moderators
                .map(
                  (mod, index) =>
                    `${index + 1}. <@${mod.userId}> - ${
                      mod.role === Role.MODERATOR ? 'Moderator' : 'Hub Manager'
                    }`,
                )
                .join('\n')
              : t('hub.moderator.noModerators', locale, {
                emoji: this.getEmoji('x_icon'),
              }),
          )
          .setColor('Aqua')
          .setTimestamp(),
      ],
      flags: ['Ephemeral'],
    });
  }

  private async handleAddSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: HubManager,
    locale: supportedLocaleCodes,
  ) {
    const user = interaction.options.getUser('user', true);

    if (await hub.isMod(user.id)) {
      await this.replyEmbed(
        interaction,
        t('hub.moderator.add.alreadyModerator', locale, {
          user: user.toString(),
          emoji: this.getEmoji('x_icon'),
        }),
        { flags: ['Ephemeral'] },
      );
      return;
    }

    const role = (interaction.options.getString('position') ??
      Role.MODERATOR) as HubModerator['role'];

    await hub.moderators.add(user.id, role);

    await this.replyEmbed(
      interaction,
      t('hub.moderator.add.success', locale, {
        user: user.toString(),
        position: role,
        emoji: this.getEmoji('tick_icon'),
      }),
    );
  }
}
