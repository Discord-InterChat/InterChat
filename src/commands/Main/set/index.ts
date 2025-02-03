import SetLanguage from '#src/commands/Main/set/language.js';
import ReplyMention from '#src/commands/Main/set/reply_mentions.js';
import BaseCommand from '#src/core/BaseCommand.js';

export default class SetCommand extends BaseCommand {
  constructor() {
    super({
      name: 'set',
      description: 'Set your preferences',
      types: {
        slash: true,
      },
      subcommands: {
        language: new SetLanguage(),
        reply_mentions: new ReplyMention(),
      },
    });
  }
}
