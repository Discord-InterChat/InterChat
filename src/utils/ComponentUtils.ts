import { getEmoji } from '#src/utils/EmojiUtils.js';
import Constants from '#utils/Constants.js';
import {
  type ActionRow,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  ComponentType,
  type MessageActionRowComponent,
  type Snowflake,
  messageLink,
} from 'discord.js';

export const greyOutButton = (row: ActionRowBuilder<ButtonBuilder>, disableElement: number) => {
  row.components.forEach((c) => c.setDisabled(false));
  row.components[disableElement].setDisabled(true);
};
export const greyOutButtons = (rows: ActionRowBuilder<ButtonBuilder>[]) => {
  for (const row of rows) {
    row.components.forEach((c) => c.setDisabled(true));
  }
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
    for (const component of jsonRow.components) {
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
    }

    return jsonRow;
  });

export const donateButton = new ButtonBuilder()
  .setLabel('Donate')
  .setURL(`${Constants.Links.Website}/donate`)
  .setEmoji('💗')
  .setStyle(ButtonStyle.Link);
