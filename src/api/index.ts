import { VoteManager } from '#src/managers/VoteManager.js';
import Constants from '#src/utils/Constants.js';
import Logger from '#utils/Logger.js';

export const startApi = () => {
  const voteManager = new VoteManager();
  const server = Bun.serve({
    static: {
      '/': Response.redirect(Constants.Links.Website),
    },
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === '/dbl' && request.method === 'POST') {
        voteManager.middleware(request);
      }

      return new Response('404!');
    },
  });

  Logger.info(`API server started on port ${server.port}`);
};
