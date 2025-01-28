import type BaseCommand from '#main/core/BaseCommand.js';
import type Context from '#main/core/CommandContext/Context.js';
import type PrefixContext from '#main/core/CommandContext/PrefixContext.js';
import { ApplicationCommandOptionType, Message } from 'discord.js';

const acceptedBooleanValues = {
  true: true,
  false: false,
  yes: true,
  no: false,
  y: true,
  n: false,
};

const channelRegex =
	/(?:https?:\/\/(?:\w+\.)*discord\.com\/channels\/\d+\/(\d+)(?:\/\d+)?(?:\?.*)?|<#(\d+)>|\b(\d{17,19})\b)/;
const userRegex = /(?:<@!? ?(\d+)>|\b(\d{17,19})\b(?!\/))/;
const roleRegex = /(?:<@& ?(\d+)>|\b(\d{17,19})\b(?!\/))/;

const extractChannelId = (input: string) => {
  const match = input.match(channelRegex);
  return match ? match[1] || match[2] || match[3] : null;
};

const extractUserId = (input: string) => {
  const match = input.match(userRegex);
  return match ? match[1] || match[2] : null;
};

const extractRoleId = (input: string) => {
  const match = input.match(roleRegex);
  return match ? match[1] || match[2] : null;
};

export default class ContextOptions {
  readonly ctx: Context;
  readonly command: BaseCommand;
  constructor(ctx: Context, command: BaseCommand) {
    this.ctx = ctx;
    this.command = command;
  }

  public getString(name: string) {
    if (this.ctx.originalInteraction instanceof Message) {
      const arg = (this.ctx as PrefixContext).args.get(name);
      return arg?.type === ApplicationCommandOptionType.String ? arg.value : '';
    }
    if (this.ctx.originalInteraction.isChatInputCommand()) {
      return this.ctx.originalInteraction.options.getString(name);
    }

    throw new Error('Cannot get string option from a context menu command');
  }

  public getNumber(name: string) {
    if (this.ctx.originalInteraction instanceof Message) {
      const arg = (this.ctx as PrefixContext).args.get(name);
      if (
        arg?.type !== ApplicationCommandOptionType.Number ||
				Number.isNaN(Number(arg.value))
      ) return null;

      return Number(arg.value);
    }
    if (this.ctx.originalInteraction.isChatInputCommand()) {
      return this.ctx.originalInteraction.options.getNumber(name);
    }

    throw new Error('Cannot get number option from a context menu command');
  }

  public getBoolean(name: string) {
    if (this.ctx.originalInteraction instanceof Message) {
      const arg = (this.ctx as PrefixContext).args.get(name);
      if (
        !arg ||
				arg?.type !== ApplicationCommandOptionType.Boolean ||
				arg.value in acceptedBooleanValues === false
      ) {
        return false;
      }

      return acceptedBooleanValues[
        arg.value as keyof typeof acceptedBooleanValues
      ];
    }
    if (this.ctx.originalInteraction.isChatInputCommand()) {
      return this.ctx.originalInteraction.options.getBoolean(name);
    }

    throw new Error('Cannot get boolean option from a context menu command');
  }

  public getUserId(name: string): string | null {
    if (this.ctx.originalInteraction instanceof Message) {
      const arg = (this.ctx as PrefixContext).args.get(name);
      if (arg?.type !== ApplicationCommandOptionType.User) return null;

      const userId = extractUserId(arg.value);
      return userId ?? null;
    }

    if (this.ctx.originalInteraction.isChatInputCommand()) {
      return this.ctx.originalInteraction.options.getUser(name)?.id ?? null;
    }

    throw new Error('Cannot get user option from a context menu command');
  }

  public async getUser(name: string) {
    if (this.ctx.originalInteraction instanceof Message) {
      const userId = this.getUserId(name);
      if (!userId) return null;

      const user =
				this.ctx.originalInteraction.mentions.users.get(userId) ??
				(await this.ctx.client.users.fetch(userId)) ??
				null;
      return user;
    }

    if (this.ctx.originalInteraction.isChatInputCommand()) {
      return this.ctx.originalInteraction.options.getUser(name);
    }

    throw new Error('Cannot get user option from a context menu command');
  }

  public async getChannel(name: string) {
    if (this.ctx.originalInteraction instanceof Message) {
      const arg = (this.ctx as PrefixContext).args.get(name);
      if (!arg || arg?.type !== ApplicationCommandOptionType.Channel) return null;

      const channelId = extractChannelId(arg.value);
      if (!channelId) return null;

      const channel =
				this.ctx.originalInteraction.mentions.channels.get(channelId) ??
				(await this.ctx.client.channels.fetch(channelId)) ??
				null;

      return channel;
    }
    if (this.ctx.originalInteraction.isChatInputCommand()) {
      return this.ctx.originalInteraction.options.getChannel(name);
    }

    throw new Error('Cannot get channel option from a context menu command');
  }

  public async getMember(name: string) {
    if (this.ctx.originalInteraction instanceof Message) {
      const arg = (this.ctx as PrefixContext).args.get(name);
      if (!arg || arg?.type !== ApplicationCommandOptionType.User) return null;

      const userId = extractUserId(arg.value);
      if (!userId) return null;

      const user =
				this.ctx.originalInteraction.mentions.users.get(userId) ??
				(await this.ctx.client.users.fetch(userId)) ??
				null;
      return user;
    }
    if (this.ctx.originalInteraction.isChatInputCommand()) {
      return this.ctx.originalInteraction.options.getMember(name);
    }

    throw new Error('Cannot get member option from a context menu command');
  }

  public async getRole(name: string) {
    if (this.ctx.originalInteraction instanceof Message) {
      const arg = (this.ctx as PrefixContext).args.get(name);
      if (!arg || arg?.type !== ApplicationCommandOptionType.Role) return null;

      const roleId = extractRoleId(arg.value);
      if (!roleId) return null;

      return (
        this.ctx.originalInteraction.mentions.roles.get(roleId) ??
				(await this.ctx.guild?.roles.fetch(roleId)) ??
				null
      );
    }
    if (this.ctx.originalInteraction.isChatInputCommand()) {
      return this.ctx.originalInteraction.options.getRole(name);
    }

    throw new Error('Cannot get role option from a context menu command');
  }
  public getAttachment(name: string) {
    if (this.ctx.originalInteraction instanceof Message) {
      return this.ctx.originalInteraction.attachments.first() ?? null;
    }
    if (this.ctx.originalInteraction.isChatInputCommand()) {
      return this.ctx.originalInteraction.options.getAttachment(name);
    }
    throw new Error('Cannot get attachment option from a context menu command');
  }
}
