module.exports = {
  apps: [
    {
      name: 'interchat',
      script: '.',
      interpreter: 'bun',
      env: {
        PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
        NODE_ENV: 'production',
      },
      autorestart: true,
    },
  ],
};
