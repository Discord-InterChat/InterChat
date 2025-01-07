import BaseCommand from '#main/core/BaseCommand.js';
import { calculateRequiredXP } from '#main/utils/calculateLevel.js';
import Constants from '#main/utils/Constants.js';
import { drawRankProgressBar } from '#main/utils/ImageUtils.js';
import { handleError } from '#main/utils/Utils.js';
import { CanvasRenderingContext2D, createCanvas, loadImage } from 'canvas';
import {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  User,
} from 'discord.js';
import { join } from 'node:path';

interface RankCardDimensions {
  width: number;
  height: number;
  avatarSize: number;
  avatarX: number;
  avatarY: number;
}

interface UserStats {
  level: number;
  xp: number;
  messageCount: number;
  stats: {
    xp: {
      rank: number;
    };
  };
}

export default class RankCommand extends BaseCommand {
  private static readonly DIMENSIONS: RankCardDimensions = {
    width: 900,
    height: 250,
    avatarSize: 110,
    avatarX: 40,
    avatarY: 60, // (height - avatarSize) / 2
  };

  private static readonly FONTS = {
    USERNAME: 'bold 32px "Arial"',
    LEVEL: 'bold 28px "Arial"',
    RANK: 'bold 28px "Arial"',
    XP_PROGRESS: '20px "Arial"',
    TOTAL_XP: '24px "Arial"',
  };

  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'rank',
    description: 'Display user rank and statistics',
    options: [
      {
        name: 'user',
        description: 'The user to get the rank of',
        type: ApplicationCommandOptionType.User,
        required: false,
      },
    ],
  };

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('user') ?? interaction.user;
      const stats = await interaction.client.userLevels.getStats(
        targetUser.id,
        targetUser.username,
      );
      const rankCard = await this.createRankCard(targetUser, stats);

      await interaction.editReply({ files: [rankCard] });
    }
    catch (error) {
      handleError(error, {
        comment: 'Failed to create rank card',
        repliable: interaction,
      });
    }
  }

  private async createRankCard(user: User, stats: UserStats): Promise<AttachmentBuilder> {
    const canvas = createCanvas(RankCommand.DIMENSIONS.width, RankCommand.DIMENSIONS.height);
    const ctx = canvas.getContext('2d');

    await this.drawBackground(ctx);
    await this.drawUserAvatar(ctx, user);
    this.drawUserInfo(ctx, user, stats);
    this.drawProgressBar(ctx, stats);

    return new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' });
  }

  private async drawBackground(ctx: CanvasRenderingContext2D): Promise<void> {
    const background = await loadImage(join(__dirname, '../../../../assets/rankBg.png'));
    ctx.drawImage(background, 0, 0, RankCommand.DIMENSIONS.width, RankCommand.DIMENSIONS.height);

    // Add semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, RankCommand.DIMENSIONS.width, RankCommand.DIMENSIONS.height);
  }

  private async drawUserAvatar(ctx: CanvasRenderingContext2D, user: User): Promise<void> {
    const { avatarX, avatarY, avatarSize } = RankCommand.DIMENSIONS;
    const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));

    // Draw avatar background/border
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
    ctx.fill();

    // Create circular avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  }

  private drawUserInfo(ctx: CanvasRenderingContext2D, user: User, stats: UserStats): void {
    const { avatarX, avatarY, avatarSize, width } = RankCommand.DIMENSIONS;
    const textX = avatarX + avatarSize + 30;

    // Username
    ctx.font = RankCommand.FONTS.USERNAME;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(user.username, textX, avatarY + 40);

    // Level
    ctx.font = RankCommand.FONTS.LEVEL;
    ctx.fillStyle = Constants.Colors.interchatBlue;
    ctx.fillText(`Level ${stats.level}`, textX, avatarY + 80);

    // Rank
    const rankText = `Rank #${stats.stats.xp.rank}`;
    ctx.font = RankCommand.FONTS.RANK;
    const rankWidth = ctx.measureText(rankText).width;
    ctx.fillText(rankText, width - 40 - rankWidth, avatarY + 40);

    // Messages
    const messageText = `${stats.messageCount} messages`;
    const messageWidth = ctx.measureText(messageText).width;
    ctx.fillText(messageText, width - 40 - messageWidth, avatarY + 80);

    // Total XP
    ctx.font = RankCommand.FONTS.TOTAL_XP;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Total XP: ${stats.xp}`, textX, avatarY + 160);
  }

  private drawProgressBar(ctx: CanvasRenderingContext2D, stats: UserStats): void {
    const { avatarX, avatarY, avatarSize, width } = RankCommand.DIMENSIONS;
    const barWidth = width - (avatarX + avatarSize + 60) - 40;
    const textX = avatarX + avatarSize + 30;

    const currentLevelXP = stats.xp % calculateRequiredXP(stats.level);
    const requiredXP = calculateRequiredXP(stats.level);
    const progress = currentLevelXP / requiredXP;

    drawRankProgressBar(ctx, textX, avatarY + 100, barWidth, 25, progress);

    // XP Progress Text
    ctx.font = RankCommand.FONTS.XP_PROGRESS;
    ctx.fillStyle = '#ffffff';
    const xpText = `${currentLevelXP} / ${requiredXP} XP`;
    const xpWidth = ctx.measureText(xpText).width;
    ctx.fillText(xpText, textX + (barWidth - xpWidth) / 2, avatarY + 118);
  }
}
