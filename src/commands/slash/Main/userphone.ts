import {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '../../../core/BaseCommand.js';
import db from '../../../utils/Db.js';
import { emojis } from '../../../utils/Constants.js';

export default class Userphone extends BaseCommand {
  readonly cooldown = 5000;
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'userphone',
    description: 'Start a userphone conversation.',
  };
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await db.userPhone.create({
      data: {
        channelId: interaction.channelId,
        userId: interaction.user.id,
        waitingSince: new Date(),
      },
    });
    await interaction.reply({
      content: `${emojis.connect_icon} Calling the other side...`,
    });

    // const userPhoneEntry = await db.userPhone.findFirst({
    //   where: { occupiedWith: { isSet: true } },
    //   orderBy: { waitingSince: 'desc' },
    // });

    // if (!userPhoneEntry) {
    //   await wait(5000);
    //   return this.execute(interaction);
    // }
  }
}
