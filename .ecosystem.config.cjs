module.exports = {
  apps: [
    {
      name: 'interchat',
      script: 'build/index.js',
      node_args: '--import ./build/instrument.js',
      env_production: {
        NODE_ENV: 'production',
      },
      autorestart: true,
    },
  ],
};
