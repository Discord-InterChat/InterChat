import BlacklistListSubcommand from '#src/commands/Main/blacklist/list.js';
import BlacklistServerSubcommand from '#src/commands/Main/blacklist/server.js';
import BlacklistUserSubcommand from '#src/commands/Main/blacklist/user.js';
import BaseCommand from '#src/core/BaseCommand.js';

export default class BlacklistCommand extends BaseCommand {
  constructor() {
    super({
      name: 'blacklist',
      description: 'Mute/Ban a user or server from your hub.',
      types: { prefix: true, slash: true },
      subcommands: {
        user: new BlacklistUserSubcommand(),
        server: new BlacklistServerSubcommand(),
        list: new BlacklistListSubcommand(),
      },
    });
  }
}
