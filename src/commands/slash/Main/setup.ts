import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { HubJoinService } from '#main/services/HubJoinService.js';
import Constants from '#main/utils/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';

export default class SetupCommand extends BaseCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'setup',
    description: 'Setup InterChat for a channel in this server.',
    contexts: [InteractionContextType.Guild],
    options: [
      {
        name: 'channel',
        description: 'The channel to setup InterChat in.',
        type: ApplicationCommandOptionType.Channel,
        channel_types: [ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread],
        required: true,
      },
    ],
  };

  public async execute(interaction: ChatInputCommandInteraction) {
    const embed = new InfoEmbed().setDescription(
      stripIndents`
        ## ${this.getEmoji('wiki_icon')} Interchat Setup - Let\'s get started!
        Let's get started with setting up a connection to a hub from a channel in this server. 
        ### Hub?
        A **hub** is a **group**—where servers connect to, to chat together. Once you setup the bot in a channel, messages to and from that channel will go to other servers in that hub.
        ## Choose a Hub
        1. Click **Official Hub** to join the official InterChat hub. (Recommended)
        2. Or click **Random Hub** to join to a random community hub! 🎲
        3. Once you join a hub, you can start chatting with people from other servers in real-time. Do note that messages sent in the channel will be broadcasted to all servers in the hub.

        There are many other public hubs you can join from the [website](${Constants.Links.Website}/hubs). You and this server are expected to follow the [guidelines](${Constants.Links.Website}/guidelines) when chatting. We hope you enjoy your time on InterChat. 🎉
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
      await interaction.reply({
        content: 'This button is not for you.',
        flags: ['Ephemeral'],
      });
      return;
    }

    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      await interaction.reply({
        content: 'The channel does not exist.',
        flags: ['Ephemeral'],
      });
      return;
    }

    if (!interaction.member.permissionsIn(channel).has('ManageMessages', true)) {
      await interaction.reply({
        content:
          'You cannot setup InterChat in a channel where you do not have `Manage Messages` permission.',
        flags: ['Ephemeral'],
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
      ## ${this.getEmoji('tick_icon')} Setup Complete!
      InterChat has been setup in ${channel.toString()}! You can now chat with other servers from this channel. **Do note that messages sent in ${channel} channel will be broadcasted to all servers in the hub.**
    `);

    const embed2 = new InfoEmbed().setDescription(stripIndents`
      You can also setup InterChat in other channels with different hubs using \`/hub join\`. Pick a hub of your own choosing from a wide list of [public hubs](${Constants.Links.Website}/hubs) made by the community.
    `);

    const finalEmbed = new InfoEmbed().setDescription(stripIndents`
      If you have any questions or need help, feel free to ask in the [support server](${Constants.Links.SupportInvite}). If you enjoy using InterChat, consider [donating](${Constants.Links.Donate}) to support the project.

      We hope you enjoy your time on InterChat! 🎉
    `);

    await interaction.followUp({
      embeds: [embed1, embed2, finalEmbed],
      flags: ['Ephemeral'],
    });
  }
}
