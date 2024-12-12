import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { HubJoinService } from '#main/services/HubJoinService.js';
import Constants, { emojis } from '#main/utils/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  InteractionContextType,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

export default class SetupCommand extends BaseCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'setup',
    description: 'Setup the bot for the server',
    contexts: [InteractionContextType.Guild],
    options: [
      {
        name: 'channel',
        description: 'The channel to setup the bot in',
        type: ApplicationCommandOptionType.Channel,
        channel_types: [ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread],
        required: true,
      },
    ],
  };

  public async execute(interaction: ChatInputCommandInteraction) {
    const embed = new InfoEmbed().setDescription(
      stripIndents`
        ## ${emojis.guide_icon} Interchat Setup - Let\'s get started!
        Let's get started with setting up a connection to a hub from a channel in this server. 
        ### Hub?
        A **hub** is a **group**—where servers connect to, to chat together. Once you setup the bot in a channel, messages to and from that channel will go to other servers in that hub.
        ## Choose a Hub
        1. Click **Official Hub** to join the official InterChat hub. (Recommended)
        2. Or click **Random Hub** to join to a random community hub! 

        You and this server are expected to follow the [guidelines](${Constants.Links.Website}/guidelines) when chatting. We hope you enjoy your time on InterChat. 🎉
        `,
    );

    const channel = interaction.options.getChannel('channel', true, [
      ChannelType.GuildText,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
    ]);
    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            new CustomID('setupHub:official', [interaction.user.id, channel.id]).toString(),
          )
          .setLabel('Official Hub')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(
            new CustomID('setupHub:random', [interaction.user.id, channel.id]).toString(),
          )
          .setLabel('Random Hub')
          .setStyle(ButtonStyle.Secondary),
      ),
    ];

    await interaction.reply({ embeds: [embed], components });
  }

  @RegisterInteractionHandler('setupHub')
  public async handleHubSetupButton(interaction: ButtonInteraction) {
    if (!interaction.inCachedGuild()) return;

    const hubJoinService = new HubJoinService(interaction, await this.getLocale(interaction));
    const customId = CustomID.parseCustomId(interaction.customId);
    const [userId, channelId] = customId.args;

    if (interaction.user.id !== userId) {
      await interaction.reply({ content: 'This button is not for you.', ephemeral: true });
      return;
    }

    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      await interaction.reply({ content: 'The channel does not exist.', ephemeral: true });
      return;
    }

    if (!interaction.member.permissionsIn(channel).has('ManageMessages', true)) {
      await interaction.reply({
        content:
          'You cannot setup the bot in a channel where you do not have `Manage Messages` permission.',
        ephemeral: true,
      });
      return;
    }

    let joinSuccess = false;

    if (customId.suffix === 'official') {
      // NOTE: if hub name ever changes, this will need to be updated
      joinSuccess = await hubJoinService.joinHub(channel, 'InterChat Central');
    }
    else if (customId.suffix === 'random') {
      joinSuccess = await hubJoinService.joinRandomHub(channel);
    }

    if (!joinSuccess) return;

    const embed1 = new InfoEmbed().setDescription(stripIndents`
      ## ${emojis.yes} Setup Complete!
      The bot has been setup in ${channel.toString()}. You can now chat with other servers from this channel. 🎉 
    `);

    const embed2 = new InfoEmbed().setDescription(stripIndents`
      You can also setup the bot in other channels with a different hub using \`/hub join\`. Pick a hub of your own choosing from a wide list of [public hubs](${Constants.Links.Website}/hubs) made by the community.
    `);

    const finalEmbed = new InfoEmbed().setDescription(stripIndents`
      If you have any questions or need help, feel free to ask in the [support server](${Constants.Links.SupportInvite}). We also have a [Documentation](${Constants.Links.Website}/docs) page for more information.

      Enjoy your time on InterChat! 🎉
    `);

    await interaction.followUp({ embeds: [embed1, embed2, finalEmbed], ephemeral: true });
  }
}
