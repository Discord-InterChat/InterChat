import Scheduler from '#main/services/SchedulerService.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';
import Constants from '#utils/Constants.js';
import { randomBytes } from 'crypto';
import {
  ActionRow,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
  Message,
  MessageActionRowComponent,
  messageLink,
  Snowflake,
} from 'discord.js';

export const greyOutButton = (row: ActionRowBuilder<ButtonBuilder>, disableElement: number) => {
  row.components.forEach((c) => c.setDisabled(false));
  row.components[disableElement].setDisabled(true);
};
export const greyOutButtons = (rows: ActionRowBuilder<ButtonBuilder>[]) => {
  rows.forEach((row) => row.components.forEach((c) => c.setDisabled(true)));
};

export const generateJumpButton = (
  client: Client,
  referredAuthorUsername: string,
  opts: { messageId: Snowflake; channelId: Snowflake; serverId: Snowflake },
) =>
  // create a jump to reply button
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji(getEmoji('reply', client))
      .setURL(messageLink(opts.channelId, opts.messageId, opts.serverId))
      .setLabel(
        referredAuthorUsername.length >= 80
          ? `@${referredAuthorUsername.slice(0, 76)}...`
          : `@${referredAuthorUsername}`,
      ),
  );

export const disableAllComponents = (
  components: ActionRow<MessageActionRowComponent>[],
  disableLinks = false,
) =>
  components.map((row) => {
    const jsonRow = row.toJSON();
    jsonRow.components.forEach((component) => {
      if (
        !disableLinks &&
        component.type === ComponentType.Button &&
        component.style === ButtonStyle.Link // leave link buttons enabled
      ) {
        component.disabled = false;
      }
      else {
        component.disabled = true;
      }
    });
    return jsonRow;
  });

/**
 *
 * @param scheduler The scheduler to use
 * @param message The message on which to disable components
 * @param time The time in milliseconds after which to disable the components
 */
export const setComponentExpiry = (
  scheduler: Scheduler,
  message: Message,
  time: number | Date,
): string => {
  const timerId = randomBytes(8).toString('hex');
  scheduler.addTask(`disableComponents_${timerId}`, time, async () => {
    const updatedMsg = await message.fetch().catch(() => null);
    if (updatedMsg?.components.length === 0 || !updatedMsg?.editable) return;

    const disabled = disableAllComponents(message.components);
    await updatedMsg.edit({ components: disabled });
  });

  return timerId;
};

export const donateButton = new ButtonBuilder()
  .setLabel('Donate')
  .setURL(`${Constants.Links.Website}/donate`)
  .setEmoji('💗')
  .setStyle(ButtonStyle.Link);
