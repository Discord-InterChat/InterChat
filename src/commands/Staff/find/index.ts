import FindServerSubcommand from '#src/commands/Staff/find/server.js';
import FindUserSubcommand from '#src/commands/Staff/find/user.js';
import BaseCommand from '#src/core/BaseCommand.js';

export default class Find extends BaseCommand {
  constructor() {
    super({
      name: 'find',
      description: 'Find a user/server (Staff Only).',
      types: { slash: true, prefix: true },
      subcommands: {
        server: new FindServerSubcommand(),
        user: new FindUserSubcommand(),
      },
    });
  }
}
