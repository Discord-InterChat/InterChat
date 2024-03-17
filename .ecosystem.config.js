export default {
  apps: [
    {
      name: "interchat",
      script: "build/index.js",
      env_production: {
        NODE_ENV: "production"
      },
      autorestart: true
    }
  ]
};

