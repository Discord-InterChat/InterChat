import UnblacklistserverSubcommand from '#src/commands/Main/unblacklist/server.js';
import UnblacklistUserSubcommand from '#src/commands/Main/unblacklist/user.js';
import BaseCommand from '#src/core/BaseCommand.js';

export default class UnblacklistCommand extends BaseCommand {
  constructor() {
    super({
      name: 'unblacklist',
      description: 'Unblacklist a user or server from your hub.',
      types: { prefix: true, slash: true },
      subcommands: {
        user: new UnblacklistUserSubcommand(),
        server: new UnblacklistserverSubcommand(),
      },
    });
  }
}
