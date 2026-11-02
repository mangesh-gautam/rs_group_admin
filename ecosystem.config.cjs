// pm2 process file for the admin app on the server (after `npm ci && npm run build`):
//   pm2 delete rs-group-admin; pm2 start ecosystem.config.cjs; pm2 save
// Runs Next.js directly — not through `npm start`, which keeps an extra npm process
// (~50 MB) alive in front of it — with a heap ceiling, and restarts it if it ever grows
// past 512 MB. Settings come from .env.production / the environment as before (PORT,
// API_GATEWAY_URL, …).
module.exports = {
  apps: [
    {
      name: "rs-group-admin",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      node_args: "--max-old-space-size=384",
      env: { NODE_ENV: "production" },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      // a crash loop backs off instead of spinning the CPU
      exp_backoff_restart_delay: 200,
      kill_timeout: 5000,
      time: true,
    },
  ],
};
