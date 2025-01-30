import SupportServer from '#src/commands/Support/support/server.js';
import BaseCommand from '#src/core/BaseCommand.js';

export default class Support extends BaseCommand {
  constructor() {
    super({
      name: 'support',
      description: 'Send reports/suggestions to InterChat staff/developers.',
      types: { slash: true, prefix: true },
      subcommands: {
        server: new SupportServer(),
      },
    });
  }
}
