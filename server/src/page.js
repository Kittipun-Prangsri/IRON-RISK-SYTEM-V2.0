// Renders src/Index.html the way GAS HtmlService did: resolves
// <?!= include('X'); ?> partials and the <?!= lineUser ?> / <?!= lineError ?>
// template values, and loads the google.script.run shim before app code.
const fs = require("fs");
const path = require("path");
const { config } = require("./config");

let cached = null;

function readPartial(name) {
  return fs.readFileSync(path.join(config.srcDir, `${name}.html`), "utf8");
}

function buildTemplate() {
  let html = readPartial("Index");
  html = html.replace(/<\?!=\s*include\('(\w+)'\);?\s*\?>/g, (match, name) => {
    const content = readPartial(name);
    return name === "JavaScript" ? `<script src="/gas-shim.js"></script>\n${content}` : content;
  });
  return html;
}

function template() {
  // Re-read on every request in development so edits to src/*.html show up.
  if (!cached || process.env.NODE_ENV !== "production") cached = buildTemplate();
  return cached;
}

// JSON for embedding inside <script type="application/json">: escape "<" so
// a value containing "</script>" cannot close the block.
function embedJson(value) {
  return value === undefined || value === null ? "null" : JSON.stringify(value).replace(/</g, "\\u003c");
}

function renderIndex({ lineUser, lineError } = {}) {
  return template()
    .replace(/<\?!=\s*lineUser\s*\?>/g, () => embedJson(lineUser))
    .replace(/<\?!=\s*lineError\s*\?>/g, () => embedJson(lineError));
}

module.exports = { renderIndex, embedJson };
