const { config, assertConfig } = require("./config");
const { createApp } = require("./app");
const { query } = require("./db");

async function main() {
  assertConfig();
  await query("SELECT 1 FROM users LIMIT 1"); // fail fast: DB unreachable or schema not initialised (npm run db:init)
  const split = config.frontendPort && config.frontendPort !== config.port;
  if (split) {
    createApp({ frontend: false }).listen(config.port, () => console.log(`backend  (API)      listening on :${config.port}`));
  }
  const frontendPort = split ? config.frontendPort : config.port;
  createApp({ frontend: true }).listen(frontendPort, () => {
    console.log(`frontend (web+API)  listening on :${frontendPort} (${config.publicBaseUrl})`);
    if (config.devLogin) console.warn("DEV_LOGIN is ON — mock SSO buttons can log in without a password. Never enable in production.");
  });
}

main().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
