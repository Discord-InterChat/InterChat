/* eslint-disable @typescript-eslint/ban-ts-comment */
import Create from '../src/commands/slash/Main/hub/create.js';
import { jest } from '@jest/globals';
import {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
} from 'discord.js';
import db from '../src/utils/Db.js';

describe('Create', () => {
  let create: Create;
  let interaction: ChatInputCommandInteraction;
  let modalSubmitInteraction: ModalSubmitInteraction;

  beforeEach(() => {
    create = new Create();
    interaction = {} as ChatInputCommandInteraction;
    modalSubmitInteraction = { user: { id: '123' } } as ModalSubmitInteraction;
    // @ts-ignore
    db.hubs.create = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('execute', () => {
    it('should show a modal with the correct components', async () => {
      // @ts-ignore
      interaction.deferReply = jest.fn().mockReturnValueOnce(interaction);
      // @ts-ignore
      interaction.editReply = jest.fn().mockReturnValueOnce(interaction);
      // @ts-ignore
      interaction.showModal = jest.fn().mockReturnValueOnce(interaction);

      const modalBuilderSpy = jest
        .spyOn(ModalBuilder.prototype, 'setTitle')
        .mockReturnValueOnce(new ModalBuilder());
      const addComponentsSpy = jest
        .spyOn(ActionRowBuilder.prototype, 'addComponents')
        .mockReturnValueOnce(new ActionRowBuilder());
      const setLabelSpy = jest
        .spyOn(TextInputBuilder.prototype, 'setLabel')
        .mockReturnValueOnce(new TextInputBuilder());
      const setPlaceholderSpy = jest
        .spyOn(TextInputBuilder.prototype, 'setPlaceholder')
        .mockReturnValueOnce(new TextInputBuilder());
      const setMinLengthSpy = jest
        .spyOn(TextInputBuilder.prototype, 'setMinLength')
        .mockReturnValueOnce(new TextInputBuilder());
      const setMaxLengthSpy = jest
        .spyOn(TextInputBuilder.prototype, 'setMaxLength')
        .mockReturnValueOnce(new TextInputBuilder());
      const setStyleSpy = jest
        .spyOn(TextInputBuilder.prototype, 'setStyle')
        .mockReturnValueOnce(new TextInputBuilder());
      const setCustomIdSpy = jest
        .spyOn(TextInputBuilder.prototype, 'setCustomId')
        .mockReturnValueOnce(new TextInputBuilder());

      await create.execute(interaction);

      expect(modalBuilderSpy).toHaveBeenCalledWith('Create a hub');
      expect(addComponentsSpy).toHaveBeenCalledTimes(4);
      expect(setLabelSpy).toHaveBeenCalledTimes(4);
      expect(setPlaceholderSpy).toHaveBeenCalledTimes(4);
      expect(setMinLengthSpy).toHaveBeenCalledWith(2);
      expect(setMaxLengthSpy).toHaveBeenCalledTimes(4);
      expect(setStyleSpy).toHaveBeenCalledTimes(4);
      expect(setCustomIdSpy).toHaveBeenCalledTimes(4);
    });
  });

  it('should create a new hub if all inputs are valid', async () => {
    // @ts-ignore
    modalSubmitInteraction.deferReply = jest.fn().mockReturnValueOnce(modalSubmitInteraction);
    // @ts-ignore
    modalSubmitInteraction.editReply = jest.fn().mockReturnValueOnce(modalSubmitInteraction);
    // @ts-ignore
    modalSubmitInteraction.fields = {
      getTextInputValue: (input: string) => {
        if (input === 'name') return 'Test Hub';
        if (input === 'description') return 'Test Desc';
        if (input === 'icon') return 'https://i.imgur.com/uoRJPwW.gif';
      },
    };

    await create.handleModals(modalSubmitInteraction);

    expect(db.hubs.create).toHaveBeenCalledWith({
      data: {
        name: 'Test Hub',
        description: 'Test Desc',
        private: true,
        ownerId: '123',
        iconUrl: 'https://i.imgur.com/uoRJPwW.gif',
        bannerUrl: undefined,
        settings: 37,
      },
    });

    expect(modalSubmitInteraction.deferReply).toHaveBeenCalled();
    expect(modalSubmitInteraction.editReply).toHaveBeenCalled();
  });
});
