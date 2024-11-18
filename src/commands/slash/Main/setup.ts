import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { Pagination } from '#main/modules/Pagination.js';
import { HubJoinService } from '#main/services/HubJoinService.js';
import Constants from '#main/utils/Constants.js';
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
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

export default class SetupCommand extends BaseCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'setup',
    description: 'Setup the bot for the server',
    options: [
      {
        name: 'interchat',
        description: 'The channel to setup the bot in',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'channel',
            description: 'The channel to setup the bot in',
            type: ApplicationCommandOptionType.Channel,
            channel_types: [
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
            ],
            required: true,
          },
        ],
      },
      {
        name: 'lobby',
        description: 'Learn how to use our userphone-like lobby chat system.',
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
  };

  public async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand(true);
    if (subcommand === 'lobby') await this.setupLobby(interaction);
    else if (subcommand === 'interchat') await this.setupHub(interaction);
  }

  private async setupLobby(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new InfoEmbed().setTitle('Lobby Setup').setDescription(stripIndents`
        The lobby is a userphone-like chat system where you can chat with random people. What makes it different from other userphone bots is that you can have upto 3 servers in a lobby at once.
        ### How to setup:
        1. Type \`c!connect\` or \`c!call\`. 
        2. Wait for someone to to join.
        3. Have fun! 🎉
        ### Want something more? 
        Try out our multi-server hub chatting using </setup interchat:1305504885315207259>

        -# Note: You are expected to follow our [guidelines](${Constants.Links.Website}/guidelines). If you are found breaking the guidelines, you will be banned from using the bot.
      `);

    await interaction.reply({ embeds: [embed] });
  }

  private async setupHub(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;

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

    const embed1 = new InfoEmbed().setTitle('Interchat Setup - Let\'s get started!').setDescription(
      stripIndents`
        A **hub** is a group of servers that you can chat with. It can contain unlimited servers and lets you chat without disconnecting.
 
        After this setup, you will be able to talk with people that are part of your chosen hub from ${channel}.
        `,
    );
    const setupEmbed = new InfoEmbed().setDescription(stripIndents`
            ### Setup:
            1. Click **Official Hub** to connect to a hub moderated by InterChat staff.
            2. Or click **Random Hub** to connect to a random community owned hub. 

            You are expected to follow the [guidelines](${Constants.Links.Website}/guidelines) when chatting. If you are found breaking the guidelines, you will be banned from using the bot. Have fun! 🎉
          `);

    const finalEmbed = new InfoEmbed().setDescription(stripIndents`
          ### Finally:
          - Search for community hubs by category here: ${Constants.Links.Website}/hubs
          - Create your own hub using \`/hub create\`.
          - Join a hub by name or invite by using \`/hub join\`.
          - Leave a hub using \`/hub leave\`.
          - Use our userphone-like lobby chat using \`/setup lobby\`.

          Thats it! We hope you enjoy your time on InterChat. 
          -# Need help? Join our [support server](${Constants.Links.SupportInvite}).
        `);

    await new Pagination({ hideButtons: { search: true, exit: true, select: true } })
      .addPages([
        { embeds: [embed1] },
        { embeds: [setupEmbed], components },
        { embeds: [finalEmbed], components: [] },
      ])
      .run(interaction);
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

    if (customId.suffix === 'official') {
      // NOTE: if hub name ever changes, this will need to be updated
      await hubJoinService.joinHub(channel, 'InterChat Central');
    }
    else if (customId.suffix === 'random') {
      await hubJoinService.joinRandomHub(channel);
    }
  }
}
