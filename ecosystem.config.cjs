// Standard PM2 config: `pm2 start ecosystem.config.cjs --env production`.
// Runs the built Next.js app (`npm run build --workspace apps/web` first)
// through apps/web/server.mjs, which terminates HTTPS itself with the
// household's shared cert (apps/web/certs/) — Pattern B on this machine,
// same as Photo2Print/RiseUp, not an IIS reverse proxy (Next.js's
// frontend+API+SSR live in one process, unlike a split static+API app).
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "insurance-advisor-platform",
      script: "server.mjs",
      cwd: path.join(__dirname, "apps", "web"),
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: { NODE_ENV: "production", PORT: "37000" },
      env_production: { NODE_ENV: "production", PORT: "37000" },
      // Absolute, not relative — `cwd` above points into apps/web, not the
      // project root where this file lives, so a bare "./logs/..." would
      // land in the wrong place.
      error_file: path.join(__dirname, "logs", "err.log"),
      out_file: path.join(__dirname, "logs", "out.log"),
      log_file: path.join(__dirname, "logs", "combined.log"),
      time: true,
      merge_logs: true,
      max_memory_restart: "512M",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
