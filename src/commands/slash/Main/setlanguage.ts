import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '../../BaseCommand.js';
import db from '../../../utils/Db.js';
import { emojis } from '../../../utils/Constants.js';
import { t } from '../../../utils/Locale.js';

export default class SetLanguage extends BaseCommand {
  data: RESTPostAPIApplicationCommandsJSONBody = {
    name: 'setlanguage',
    description: 'Set my language for when I respond to you',
    options: [
      {
        name: 'lang',
        description: 'The language to set',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: '🇺🇸 English', value: 'en' },
          { name: '🇹🇷 Turkish', value: 'tr' },
        ],
      },
    ],
  };

  async execute(interaction: ChatInputCommandInteraction) {
    const locale = interaction.options.getString('lang', true);
    await db.userData.upsert({
      where: { userId: interaction.user.id },
      create: {
        userId: interaction.user.id,
        locale,
        username: interaction.user.username,
      },
      update: {
        locale,
      },
    });

    const lang = locale === 'en' ? '🇺🇸 English' : '🇹🇷 Turkish';

    await interaction.reply({
      content: emojis.yes + t({ phrase: 'language.set', locale }, { lang }),
      ephemeral: true,
    });
  }
}
