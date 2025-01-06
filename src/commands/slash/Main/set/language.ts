import type { ChatInputCommandInteraction } from 'discord.js';
import { type supportedLocaleCodes, supportedLocales, t } from '#utils/Locale.js';
import SetCommand from './index.js';
import UserDbService from '#main/services/UserDbService.js';
import { fetchUserLocale } from '#main/utils/Utils.js';

export default class SetLanguage extends SetCommand {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = interaction.options.getString('lang', true) as supportedLocaleCodes;

    if (!Object.keys(supportedLocales).includes(locale)) {
      await interaction.reply({
        content: t('errors.invalidLangCode', await fetchUserLocale(interaction.user.id), {
          emoji: this.getEmoji('info'),
        }),
        flags: ['Ephemeral'],
      });
      return;
    }

    const { id, username } = interaction.user;
    const userService = new UserDbService();
    await userService.upsertUser(id, { locale, username });

    const langInfo = supportedLocales[locale];
    const lang = `${langInfo.emoji} ${langInfo.name}`;

    await interaction.reply({
      content: this.getEmoji('tick_icon') + t('language.set', locale, { lang }),
      flags: ['Ephemeral'],
    });
  }
}
