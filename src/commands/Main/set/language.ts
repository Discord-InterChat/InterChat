import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import UserDbService from '#src/services/UserDbService.js';
import { fetchUserLocale } from '#src/utils/Utils.js';
import {
  type supportedLocaleCodes,
  supportedLocales,
  t,
} from '#utils/Locale.js';
import {
  ApplicationCommandOptionType,
} from 'discord.js';

const currSupportedLangs = ['en', 'hi', 'es'] as const;

export default class SetLanguage extends BaseCommand {
  constructor() {
    super({
      name: 'language',
      description: '🈂️ Set the language in which I should respond to you',
      types: { slash: true },
      options: [
        {
          name: 'lang',
          description: 'The language to set',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: currSupportedLangs.map((l) => ({
            name: supportedLocales[l].name,
            value: l,
          })),
        },
      ],
    });
  }

  async execute(ctx: Context) {
    const locale = ctx.options.getString('lang') as supportedLocaleCodes | undefined;

    if (!locale || !Object.keys(supportedLocales).includes(locale)) {
      await ctx.reply({
        content: t(
          'errors.invalidLangCode',
          await fetchUserLocale(ctx.user.id),
          {
            emoji: ctx.getEmoji('info'),
          },
        ),
        flags: ['Ephemeral'],
      });
      return;
    }

    const { id, username } = ctx.user;
    const userService = new UserDbService();
    await userService.upsertUser(id, { locale, username });

    const langInfo = supportedLocales[locale];
    const lang = `${langInfo.emoji} ${langInfo.name}`;

    await ctx.reply({
      content: ctx.getEmoji('tick_icon') + t('language.set', locale, { lang }),
      flags: ['Ephemeral'],
    });
  }
}
