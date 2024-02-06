import { ChatInputCommandInteraction } from 'discord.js';
import db from '../../../../utils/Db.js';
import { emojis } from '../../../../utils/Constants.js';
import { supportedLocaleCodes, supportedLocales, t } from '../../../../utils/Locale.js';
import Set from './index.js';

export default class SetLanguage extends Set {
  async execute(interaction: ChatInputCommandInteraction) {
    const locale = interaction.options.getString('lang', true) as supportedLocaleCodes;

    if (!Object.keys(supportedLocales).includes(locale)) {
      return await interaction.reply({
        content: t(
          { phrase: 'errors.invalidLangCode', locale: interaction.user.locale },
          { emoji: emojis.info },
        ),
        ephemeral: true,
      });
    }

    const { id: userId, username } = interaction.user;
    await db.userData.upsert({
      where: { userId: interaction.user.id },
      create: { userId, locale, username },
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
