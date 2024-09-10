module.exports = {
  apps: [
    {
      name: 'interchat',
      script: 'build/cluster.js',
      node_args: '--max-old-space-size=4096 --import ./build/instrument.js',
      env_production: {
        NODE_ENV: 'production',
      },
      autorestart: true,
    },
  ],
};
