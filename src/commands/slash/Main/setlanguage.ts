import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '../../BaseCommand.js';
import db from '../../../utils/Db.js';
import { emojis } from '../../../utils/Constants.js';

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
    const language = interaction.options.getString('lang', true);
    await db.userData.upsert({
      where: { userId: interaction.user.id },
      create: {
        userId: interaction.user.id,
        locale: language,
        username: interaction.user.username,
      },
      update: {
        locale: language,
      },
    });

    await interaction.reply({
      content: `${emojis.yes} Language set! I will now respond to you in **${
        language === 'en' ? '🇺🇸 English' : '🇹🇷 Turkish'
      }**.`,
      ephemeral: true,
    });
  }
}
