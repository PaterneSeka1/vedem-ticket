module.exports = {
  apps: [
    {
      name: 'gala-ticket-backend',
      cwd: __dirname,
      script: 'dist/main.js',
      interpreter: '/usr/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '15s',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
