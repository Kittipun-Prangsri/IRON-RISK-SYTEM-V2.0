// Build script: stitches src/*.html partials into public/ for Firebase Hosting.
// Replaces dev.py's runtime include() resolution with a one-time build step,
// since static Hosting has no server-side templating like GAS did.
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const PUBLIC = path.join(__dirname, "..", "public");

function read(file) {
  return fs.readFileSync(path.join(SRC, file), "utf8");
}

function unwrap(content, tag) {
  const re = new RegExp(`^\\s*<${tag}[^>]*>([\\s\\S]*)</${tag}>\\s*$`, "i");
  const m = content.match(re);
  return m ? m[1].trim() : content;
}

function buildIndex() {
  let html = read("Index.html");

  // GAS-side auth template injection (`<?!= lineUser ?>` / `<?!= lineError ?>`) no
  // longer applies — LINE Login is now resolved client-side by firebase-adapter.js
  // via the exchangeLineLogin callable, not by server-templated doGet().
  html = html.replace(
    /<script>\s*\/\/ Safe injection of lineUser from GAS template[\s\S]*?<\/script>\s*/,
    ""
  );

  html = html.replace(/<\?!= include\('Stylesheet'\); \?>/, '<link rel="stylesheet" href="assets/css/style.css">');
  html = html.replace(/<\?!= include\('Sidebar'\); \?>/, read("Sidebar.html"));
  html = html.replace(/<\?!= include\('Footer'\); \?>/, read("Footer.html"));
  html = html.replace(/<\?!= include\('Modals'\); \?>/, read("Modals.html"));
  html = html.replace(
    /<\?!= include\('JavaScript'\); \?>/,
    [
      '<script src="firebase-config.js"></script>',
      '<script type="module" src="assets/js/firebase-adapter.js"></script>',
      '<script src="assets/js/app.js"></script>'
    ].join("\n  ")
  );

  fs.mkdirSync(PUBLIC, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC, "index.html"), html, "utf8");
}

function buildAssets() {
  fs.mkdirSync(path.join(PUBLIC, "assets", "css"), { recursive: true });
  fs.mkdirSync(path.join(PUBLIC, "assets", "js"), { recursive: true });

  const css = unwrap(read("Stylesheet.html"), "style");
  fs.writeFileSync(path.join(PUBLIC, "assets", "css", "style.css"), css, "utf8");

  const js = unwrap(read("JavaScript.html"), "script");
  fs.writeFileSync(path.join(PUBLIC, "assets", "js", "app.js"), js, "utf8");
}

buildIndex();
buildAssets();
console.log("Built public/ from src/*.html");
