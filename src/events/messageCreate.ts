import { stripIndents } from 'common-tags';
import type { Client, Message } from 'discord.js';
import BaseEventListener from '#main/core/BaseEventListener.js';
import { showRulesScreening } from '#main/interactions/RulesScreening.js';
import { MessageProcessor } from '#main/services/MessageProcessor.js';
import Constants from '#main/utils/Constants.js';
import { handleError, isHumanMessage } from '#utils/Utils.js';
import { AchievementType } from '@prisma/client';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';

export default class MessageCreate extends BaseEventListener<'messageCreate'> {
  readonly name = 'messageCreate';
  private readonly messageProcessor: MessageProcessor;

  constructor(client: Client<true> | null) {
    super(client ?? null);
    this.messageProcessor = new MessageProcessor();
  }

  async execute(message: Message) {
    if (!message.inGuild() || !isHumanMessage(message)) return;

    if (message.content.startsWith('c!')) {
      await this.handlePrefixCommand(message, 'c!');
      return;
    }
    if (
      message.content === `<@${message.client.user.id}>` ||
      message.content === `<@!${message.client.user.id}>`
    ) {
      await message.channel
        .send(
          stripIndents`
            ### Hey there! I'm InterChat, a bot that connects servers together. ${this.getEmoji('clipart')}
            - To get started, type \`/setup\` to set up InterChat with a hub.
            - If you're new here, read the rules by typing \`/rules\`.
            - Use the [hub browser](${Constants.Links.Website}/hubs) to find and join more cross-server communities.
            -# ***Need help?** Join our [support server](<${Constants.Links.SupportInvite}>).*
      `,
        )
        .catch(() => null);
    }

    await this.handleChatMessage(message).catch((e) => handleError(e, { repliable: message }));
  }

  private async handlePrefixCommand(message: Message, prefix: string) {
    try {
      const userData = await message.client.userManager.getUser(message.author.id);
      if (!userData?.acceptedRules) return await showRulesScreening(message, userData);

      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();

      if (!commandName) return;

      const command =
        message.client.prefixCommands.get(commandName) ||
        message.client.prefixCommands.find((cmd) => cmd.data.aliases?.includes(commandName));

      if (!command) return;

      await command.execute(message, args);
    }
    catch (e) {
      handleError(e, { repliable: message });
    }
  }

  private async handleChatMessage(message: Message<true>) {
    await this.messageProcessor.processHubMessage(message);
    await this.trackUserActions(message);
  }

  private async trackUserActions(message: Message<true>) {
    const userId = message.author.id;
    const userData = await message.client.userManager.getUser(userId);

    if (!userData) return;

    // Track message count
    const newMessageCount = userData.messageCount + 1;
    await message.client.userManager.updateUser(userId, { messageCount: newMessageCount });

    // Check achievement criteria
    await this.checkAchievementCriteria(message, userData, newMessageCount);
  }

  private async checkAchievementCriteria(message: Message<true>, userData: any, newMessageCount: number) {
    const userId = message.author.id;

    // Check for first 100 messages achievement
    if (newMessageCount === 100) {
      await this.awardAchievement(userId, AchievementType.FIRST_100_MESSAGES, message);
    }

    // Check for first 10 messages in a hub achievement
    if (newMessageCount === 10) {
      await this.awardAchievement(userId, AchievementType.FIRST_10_MESSAGES_IN_HUB, message);
    }

    // Check for first 50 messages in a hub achievement
    if (newMessageCount === 50) {
      await this.awardAchievement(userId, AchievementType.FIRST_50_MESSAGES_IN_HUB, message);
    }

    // Check for first 500 messages in a hub achievement
    if (newMessageCount === 500) {
      await this.awardAchievement(userId, AchievementType.FIRST_500_MESSAGES_IN_HUB, message);
    }

    // Check for first 1000 messages in a hub achievement
    if (newMessageCount === 1000) {
      await this.awardAchievement(userId, AchievementType.FIRST_1000_MESSAGES_IN_HUB, message);
    }
  }

  private async awardAchievement(userId: string, type: AchievementType, message: Message<true>) {
    const achievement = await db.achievement.create({
      data: {
        userId,
        type,
      },
    });

    await db.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.id,
      },
    });

    await this.notifyUser(userId, type, message);
  }

  private async notifyUser(userId: string, type: AchievementType, message: Message<true>) {
    const user = await message.client.users.fetch(userId);
    const embed = new InfoEmbed().setDescription(`Congratulations! You've unlocked the achievement: **${type}**`);

    await user.send({ embeds: [embed] }).catch(() => null);
  }
}
