const { createApp } = require("../server/src/app");
const { assertConfig } = require("../server/src/config");

// Ensure configuration is valid before serving traffic
assertConfig();

// Initialize the Express app
const app = createApp({ frontend: true });

// Export for Vercel
module.exports = app;
