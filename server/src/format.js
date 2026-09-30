// Date helpers pinned to Asia/Bangkok (matches GAS Utilities.formatDate usage).
const TZ = "Asia/Bangkok";

function parts(date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  });
  return fmt.formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
}

// "yyyy-MM-dd HH:mm:ss" in Bangkok time — for DATETIME columns.
function toSqlDateTime(date) {
  const p = parts(date || new Date());
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}:${p.second}`;
}

// "dd/MM/yyyy HH:mm" — the format the UI shows for logs / last-updated.
function toDisplayDateTime(date) {
  const p = parts(date || new Date());
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.day}/${p.month}/${p.year} ${hour}:${p.minute}`;
}

// Converts a stored "yyyy-MM-dd HH:mm:ss" string straight to "dd/MM/yyyy HH:mm".
function sqlToDisplay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(value || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : String(value || "");
}

module.exports = { toSqlDateTime, toDisplayDateTime, sqlToDisplay };
