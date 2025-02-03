import {
  type APIActionRowComponent,
  type APIInteractionGuildMember,
  type APIMessageActionRowComponent,
  type APIModalInteractionResponseCallbackData,
  type ActionRowData,
  type BitFieldResolvable,
  type ChatInputCommandInteraction,
  type ContextMenuCommandInteraction,
  type Guild,
  type GuildMember,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionResponse,
  type JSONEncodable,
  Message,
  type MessageActionRowComponentBuilder,
  type MessageActionRowComponentData,
  MessageContextMenuCommandInteraction,
  type MessageEditOptions,
  type MessageFlags,
  type MessageFlagsString,
  type MessagePayload,
  type MessageReplyOptions,
  type ModalComponentData,
  UserContextMenuCommandInteraction,
} from 'discord.js';
import type BaseCommand from '#src/core/BaseCommand.js';
import ContextOptions from '#src/core/CommandContext/ContextOpts.js';
import type InteractionContext from '#src/core/CommandContext/InteractionContext.js';
import type PrefixContext from '#src/core/CommandContext/PrefixContext.js';
import type { TranslationKeys } from '#src/types/TranslationKeys.js';
import { InfoEmbed } from '#src/utils/EmbedUtils.js';
import { type EmojiKeys, getEmoji } from '#src/utils/EmojiUtils.js';
import { type supportedLocaleCodes, t } from '#src/utils/Locale.js';
import { fetchUserLocale } from '#src/utils/Utils.js';

type SupportedInteractions =
	| Message
	| ChatInputCommandInteraction
	| ContextMenuCommandInteraction;

type SupportedInteractionsCached =
	| Message<true>
	| ChatInputCommandInteraction<'cached'>
	| ContextMenuCommandInteraction<'cached'>;

interface classT {
  interaction: SupportedInteractions;
  ctx: PrefixContext | InteractionContext;
  responseType: Message | InteractionResponse;
}

export interface CachedContextType extends classT {
  interaction: SupportedInteractionsCached;
}

export default abstract class Context<T extends classT = classT> {
  protected readonly interaction: T['interaction'];
  protected readonly command: BaseCommand;
  protected readonly _options: ContextOptions;

  abstract get deferred(): boolean;
  abstract get replied(): boolean;

  constructor(interaction: T['interaction'], command: BaseCommand) {
    this.interaction = interaction;
    this.command = command;
    this._options = new ContextOptions(this, command);
  }

  public get options() {
    return this._options;
  }

  public get originalInteraction() {
    return this.interaction;
  }

  public get channel() {
    return this.interaction.channel;
  }
  public get channelId() {
    return this.interaction.channelId;
  }
  public get guild(): T extends CachedContextType ? Guild : Guild | null {
    return this.interaction.guild as T extends CachedContextType
      ? Guild
      : Guild | null;
  }
  public get guildId(): T extends CachedContextType ? string : string | null {
    return this.interaction.guildId as T extends CachedContextType
      ? string
      : string | null;
  }
  public get user() {
    return this.interaction instanceof Message
      ? this.interaction.author
      : this.interaction.user;
  }
  public get member(): T extends CachedContextType
    ? GuildMember | (APIInteractionGuildMember & GuildMember)
    : null {
    return this.interaction.member as T extends CachedContextType
      ? GuildMember | (APIInteractionGuildMember & GuildMember)
      : null;
  }
  public get client() {
    return this.interaction.client;
  }
  public inGuild(): this is Context<CachedContextType> {
    if (this.interaction instanceof Message) return this.interaction.inGuild();
    return this.interaction.inCachedGuild();
  }

  public getEmoji(name: EmojiKeys): string {
    if (!this.client?.isReady()) return '';
    return getEmoji(name, this.client);
  }

  public async getLocale(): Promise<supportedLocaleCodes> {
    return await fetchUserLocale(this.user.id);
  }

  abstract deferReply(opts?: { flags?: ['Ephemeral'] }): Promise<
    T['responseType']
  >;

  public getTargetMessageId(name: string | null): string | null {
    if (this.interaction instanceof MessageContextMenuCommandInteraction) {
      return this.interaction.targetId;
    }
    if (!name) return null;

    const value = this.options.getString(name);
    if (!value) return null;

    // TODO: move this to constants
    const regex =
			/\b\d{17,20}\b|discord\.com\/channels\/\d{17,20}\/\d{17,20}\/(\d{17,20})/g;
    const matches = regex.exec(value);

    let messageId = matches?.[1] ?? matches?.[0];
    if (this.interaction instanceof Message && this.interaction.reference) {
      messageId = this.interaction.reference.messageId;
    }

    return messageId ?? null;
  }

  public async getTargetUser(name?: string) {
    if (this.interaction instanceof UserContextMenuCommandInteraction) {
      return this.interaction.targetId;
    }

    if (!name) return null;

    return await this.options.getUser(name);
  }

  public async getTargetMessage(name: string | null): Promise<Message | null> {
    if (this.interaction instanceof MessageContextMenuCommandInteraction) {
      return this.interaction.targetMessage;
    }

    const targetMessageId = this.getTargetMessageId(name);
    return targetMessageId
      ? ((await this.interaction.channel?.messages
        .fetch(targetMessageId)
        .catch(() => null)) ?? null)
      : null;
  }

  async replyEmbed<K extends keyof TranslationKeys>(
    desc: K | (string & NonNullable<unknown>),
    opts?: {
      t?: { [Key in TranslationKeys[K]]: string };
      content?: string;
      title?: string;
      components?: readonly (
				| JSONEncodable<APIActionRowComponent<APIMessageActionRowComponent>>
				| ActionRowData<
						MessageActionRowComponentData | MessageActionRowComponentBuilder
				>
				| APIActionRowComponent<APIMessageActionRowComponent>
      )[];
      flags?: BitFieldResolvable<
        Extract<
          MessageFlagsString,
					'Ephemeral' | 'SuppressEmbeds' | 'SuppressNotifications'
        >,
				| MessageFlags.Ephemeral
				| MessageFlags.SuppressEmbeds
				| MessageFlags.SuppressNotifications
      >;
      edit?: boolean;
    },
  ): Promise<InteractionResponse | Message | null> {
    let description = desc as string;

    if (t(desc as K, 'en')) {
      const locale = await this.getLocale();
      description = t(desc as K, locale, opts?.t);
    }

    const embed = new InfoEmbed()
      .setDescription(description)
      .setTitle(opts?.title);
    const message = {
      content: opts?.content,
      embeds: [embed],
      components: opts?.components,
    };

    if (opts?.edit) {
      return await this.editOrReply({
        ...message,
        content: message.content ?? null,
      });
    }
    return await this.reply({ ...message, flags: opts?.flags });
  }

  abstract editReply(
    data: string | MessageEditOptions | InteractionEditReplyOptions,
  ): Promise<T['responseType'] | null>;

  async editOrReply(
    data: string | MessageEditOptions | InteractionReplyOptions,
  ): Promise<T['responseType'] | null> {
    if (this.deferred) {
      return await this.editReply(data);
    }
    return await this.reply(data);
  }

  abstract reply(
    data:
			| string
			| MessagePayload
			| MessageReplyOptions
			| InteractionReplyOptions
			| MessageEditOptions,
  ): Promise<T['responseType']>;

  abstract deleteReply(): Promise<void>;

  abstract showModal(
    data:
			| JSONEncodable<APIModalInteractionResponseCallbackData>
			| ModalComponentData
			| APIModalInteractionResponseCallbackData,
  ): Promise<void>;
}
