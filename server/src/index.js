const { config, assertConfig } = require("./config");
const { createApp } = require("./app");
const { getPool } = require("./db");

async function main() {
  assertConfig();
  await getPool().query("SELECT 1"); // fail fast if the database is unreachable
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Iron Zero Risk server listening on :${config.port} (${config.publicBaseUrl})`);
    if (config.devLogin) console.warn("DEV_LOGIN is ON — mock SSO buttons can log in without a password. Never enable in production.");
  });
}

main().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
