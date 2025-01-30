import Context from '#src/core/CommandContext/Context.js';
import type {
  APIModalInteractionResponseCallbackData,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  InteractionResponse,
  JSONEncodable,
  Message,
  ModalComponentData,
} from 'discord.js';

export default class InteractionContext extends Context<{
  interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction;
  ctx: InteractionContext;
  responseType: Message | InteractionResponse;
}> {

  public get deferred() {
    return this.interaction.deferred;
  }

  public get replied() {
    return this.interaction.replied;
  }

  public async deferReply(opts?: { flags?: ['Ephemeral'] }) {
    return await this.interaction.deferReply({ flags: opts?.flags });
  }

  public async reply(data: string | InteractionReplyOptions) {
    if (this.interaction.replied || this.interaction.deferred) {
      return await this.interaction.followUp(data);
    }

    return await this.interaction.reply(data);
  }

  public async deleteReply() {
    await this.interaction.deleteReply();
  }

  public async editReply(
    data: string | InteractionEditReplyOptions,
  ): Promise<Message<boolean> | InteractionResponse<boolean>> {
    return await this.interaction.editReply(data);
  }

  public async showModal(
    data:
			| JSONEncodable<APIModalInteractionResponseCallbackData>
			| ModalComponentData
			| APIModalInteractionResponseCallbackData,
  ) {
    await this.interaction.showModal(data);
  }
}
