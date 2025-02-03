import ms from 'ms';
import { ErrorEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';
import { fetchUserLocale } from '#src/utils/Utils.js';
import type Context from '#src/core/CommandContext/Context.js';
import BaseCommand from '#src/core/BaseCommand.js';
import { HubService } from '#src/services/HubService.js';
import {
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
} from 'discord.js';
import HubCommand, { hubOption } from '#src/commands/Main/hub/index.js';

export default class AppealCooldownCommand extends BaseCommand {
  private hubService = new HubService();

  constructor() {
    super({
      name: 'set_cooldown',
      description:
				'⌛ Set the duration a user must wait before appealing a blacklist again.',
      types: { slash: true, prefix: true },
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'cooldown',
          description: 'The duration. Eg. 1h, 1d, 1w, 1mo',
          required: true,
        },
        { ...hubOption },
      ],
    });
  }
  public async execute(ctx: Context) {
    const hubName = ctx.options.getString('hub', true);

    const hub = (await this.hubService.findHubsByName(hubName)).at(0);

    if (!hub || !(await hub.isMod(ctx.user.id))) {
      await ctx.replyEmbed(
        t('hub.notFound_mod', await fetchUserLocale(ctx.user.id), {
          emoji: ctx.getEmoji('x_icon'),
        }),
        { flags: ['Ephemeral'] },
      );
      return;
    }

    const cooldown = ctx.options.getString('cooldown');
    if (!cooldown) {
      const embed = new ErrorEmbed(ctx.client).setDescription(
        'Please provide a valid cooldown duration.',
      );
      await ctx.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }

    const appealCooldownHours = ms(cooldown as ms.StringValue) / 1000 / 60 / 60;
    if (!appealCooldownHours || appealCooldownHours < 1) {
      const embed = new ErrorEmbed(ctx.client).setDescription(
        'Cooldown must be atleast **1 hour** long.',
      );
      await ctx.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }
    if (appealCooldownHours > 8766) {
      const embed = new ErrorEmbed(ctx.client).setDescription(
        'Cooldown cannot be longer than **1 year**.',
      );
      await ctx.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }

    await hub.update({ appealCooldownHours });

    await ctx.reply({
      content: `${ctx.getEmoji('clock_icon')} Appeal cooldown has been set to **${appealCooldownHours}** hour(s).`,
      flags: ['Ephemeral'],
    });
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    return await HubCommand.handleManagerCmdAutocomplete(interaction, this.hubService);
  }
}
