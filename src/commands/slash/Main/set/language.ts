import { ChatInputCommandInteraction } from 'discord.js';
import { emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { supportedLocaleCodes, supportedLocales, t } from '#main/utils/Locale.js';
import Set from './index.js';

export default class SetLanguage extends Set {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = interaction.options.getString('lang', true) as supportedLocaleCodes;

    if (!Object.keys(supportedLocales).includes(locale)) {
      await interaction.reply({
        content: t(
          { phrase: 'errors.invalidLangCode', locale: await interaction.client.userManager.getUserLocale(interaction.user.id) },
          { emoji: emojis.info },
        ),
        ephemeral: true,
      });
      return;
    }

    const { id, username } = interaction.user;
    await db.userData.upsert({
      where: { id },
      create: { id, locale, username },
      update: { locale },
    });

    const langInfo = supportedLocales[locale];
    const lang = `${langInfo.emoji} ${langInfo.name}`;

    await interaction.reply({
      content: emojis.yes + t({ phrase: 'language.set', locale }, { lang }),
      ephemeral: true,
    });
  }
}
