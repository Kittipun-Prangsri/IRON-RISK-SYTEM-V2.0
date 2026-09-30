// ============================================================
// IRON ZERO RISK — GOOGLE APPS SCRIPT BACKEND
// Platform: Google Apps Script + Google Sheets
// ============================================================

// Configuration via PropertiesService
function getSpreadsheetId() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty("SPREADSHEET_ID") || "1lpQ502MZlt8sUyOlgirGozD05Gs1N8B6QEJdVxHNoDs";
}

function getSpreadsheet() {
  var id = getSpreadsheetId();
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    console.error("Error opening spreadsheet: ", e);
    return null;
  }
}

var SHEET_DATA = "ข้อมูลเด็ก";
var SHEET_LOG  = "ActivityLog";
var SHEET_AOR  = "AOR";
var SHEET_MED  = "MedicineLog";
var SHEET_USERS = "Users";

// Default LINE Notify Token (User can update in script or via UI)
function getLineToken() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty("LINE_TOKEN") || "YOUR_LINE_NOTIFY_TOKEN_HERE";
}

function getSystemSettings() {
  var props = PropertiesService.getScriptProperties();
  // URL จริงของ GAS Web App — ต้องตรงกับ Callback URL ที่ลงทะเบียนใน LINE Developers Console
  var KNOWN_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwB5wqUpAxkOgrzyYE8D4eXNidVxE3lI2cyobUO5EeSV3IKyr2NQZqdGrLQrsbqbK0YDw/exec";
  var scriptUrl = "";
  try { scriptUrl = ScriptApp.getService().getUrl(); } catch(e) { scriptUrl = ""; }
  // ใช้ scriptUrl จาก runtime ก่อน ถ้าไม่ได้ให้ใช้ KNOWN_SCRIPT_URL
  scriptUrl = scriptUrl || KNOWN_SCRIPT_URL;
  var storedRedirectUri = props.getProperty("LINE_REDIRECT_URI") || "";
  return {
    lineToken: props.getProperty("LINE_TOKEN") || "",
    spreadsheetId: getSpreadsheetId(),
    lineClientId: props.getProperty("LINE_CLIENT_ID") || "2010316731",
    lineClientSecret: props.getProperty("LINE_CLIENT_SECRET") || "8b9b3d2b383b57ee10d4571c8869b007",
    // ลำดับความสำคัญ: ค่าที่บันทึกไว้ใน Properties > scriptUrl จาก runtime > KNOWN_SCRIPT_URL
    lineRedirectUri: storedRedirectUri || scriptUrl,
    liffId: props.getProperty("LIFF_ID") || "2010316731-yX26Zf8M",
    healthIdClientId: props.getProperty("HEALTHID_CLIENT_ID") || "01939ac3-9394-7b9b-b3a4-0d53f13d3f32",
    healthIdSecret: props.getProperty("HEALTHID_CLIENT_SECRET") || "",
    providerIdClientId: props.getProperty("PROVIDERID_CLIENT_ID") || "9370d9a5-597b-40da-b61a-6df9143f62ce",
    providerIdSecret: props.getProperty("PROVIDERID_SECRET_KEY") || "",
    scriptUrl: scriptUrl
  };
}


function saveSystemSettings(settings) {
  var props = PropertiesService.getScriptProperties();
  if (settings.lineToken !== undefined) { props.setProperty("LINE_TOKEN", settings.lineToken); }
  if (settings.spreadsheetId !== undefined) { props.setProperty("SPREADSHEET_ID", settings.spreadsheetId); }
  if (settings.lineClientId !== undefined) { props.setProperty("LINE_CLIENT_ID", settings.lineClientId); }
  if (settings.lineClientSecret !== undefined) { props.setProperty("LINE_CLIENT_SECRET", settings.lineClientSecret); }
  if (settings.lineRedirectUri !== undefined) { props.setProperty("LINE_REDIRECT_URI", settings.lineRedirectUri); }
  if (settings.liffId !== undefined) { props.setProperty("LIFF_ID", settings.liffId); }
  if (settings.healthIdClientId !== undefined) { props.setProperty("HEALTHID_CLIENT_ID", settings.healthIdClientId); }
  if (settings.healthIdSecret !== undefined) { props.setProperty("HEALTHID_CLIENT_SECRET", settings.healthIdSecret); }
  if (settings.providerIdClientId !== undefined) { props.setProperty("PROVIDERID_CLIENT_ID", settings.providerIdClientId); }
  if (settings.providerIdSecret !== undefined) { props.setProperty("PROVIDERID_SECRET_KEY", settings.providerIdSecret); }
  return { success: true };
}

function testLineNotify(token) {
  var message = "\n🔔 [Iron Zero Risk]\nระบบทดสอบการแจ้งเตือนสำเร็จแล้ว!\nเวลา: " + Utilities.formatDate(new Date(), "Asia/Bangkok", "HH:mm:ss");
  try {
    var res = UrlFetchApp.fetch("https://notify-api.line.me/api/notify", {
      method: "post",
      headers: { "Authorization": "Bearer " + token },
      payload: { message: message },
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code === 200) return { success: true };
    return { success: false, error: "HTTP " + code + ": " + res.getContentText() };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

var HEADER_MAPPING = {
  "WKT": ["WKT", "wkt"],
  "ID": ["ID", "id"],
  "ชื่อเด็ก": ["ชื่อเด็ก", "ชื่อ"],
  "อายุ": ["อายุ"],
  "บ้านเลขที่": ["บ้านเลขที่", "บ้าน"],
  "หมู่": ["หมู่", "หมู่ที่"],
  "ชื่อหมู่บ้าน": ["ชื่อหมู่บ้าน", "หมู่บ้าน", "village"],
  "ตำบล": ["ตำบล", "Subdistrict", "subdistrict", "Tambon", "tambon"],
  "อำเภอ": ["อำเภอ", "District", "district", "Amphoe", "amphoe"],
  "จังหวัด": ["จังหวัด", "Province", "province"],
  "Latitude": ["Lat", "Latitude", "lat", "latitude"],
  "Longitude": ["Lng", "Longitude", "lng", "longitude"],
  "Hct (%)": ["Hct", "Hct (%)", "hct"],
  "น้ำหนัก (กก.)": ["น้ำหนัก(กก.)", "น้ำหนัก (กก.)", "น้ำหนัก"],
  "ส่วนสูง (ซม.)": ["ส่วนสูง(ซม.)", "ส่วนสูง (ซม.)", "ส่วนสูง"],
  "สถานะโภชนาการ": ["สถานะโภชนาการ", "โภชนาการ"],
  "ได้รับยาเหล็ก": ["ได้รับยาเหล็ก", "ยาเหล็ก"],
  "พฤติกรรมการกินอาหาร": ["พฤติกรรมการกินอาหาร", "อาหาร"],
  "ปัจจัยสังคมเศรษฐกิจ": ["ปัจจัยสังคมเศรษฐกิจ", "สังคม"],
  "ผู้ดูแล": ["ผู้ดูแล"],
  "คะแนน Hct": ["คะแนน Hct"],
  "คะแนนน้ำหนัก": ["คะแนนน้ำหนัก"],
  "คะแนนยาเหล็ก": ["คะแนนยาเหล็ก"],
  "คะแนนอาหาร": ["คะแนนอาหาร"],
  "คะแนนสังคม": ["คะแนนสังคม"],
  "คะแนนรวม": ["คะแนนรวม"],
  "ระดับความเสี่ยง": ["สถานะ", "ระดับความเสี่ยง"],
  "วันที่กินยาล่าสุด": ["วันที่กินยาล่าสุด"],
  "หมายเหตุ": ["หมายเหตุ", "Notes", "notes", "Note", "note"],
  "Active": ["Active", "active"]
};

function getColIndex(headers, key) {
  var aliases = HEADER_MAPPING[key] || [key];
  for (var i = 0; i < aliases.length; i++) {
    var idx = headers.indexOf(aliases[i]);
    if (idx !== -1) return idx;
  }
  return -1;
}

function getMappedKey(header) {
  for (var key in HEADER_MAPPING) {
    if (HEADER_MAPPING[key].indexOf(header) !== -1) {
      return key;
    }
  }
  return header;
}

// ── GET ENTRYPOINT ──────────────────────────────────────────
function doGet(e) {
  var lineUser = null;
  var lineError = null;
  var googleEmail = "";
  
  if (e && e.parameter && e.parameter.code) {
    if (e.parameter.state === "moph") {
      try {
        var mophResult = handleProviderIdLoginCallback(e.parameter.code);
        if (mophResult && mophResult.error) {
          lineError = mophResult.error;
          if (mophResult.user) lineUser = mophResult.user;
        } else if (mophResult) {
          lineUser = mophResult;
        }
      } catch (err) {
        console.error("MOPH Login failed:", err);
        lineError = err.toString();
      }
    } else {
      // 1. Handle LINE Login Callback
      try {
        var callbackResult = handleLineLoginCallback(e.parameter.code);
        if (callbackResult && callbackResult.error) {
          lineError = callbackResult.error;
          // ถ้าเป็น Pending ให้ส่ง lineUser ที่มี status:Pending กลับมาด้วย
          if (callbackResult.user) {
            lineUser = callbackResult.user;
          }
        } else if (callbackResult) {
          lineUser = callbackResult;
        }
      } catch (err) {
        console.error("LINE Login failed:", err);
        lineError = err.toString();
      }
    }
  }

  // 2. Detect Google User (Seamless SSO)
  try {
    googleEmail = Session.getActiveUser().getEmail();
  } catch (err) {
    // Session might be limited in some sandbox modes
  }

  var template = HtmlService.createTemplateFromFile("Index");
  template.lineUser = lineUser ? JSON.stringify(lineUser).replace(/</g, "\\u003c") : "null";
  template.lineError = lineError ? JSON.stringify(lineError).replace(/</g, "\\u003c") : "null";
  template.googleEmail = googleEmail || "";

  return template.evaluate()
    .setTitle("Iron Zero Risk — ระบบติดตามสุขภาพเด็ก")
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

/**
 * ดึงข้อมูลผู้ใช้ปัจจุบันจาก Google Session (Seamless SSO)
 */
function getGoogleUser() {
  var email = Session.getActiveUser().getEmail();
  if (!email) return { success: false, error: "ไม่พบข้อมูล Google Account ของคุณ" };
  
  return verifyUserLogin("SSO", email, "");
}

// ── MOPH ID OAUTH FLOW ──────────────────────────────────────
function getProviderIdAuthUrl() {
  var settings = getSystemSettings();
  var clientId = settings.healthIdClientId;
  var redirectUri = settings.scriptUrl;
  
  if (!clientId) throw new Error("ยังไม่ได้ตั้งค่า Health ID Client ID (Script Property: HEALTHID_CLIENT_ID)");
  // Format from "คู่มือการเชื่อมต่อระบบ Provider ID ด้วย OAuth ของ Health ID":
  // {HealthID-URL}/oauth/redirect?client_id=&redirect_uri=&response_type=code  (state is optional)
  var url = "https://moph.id.th/oauth/redirect" +
            "?client_id=" + encodeURIComponent(clientId) +
            "&redirect_uri=" + encodeURIComponent(redirectUri) +
            "&response_type=code" +
            "&state=moph";
  return url;
}

function parseJsonSafe(text) {
  try { return JSON.parse(text); } catch (err) { return { message: String(text).slice(0, 200) }; }
}

function handleProviderIdLoginCallback(code) {
  var settings = getSystemSettings();
  var redirectUri = settings.scriptUrl;
  
  var healthIdClientId = settings.healthIdClientId;
  var healthIdSecret = settings.healthIdSecret;
  var providerClientId = settings.providerIdClientId;
  var providerSecret = settings.providerIdSecret;
  
  if (!healthIdClientId || !healthIdSecret || !providerClientId || !providerSecret) {
    return { error: "ยังไม่ได้ตั้งค่า Health ID / Provider ID Client ID หรือ Secret ในระบบ" };
  }

  // 1. Health ID: code → access_token
  var healthPayload = {
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    client_id: healthIdClientId,
    client_secret: healthIdSecret
  };
  
  var healthResp = UrlFetchApp.fetch("https://moph.id.th/api/v1/token", {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: Object.keys(healthPayload).map(function(k) { return encodeURIComponent(k) + "=" + encodeURIComponent(healthPayload[k]); }).join("&"),
    muteHttpExceptions: true
  });
  
  var healthData = parseJsonSafe(healthResp.getContentText());
  var healthToken = healthData.data && healthData.data.access_token;
  if (!healthToken) {
    return { error: "Health ID Token error: " + (healthData.message || healthResp.getResponseCode()) };
  }

  // 2. Provider ID: Health ID token → provider access_token
  var providerTokenResp = UrlFetchApp.fetch("https://provider.id.th/api/v1/services/token", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ client_id: providerClientId, secret_key: providerSecret, token_by: "Health ID", token: healthToken }),
    muteHttpExceptions: true
  });
  
  if (providerTokenResp.getResponseCode() === 400) {
    return { error: "บัญชี Health ID นี้ยังไม่มี Provider ID กรุณาสมัคร Provider ID ก่อนใช้งาน" };
  }
  
  var providerTokenData = parseJsonSafe(providerTokenResp.getContentText());
  var providerToken = providerTokenData.data && providerTokenData.data.access_token;
  if (!providerToken) {
    return { error: "Provider ID Token error: " + (providerTokenData.message || providerTokenResp.getResponseCode()) };
  }

  // 3. Provider ID: profile
  var profileResp = UrlFetchApp.fetch("https://provider.id.th/api/v1/services/profile", {
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + providerToken,
      "client-id": providerClientId,
      "secret-key": providerSecret
    },
    muteHttpExceptions: true
  });
  
  var profileData = parseJsonSafe(profileResp.getContentText());
  var provider = profileData.data;
  if (profileResp.getResponseCode() === 404) {
    return { error: "ไม่พบข้อมูล Provider ID ของบัญชีนี้" };
  }
  if (!provider || !provider.provider_id) {
    return { error: "ไม่สามารถดึงข้อมูลโปรไฟล์ Provider ID ได้: " + (profileData.message || profileResp.getResponseCode()) };
  }

  // provider_id is the stable per-person key (stored in the Users sheet's Email column for matching).
  var identifier = provider.provider_id;
  var fullName = [provider.special_title_th || provider.title_th || "", provider.name_th || ""].join(" ").trim() || provider.name_eng;

  var result = verifyUserLogin("MOPH", identifier, "");
  if (result.success) {
    var user = result.user;
    user.displayName = fullName || user.name;
    return user;
  }
  // Already registered but waiting for approval — don't register a duplicate row.
  if (result.pending) {
    result.user.displayName = fullName || result.user.name;
    return { error: result.error, user: result.user };
  }
  if (result.error && result.error.indexOf("ถูกระงับ") !== -1) {
    return { error: result.error };
  }

  // Not found - Auto Register
  var newUserId = autoRegisterMophUser(provider, identifier, fullName);
  var pendingUser = {
    id: newUserId,
    name: fullName,
    role: "รอการอนุมัติ",
    email: "",
    lineUserId: "",
    phone: "",
    assignedVillage: "",
    status: "Pending",
    displayName: fullName
  };
  return {
    error: "บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ",
    user: pendingUser
  };
}

function autoRegisterMophUser(provider, identifier, fullName) {
  setupDatabase();
  var ss = getSpreadsheet();
  if (!ss) return null;
  var usersSheet = ss.getSheetByName(SHEET_USERS) || ss.getSheetByName("Users");
  
  var headers = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0];
  var idxId = headers.indexOf("ID");
  var idxName = headers.indexOf("Name");
  var idxRole = headers.indexOf("Role");
  var idxStatus = headers.indexOf("Status");
  var idxEmail = headers.indexOf("Email");

  var timestamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");
  var newId = "H" + timestamp;

  var newRow = new Array(headers.length).fill("");
  if (idxId !== -1) newRow[idxId] = newId;
  if (idxName !== -1) newRow[idxName] = fullName;
  if (idxRole !== -1) newRow[idxRole] = "เจ้าหน้าที่ รพ.";
  if (idxStatus !== -1) newRow[idxStatus] = "Pending";
  if (idxEmail !== -1) newRow[idxEmail] = identifier; // Store identifier in Email for SSO login match

  usersSheet.appendRow(newRow);
  logActivity("ลงทะเบียน", "Auto-register MOPH user รอการอนุมัติ", identifier);
  return newId;
}

function handleLineLoginCallback(code) {
  var settings = getSystemSettings();
  var clientId = settings.lineClientId;
  var clientSecret = settings.lineClientSecret;
  var redirectUri = settings.lineRedirectUri || settings.scriptUrl;
  
  if (!clientId || !clientSecret) {
    console.warn("LINE Credentials not set in System Settings");
    return { error: "ยังไม่ได้ตั้งค่า LINE Client ID/Secret ในระบบ" };
  }
  
  var tokenUrl = "https://api.line.me/oauth2/v2.1/token";
  var payload = {
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  };
  
  var options = {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: Object.keys(payload).map(function(k) { return encodeURIComponent(k) + "=" + encodeURIComponent(payload[k]); }).join("&"),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(tokenUrl, options);
  var tokenData = JSON.parse(response.getContentText());
  
  if (tokenData.error) {
    console.error("LINE Token exchange error:", tokenData.error_description);
    return { error: "LINE Token error: " + (tokenData.error_description || tokenData.error) };
  }
  
  var accessToken = tokenData.access_token;
  
  // Fetch LINE Profile
  var profileUrl = "https://api.line.me/v2/profile";
  var profileResponse = UrlFetchApp.fetch(profileUrl, {
    method: "get",
    headers: { "Authorization": "Bearer " + accessToken },
    muteHttpExceptions: true
  });
  
  var profileData = JSON.parse(profileResponse.getContentText());
  if (!profileData.userId) {
    return { error: "ไม่สามารถดึงข้อมูล LINE Profile ได้" };
  }

  // ตรวจสอบว่ามีบัญชีในระบบหรือไม่
  var result = verifyUserLogin("LINE", profileData.userId, "");
  if (result.success) {
    var user = result.user;
    user.avatarUrl = profileData.pictureUrl || "";
    user.displayName = profileData.displayName || user.name;
    return user;
  }

  // ไม่พบในระบบ — Auto-register เป็น Pending
  var newUserId = autoRegisterLineUser(profileData);
  var pendingUser = {
    id: newUserId,
    name: profileData.displayName || "LINE User",
    role: "รอการอนุมัติ",
    email: "",
    lineUserId: profileData.userId,
    phone: "",
    assignedVillage: "",
    status: "Pending",
    avatarUrl: profileData.pictureUrl || "",
    displayName: profileData.displayName || "LINE User"
  };
  return {
    error: "บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ",
    user: pendingUser
  };
}

/**
 * Auto-register LINE user ที่ยังไม่มีในระบบ โดยสร้างบัญชีด้วย Status = Pending
 */
function autoRegisterLineUser(profileData) {
  setupDatabase();
  var ss = getSpreadsheet();
  if (!ss) return null;
  var usersSheet = ss.getSheetByName(SHEET_USERS) || ss.getSheetByName("Users");
  if (!usersSheet) return null;

  var headers = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0];
  var idxId = headers.indexOf("ID");
  var idxName = headers.indexOf("Name");
  var idxRole = headers.indexOf("Role");
  var idxEmail = headers.indexOf("Email");
  var idxLineUserId = headers.indexOf("LineUserId");
  var idxPhone = headers.indexOf("Phone");
  var idxAssignedVillage = headers.indexOf("AssignedVillage");
  var idxStatus = headers.indexOf("Status");

  // สร้าง ID ใหม่
  var newId = "LINE_" + profileData.userId.substring(0, 8).toUpperCase();
  var timestamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");
  newId = "L" + timestamp;

  var newRow = new Array(headers.length).fill("");
  if (idxId !== -1) newRow[idxId] = newId;
  if (idxName !== -1) newRow[idxName] = profileData.displayName || "LINE User";
  if (idxRole !== -1) newRow[idxRole] = "อสม.";
  if (idxEmail !== -1) newRow[idxEmail] = "";
  if (idxLineUserId !== -1) newRow[idxLineUserId] = profileData.userId;
  if (idxPhone !== -1) newRow[idxPhone] = "";
  if (idxAssignedVillage !== -1) newRow[idxAssignedVillage] = "";
  if (idxStatus !== -1) newRow[idxStatus] = "Pending";

  usersSheet.appendRow(newRow);
  console.log("[AUTO-REGISTER] New LINE user registered:", profileData.userId, "->", newId);
  logActivity("ลงทะเบียน", "Auto-register LINE user รอการอนุมัติ", profileData.userId);
  return newId;
}

// ── DATABASE SETUP ──────────────────────────────────────────
function setupDatabase() {
  var ss = getSpreadsheet();
  if (!ss) return;

  // 1. Data Sheet (Child records)
  var dataSheet = ss.getSheetByName(SHEET_DATA);
  var targetHeaders = [
    "ID", "ชื่อเด็ก", "อายุ", "บ้านเลขที่", "หมู่", "ชื่อหมู่บ้าน",
    "ตำบล", "อำเภอ", "จังหวัด",
    "Latitude", "Longitude", "Hct (%)", "น้ำหนัก (กก.)", "ส่วนสูง (ซม.)",
    "สถานะโภชนาการ", "ได้รับยาเหล็ก", "พฤติกรรมการกินอาหาร", "ปัจจัยสังคมเศรษฐกิจ", "ผู้ดูแล", 
    "คะแนน Hct", "คะแนนน้ำหนัก", "คะแนนยาเหล็ก", "คะแนนอาหาร", "คะแนนสังคม",
    "คะแนนรวม", "ระดับความเสี่ยง", "วันที่กินยาล่าสุด", "หมายเหตุ", "Active"
  ];
  if (!dataSheet) {
    dataSheet = ss.insertSheet(SHEET_DATA);
    dataSheet.appendRow(targetHeaders);
    dataSheet.getRange(1, 1, 1, targetHeaders.length).setFontWeight("bold").setBackground("#e2e8f0");
  } else {
    // Check for missing columns and append at the end using aliases
    var lastCol = dataSheet.getLastColumn();
    if (lastCol > 0) {
      var currentHeaders = dataSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      targetHeaders.forEach(function(h) {
        var aliases = HEADER_MAPPING[h] || [h];
        var exists = aliases.some(function(alias) { return currentHeaders.indexOf(alias) !== -1; });
        if (!exists) {
          var newCol = dataSheet.getLastColumn() + 1;
          dataSheet.getRange(1, newCol).setValue(h).setFontWeight("bold").setBackground("#e2e8f0");
        }
      });
    } else {
      dataSheet.appendRow(targetHeaders);
      dataSheet.getRange(1, 1, 1, targetHeaders.length).setFontWeight("bold").setBackground("#e2e8f0");
    }
  }

  // 2. Activity Log Sheet
  var logSheet = ss.getSheetByName(SHEET_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_LOG);
    var headers = ["Timestamp", "User", "Action", "Details"];
    logSheet.appendRow(headers);
    logSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
  }

  // 3. VHV / VHV Info Sheet (อสม.)
  var aorSheet = ss.getSheetByName(SHEET_AOR);
  if (!aorSheet) {
    aorSheet = ss.insertSheet(SHEET_AOR);
    var headers = ["อสม. ID", "ชื่อ-นามสกุล", "เบอร์โทรศัพท์", "LINE Token"];
    aorSheet.appendRow(headers);
    aorSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
    // Append dummy VHV
    aorSheet.appendRow(["AOR001", "สมหญิง รักดี", "081-234-5678", ""]);
  }

  // 4. Medicine Log Sheet
  var medSheet = ss.getSheetByName(SHEET_MED);
  if (!medSheet) {
    medSheet = ss.insertSheet(SHEET_MED);
    var headers = ["Log ID", "Child ID", "Date", "Taken", "VHV ID", "Time", "Notes"];
    medSheet.appendRow(headers);
    medSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
  }

  // 5. Users Database Sheet
  var usersSheet = ss.getSheetByName(SHEET_USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(SHEET_USERS);
    var headers = ["ID", "Name", "Role", "Email", "LineUserId", "Phone", "AssignedVillage", "Status"];
    usersSheet.appendRow(headers);
    usersSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
    
    // Seed initial users
    var initialUsers = [
      ["ST001", "นพ. สมชาย รักดี", "เจ้าหน้าที่ รพ.", "staff1@example.com", "", "081-111-2222", "ทั้งหมด", "Active"],
      ["ST002", "พยาบาล สมศรี สุขใจ", "เจ้าหน้าที่ รพ.", "staff2@example.com", "", "082-222-3333", "ทั้งหมด", "Active"],
      ["AOR001", "อสม. สมใจ ชุมชน", "อสม.", "", "U111122223333", "083-333-4444", "บ้านคลองหาด", "Active"],
      ["AOR002", "อสม. บุญมี รักถิ่น", "อสม.", "", "U444455556666", "084-444-5555", "บ้านเขาดิน", "Active"],
      ["AOR003", "อสม. ดวงใจ ปัญญา", "อสม.", "", "", "085-555-6666", "บ้านป่าช้ากวาง", "Active"]
    ];
    initialUsers.forEach(function(u) { usersSheet.appendRow(u); });
  }
}

// ── GET DATA ────────────────────────────────────────────────
function getData() {
  setupDatabase();
  var ss = getSpreadsheet();
  var dataSheet = ss.getSheetByName(SHEET_DATA);
  var logSheet = ss.getSheetByName(SHEET_LOG);
  
  var result = {
    children: [],
    logs: [],
    villages: {},
    userEmail: Session.getActiveUser().getEmail() || "local-user@example.com",
    sheetName: ss.getName(),
    lastUpdated: Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm")
  };

  // Parse Children
  var dataRows = dataSheet.getDataRange().getValues();
  var headers = dataRows[0];
  
  // Col mappings helper using aliases
  var idxId = getColIndex(headers, "ID");
  var idxName = getColIndex(headers, "ชื่อเด็ก");
  var idxAge = getColIndex(headers, "อายุ");
  var idxHouse = getColIndex(headers, "บ้านเลขที่");
  var idxMoo = getColIndex(headers, "หมู่");
  var idxVillage = getColIndex(headers, "ชื่อหมู่บ้าน");
  var idxTambon = getColIndex(headers, "ตำบล");
  var idxAmphoe = getColIndex(headers, "อำเภอ");
  var idxProvince = getColIndex(headers, "จังหวัด");
  var idxLat = getColIndex(headers, "Latitude");
  var idxLng = getColIndex(headers, "Longitude");
  var idxHct = getColIndex(headers, "Hct (%)");
  var idxWeight = getColIndex(headers, "น้ำหนัก (กก.)");
  var idxHeight = getColIndex(headers, "ส่วนสูง (ซม.)");
  var idxNutrition = getColIndex(headers, "สถานะโภชนาการ");
  var idxIron = getColIndex(headers, "ได้รับยาเหล็ก");
  var idxFood = getColIndex(headers, "พฤติกรรมการกินอาหาร");
  var idxSocial = getColIndex(headers, "ปัจจัยสังคมเศรษฐกิจ");
  var idxGuardian = getColIndex(headers, "ผู้ดูแล");
  var idxTotalScore = getColIndex(headers, "คะแนนรวม");
  var idxStatus = getColIndex(headers, "ระดับความเสี่ยง");
  var idxLastDate = getColIndex(headers, "วันที่กินยาล่าสุด");
  var idxNotes = getColIndex(headers, "หมายเหตุ");
  var idxActive = getColIndex(headers, "Active");

  for (var i = 1; i < dataRows.length; i++) {
    var row = dataRows[i];
    if (idxActive !== -1 && (row[idxActive] === false || row[idxActive] === "false")) {
      continue;
    }
    
    var child = {
      id: idxId !== -1 ? String(row[idxId]).replace(/\.0$/, '') : "",
      name: idxName !== -1 ? row[idxName] : "",
      age: idxAge !== -1 ? row[idxAge] : "",
      house: idxHouse !== -1 ? String(row[idxHouse]) : "",
      moo: idxMoo !== -1 ? String(row[idxMoo]) : "",
      village: idxVillage !== -1 ? row[idxVillage] : "",
      tambon: idxTambon !== -1 ? row[idxTambon] : "คลองหาด",
      amphoe: idxAmphoe !== -1 ? row[idxAmphoe] : "คลองหาด",
      province: idxProvince !== -1 ? row[idxProvince] : "สระแก้ว",
      lat: idxLat !== -1 && row[idxLat] !== "" ? Number(row[idxLat]) : null,
      lng: idxLng !== -1 && row[idxLng] !== "" ? Number(row[idxLng]) : null,
      hct: idxHct !== -1 && row[idxHct] !== "" ? Number(row[idxHct]) : null,
      weight: idxWeight !== -1 && row[idxWeight] !== "" ? Number(row[idxWeight]) : null,
      height: idxHeight !== -1 && row[idxHeight] !== "" ? Number(row[idxHeight]) : null,
      nutrition: idxNutrition !== -1 ? row[idxNutrition] : "",
      iron: idxIron !== -1 ? row[idxIron] : "ไม่ได้",
      food: idxFood !== -1 ? row[idxFood] : "",
      social: idxSocial !== -1 ? row[idxSocial] : "",
      guardian: idxGuardian !== -1 ? row[idxGuardian] : "",
      totalScore: idxTotalScore !== -1 && row[idxTotalScore] !== "" ? Number(row[idxTotalScore]) : 0,
      status: idxStatus !== -1 ? row[idxStatus] : "เสี่ยงต่ำ",
      lastDate: idxLastDate !== -1 && row[idxLastDate] ? (row[idxLastDate] instanceof Date ? Utilities.formatDate(row[idxLastDate], "Asia/Bangkok", "yyyy-MM-dd") : String(row[idxLastDate])) : "-",
      notes: idxNotes !== -1 ? String(row[idxNotes]) : ""
    };
    result.children.push(child);

    // Aggregate village counts
    if (child.village) {
      if (!result.villages[child.village]) {
        result.villages[child.village] = 0;
      }
      result.villages[child.village]++;
    }
  }

  // Parse Activity Logs (recent 50)
  var logRows = logSheet.getDataRange().getValues();
  var startRow = Math.max(1, logRows.length - 50);
  for (var i = logRows.length - 1; i >= startRow; i--) {
    var row = logRows[i];
    result.logs.push({
      timestamp: row[0] instanceof Date ? Utilities.formatDate(row[0], "Asia/Bangkok", "dd/MM/yyyy HH:mm") : String(row[0]),
      user: row[1],
      action: row[2],
      details: row[3]
    });
  }

  return result;
}

// ── SAVE/EDIT CHILD ─────────────────────────────────────────
function saveChild(childData, userEmail) {
  setupDatabase();
  var ss = getSpreadsheet();
  if (!ss) return { success: false, error: "ไม่สามารถเชื่อมต่อกับ Google Sheets ได้ กรุณาตรวจสอบ Spreadsheet ID ในการตั้งค่า" };
  
  var dataSheet = ss.getSheetByName(SHEET_DATA);
  if (!dataSheet) return { success: false, error: "ไม่พบแผ่นงาน '" + SHEET_DATA + "' ใน Google Sheets" };

  var dataRows = dataSheet.getDataRange().getValues();
  var headers = dataRows[0];

  var idxId = getColIndex(headers, "ID");
  var id = childData.id || "CHILD_" + new Date().getTime();
  
  // 1. Calculate Scores
  // Hct score: <30% = 2, 30-32.9% = 1, >=33% = 0
  var hctVal = Number(childData.hct);
  var hctScore = 0;
  if (hctVal > 0) {
    if (hctVal < 30) hctScore = 2;
    else if (hctVal < 33) hctScore = 1;
  }
  
  // Nutrition score: ผอม = 2, ค่อนข้างผอม = 1, other = 0
  var nutrScore = 0;
  if (childData.nutrition === "ผอม") nutrScore = 2;
  else if (childData.nutrition === "ค่อนข้างผอม") nutrScore = 1;
  
  // Iron score: ไม่เคยได้รับ/ไม่ได้กิน = 2, ไม่สม่ำเสมอ = 1, สม่ำเสมอ = 0 (support "ไม่ได้" as "ไม่เคยได้รับ", "ได้" as "สม่ำเสมอ")
  var ironScore = 0;
  if (childData.iron === "ไม่เคยได้รับ" || childData.iron === "ไม่ได้" || childData.iron === "ได้รับยาแต่ไม่ได้กินยา") ironScore = 2;
  else if (childData.iron === "ไม่สม่ำเสมอ") ironScore = 1;
  
  // Food score: ไม่ได้บริโภค = 2, บางครั้ง = 1, เป็นประจำ = 0
  var foodScore = 0;
  if (childData.food === "ไม่ได้บริโภค") foodScore = 2;
  else if (childData.food === "บางครั้ง") foodScore = 1;
  
  // Social score: ไม่เพียงพอ = 2, ขัดสน = 1, เพียงพอ = 0
  var socialScore = 0;
  if (childData.social === "ไม่เพียงพอ") socialScore = 2;
  else if (childData.social === "ขัดสน") socialScore = 1;
  
  var totalScore = hctScore + nutrScore + ironScore + foodScore + socialScore;
  
  // Determine risk level based on score (matches HTML UI values)
  var status = "เสี่ยงต่ำ";
  if (totalScore >= 4) status = "เสี่ยงสูง";
  else if (totalScore >= 2) status = "เสี่ยงปานกลาง";

  // Build row data mapping using dynamic alias matching
  var rowValues = [];
  headers.forEach(function(h) {
    var canonicalKey = getMappedKey(h);
    switch(canonicalKey) {
      case "WKT":
        if (childData.lng && childData.lat) {
          rowValues.push("POINT (" + childData.lng + " " + childData.lat + ")");
        } else {
          rowValues.push("");
        }
        break;
      case "ID": rowValues.push(id); break;
      case "ชื่อเด็ก": rowValues.push(childData.name); break;
      case "อายุ": rowValues.push(childData.age); break;
      case "บ้านเลขที่": rowValues.push(childData.house); break;
      case "หมู่": rowValues.push(childData.moo); break;
      case "ชื่อหมู่บ้าน": rowValues.push(childData.village); break;
      case "ตำบล": rowValues.push(childData.tambon || "คลองหาด"); break;
      case "อำเภอ": rowValues.push(childData.amphoe || "คลองหาด"); break;
      case "จังหวัด": rowValues.push(childData.province || "สระแก้ว"); break;
      case "Latitude": rowValues.push(childData.lat); break;
      case "Longitude": rowValues.push(childData.lng); break;
      case "Hct (%)": rowValues.push(childData.hct); break;
      case "น้ำหนัก (กก.)": rowValues.push(childData.weight); break;
      case "ส่วนสูง (ซม.)": rowValues.push(childData.height); break;
      case "สถานะโภชนาการ": rowValues.push(childData.nutrition); break;
      case "ได้รับยาเหล็ก": rowValues.push(childData.iron); break;
      case "พฤติกรรมการกินอาหาร": rowValues.push(childData.food); break;
      case "ปัจจัยสังคมเศรษฐกิจ": rowValues.push(childData.social); break;
      case "ผู้ดูแล": rowValues.push(childData.guardian); break;
      case "คะแนน Hct": rowValues.push(hctScore); break;
      case "คะแนนน้ำหนัก": rowValues.push(nutrScore); break;
      case "คะแนนยาเหล็ก": rowValues.push(ironScore); break;
      case "คะแนนอาหาร": rowValues.push(foodScore); break;
      case "คะแนนสังคม": rowValues.push(socialScore); break;
      case "คะแนนรวม": rowValues.push(totalScore); break;
      case "ระดับความเสี่ยง": rowValues.push(status); break;
      case "วันที่กินยาล่าสุด": rowValues.push(childData.lastDate || "-"); break;
      case "หมายเหตุ": rowValues.push(childData.notes || ""); break;
      case "Active": rowValues.push(true); break;
      default: rowValues.push("");
    }
  });

  // Find existing row or append new
  var isEdit = false;
  var targetRowIndex = -1;
  if (idxId !== -1) {
    for (var i = 1; i < dataRows.length; i++) {
      if (String(dataRows[i][idxId]) === String(id)) {
        isEdit = true;
        targetRowIndex = i + 1;
        break;
      }
    }
  }

  if (isEdit && targetRowIndex !== -1) {
    dataSheet.getRange(targetRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    logActivity("แก้ไขข้อมูลเด็ก", "แก้ไขประวัติเด็ก: " + childData.name + " ID: " + id, userEmail);
  } else {
    dataSheet.appendRow(rowValues);
    logActivity("เพิ่มข้อมูลเด็ก", "เพิ่มเด็กใหม่เข้าระบบ: " + childData.name + " ID: " + id, userEmail);
  }

  // LINE Notification Alert if high risk (เสี่ยงสูง)
  if (status === "เสี่ยงสูง") {
    sendLineNotifyAlert(childData.name, childData.village, childData.hct, totalScore);
  }

  return { success: true, id: id };
}

// ── DELETE CHILD (SOFT DELETE) ──────────────────────────────
function deleteChild(childId, userEmail) {
  setupDatabase();
  var ss = getSpreadsheet();
  var dataSheet = ss.getSheetByName(SHEET_DATA);
  var dataRows = dataSheet.getDataRange().getValues();
  var headers = dataRows[0];
  
  var idxId = getColIndex(headers, "ID");
  var idxActive = getColIndex(headers, "Active");
  var idxName = getColIndex(headers, "ชื่อเด็ก");

  var found = false;
  if (idxId !== -1 && idxActive !== -1) {
    for (var i = 1; i < dataRows.length; i++) {
      if (String(dataRows[i][idxId]) === String(childId)) {
        // Set Active column to false
        dataSheet.getRange(i + 1, idxActive + 1).setValue(false);
        var nameVal = idxName !== -1 ? dataRows[i][idxName] : childId;
        logActivity("ลบข้อมูลเด็ก", "ทำการลบ (Soft Delete) เด็ก ID: " + childId + " ชื่อ: " + nameVal, userEmail);
        found = true;
        break;
      }
    }
  }
  return { success: found };
}

// ── UTILITIES: ACTIVITY LOGGER ──────────────────────────────
function logActivity(action, details, userEmail) {
  var ss = getSpreadsheet();
  var logSheet = ss.getSheetByName(SHEET_LOG);
  if (!logSheet) return;
  var user = userEmail || Session.getActiveUser().getEmail() || "local-user@example.com";
  logSheet.appendRow([new Date(), user, action, details]);
}

// ── UTILITIES: LINE NOTIFY ──────────────────────────────────
function sendLineNotifyAlert(name, village, hct, score) {
  var token = getLineToken();
  if (token === "YOUR_LINE_NOTIFY_TOKEN_HERE" || !token) return;

  var message = "\n🚨 [Iron Zero Risk - Alert] 🚨\nพบเด็กความเสี่ยงสูง (ต้องลงเยี่ยมบ้านด่วน!)\n👶 ชื่อ: " + name + "\n📍 หมู่บ้าน: " + village + "\n🩸 Hct: " + hct + "%\n📊 คะแนนความเสี่ยง: " + score + "/10 คะแนน\n──────────────────────\nกรุณาลงพื้นที่ติดตามการกินยาเสริมธาตุเหล็กทันที";

  try {
    UrlFetchApp.fetch("https://notify-api.line.me/api/notify", {
      method: "post",
      headers: { "Authorization": "Bearer " + token },
      payload: { message: message },
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error("LINE Notify failed: ", err);
  }
}

// ── MEDICINE LOG DATABASE PERSISTENCE ──────────────────────
function saveMedicineLog(logData, userEmail) {
  setupDatabase();
  var ss = getSpreadsheet();
  var medSheet = ss.getSheetByName(SHEET_MED);
  if (!medSheet) return { success: false, error: "MedicineLog sheet not found" };
  
  var logId = "MED_" + new Date().getTime();
  var dateStr = logData.date; // e.g. "2026-06-05"
  var timeStr = logData.time; // e.g. "08:30"
  
  // 1. Append log row
  medSheet.appendRow([
    logId,
    logData.childId,
    dateStr,
    logData.taken,
    logData.vhvId || "AOR001",
    timeStr,
    logData.notes || ""
  ]);
  
  // 2. Update child's "วันที่กินยาล่าสุด" in child records
  var dataSheet = ss.getSheetByName(SHEET_DATA);
  var dataRows = dataSheet.getDataRange().getValues();
  var headers = dataRows[0];
  var idxId = getColIndex(headers, "ID");
  var idxLastDate = getColIndex(headers, "วันที่กินยาล่าสุด");
  
  if (idxId !== -1 && idxLastDate !== -1 && logData.taken === "กินยาแล้ว") {
    for (var i = 1; i < dataRows.length; i++) {
      if (String(dataRows[i][idxId]) === String(logData.childId)) {
        // Date can be stored as Date object or string
        var parsedDate = new Date(dateStr + "T" + timeStr);
        dataSheet.getRange(i + 1, idxLastDate + 1).setValue(parsedDate);
        break;
      }
    }
  }
  
  logActivity("บันทึกเวลากินยา", "บันทึกการกินยาสำหรับเด็ก ID: " + logData.childId + " วันที่: " + dateStr + " สถานะ: " + logData.taken, userEmail);
  
  return { success: true, logId: logId };
}

// ── BATCH SAVE/IMPORT CHILDREN ──────────────────────────────
function saveChildrenBatch(childrenList, userEmail) {
  setupDatabase();
  var ss = getSpreadsheet();
  var dataSheet = ss.getSheetByName(SHEET_DATA);
  var dataRows = dataSheet.getDataRange().getValues();
  var headers = dataRows[0];

  var idxId = getColIndex(headers, "ID");
  var idxName = getColIndex(headers, "ชื่อเด็ก");
  
  // Create mapping of existing child ID to row index (1-based)
  var existingMap = {};
  // Create mapping of existing child Name to { id, rowIndex }
  var nameMap = {};
  
  if (idxId !== -1) {
    for (var i = 1; i < dataRows.length; i++) {
      var idVal = String(dataRows[i][idxId]);
      existingMap[idVal] = i + 1;
      
      if (idxName !== -1) {
        var nameVal = String(dataRows[i][idxName]).trim();
        if (nameVal) {
          nameMap[nameVal] = { id: idVal, rowIndex: i + 1 };
        }
      }
    }
  }

  // Pre-calculate scores and build rows
  var newRows = [];
  var editRows = []; // array of { rowNum, values }
  
  var addedCount = 0;
  var updatedCount = 0;

  childrenList.forEach(function(childData) {
    var id = childData.id;
    var targetRowIndex = -1;
    var existingRow = null;
    
    // Fallback: match by Name if no ID is specified
    if (!id && childData.name) {
      var cleanName = String(childData.name).trim();
      if (nameMap[cleanName]) {
        id = nameMap[cleanName].id;
        targetRowIndex = nameMap[cleanName].rowIndex;
      }
    } else if (id) {
      targetRowIndex = existingMap[String(id)] || -1;
    }
    
    if (targetRowIndex !== -1) {
      existingRow = dataRows[targetRowIndex - 1];
    }
    
    // Build merged child record to prevent overwriting existing fields with blanks
    var mergedChild = {};
    if (existingRow) {
      headers.forEach(function(h, idx) {
        var canonicalKey = getMappedKey(h);
        // Find standard property name mapping
        var prop = null;
        for (var p in HEADER_MAPPING) {
          if (HEADER_MAPPING[p].indexOf(canonicalKey) !== -1) {
            // Map keys to match children properties
            if (canonicalKey === "ชื่อเด็ก") prop = "name";
            else if (canonicalKey === "อายุ") prop = "age";
            else if (canonicalKey === "บ้านเลขที่") prop = "house";
            else if (canonicalKey === "หมู่") prop = "moo";
            else if (canonicalKey === "ชื่อหมู่บ้าน") prop = "village";
            else if (canonicalKey === "ตำบล") prop = "tambon";
            else if (canonicalKey === "อำเภอ") prop = "amphoe";
            else if (canonicalKey === "จังหวัด") prop = "province";
            else if (canonicalKey === "Latitude") prop = "lat";
            else if (canonicalKey === "Longitude") prop = "lng";
            else if (canonicalKey === "Hct (%)") prop = "hct";
            else if (canonicalKey === "น้ำหนัก (กก.)") prop = "weight";
            else if (canonicalKey === "ส่วนสูง (ซม.)") prop = "height";
            else if (canonicalKey === "สถานะโภชนาการ") prop = "nutrition";
            else if (canonicalKey === "ได้รับยาเหล็ก") prop = "iron";
            else if (canonicalKey === "พฤติกรรมการกินอาหาร") prop = "food";
            else if (canonicalKey === "ปัจจัยสังคมเศรษฐกิจ") prop = "social";
            else if (canonicalKey === "ผู้ดูแล") prop = "guardian";
            else if (canonicalKey === "หมายเหตุ") prop = "notes";
            break;
          }
        }
        if (prop && idx < existingRow.length) {
          mergedChild[prop] = existingRow[idx];
        }
      });
      mergedChild.totalScore = existingRow[getColIndex(headers, "คะแนนรวม")];
      mergedChild.status = existingRow[getColIndex(headers, "ระดับความเสี่ยง")];
      mergedChild.lastDate = existingRow[getColIndex(headers, "วันที่กินยาล่าสุด")];
    }

    // Override with CSV values
    var fieldsToOverride = ["name", "age", "house", "moo", "village", "tambon", "amphoe", "province", "lat", "lng", "hct", "weight", "height", "nutrition", "iron", "food", "social", "guardian", "notes"];
    fieldsToOverride.forEach(function(field) {
      if (childData[field] !== undefined && childData[field] !== null && childData[field] !== "") {
        mergedChild[field] = childData[field];
      }
    });

    // Generate new unique ID if still not found/provided
    if (!id) {
      id = mergedChild.id || "CHILD_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
    }
    mergedChild.id = id;
    
    // Calculate Scores using merged values
    var hctVal = Number(mergedChild.hct);
    var hctScore = 0;
    if (hctVal > 0) {
      if (hctVal < 30) hctScore = 2;
      else if (hctVal < 33) hctScore = 1;
    }
    
    var nutrScore = 0;
    if (mergedChild.nutrition === "ผอม") nutrScore = 2;
    else if (mergedChild.nutrition === "ค่อนข้างผอม") nutrScore = 1;
    
    var ironScore = 0;
    if (mergedChild.iron === "ไม่เคยได้รับ" || mergedChild.iron === "ไม่ได้" || mergedChild.iron === "ได้รับยาแต่ไม่ได้กินยา" || mergedChild.iron === "ได้แต่ไม่ได้กิน" || mergedChild.iron === "สม่ำเสมอ") {
      if (mergedChild.iron === "ไม่เคยได้รับ" || mergedChild.iron === "ไม่ได้" || mergedChild.iron === "ได้รับยาแต่ไม่ได้กินยา" || mergedChild.iron === "ได้แต่ไม่ได้กิน") ironScore = 2;
      else ironScore = 0;
    } else if (mergedChild.iron === "ไม่สม่ำเสมอ") {
      ironScore = 1;
    }
    
    var foodScore = 0;
    if (mergedChild.food === "ไม่ได้บริโภค") foodScore = 2;
    else if (mergedChild.food === "บางครั้ง") foodScore = 1;
    
    var socialScore = 0;
    if (mergedChild.social === "ไม่เพียงพอ") socialScore = 2;
    else if (mergedChild.social === "ขัดสน") socialScore = 1;
    
    var totalScore = hctScore + nutrScore + ironScore + foodScore + socialScore;
    
    var status = "เสี่ยงต่ำ";
    if (totalScore >= 4) status = "เสี่ยงสูง";
    else if (totalScore >= 2) status = "เสี่ยงปานกลาง";

    // Build row values
    var rowValues = [];
    headers.forEach(function(h) {
      var canonicalKey = getMappedKey(h);
      switch(canonicalKey) {
        case "WKT":
          if (mergedChild.lng && mergedChild.lat) {
            rowValues.push("POINT (" + mergedChild.lng + " " + mergedChild.lat + ")");
          } else {
            rowValues.push("");
          }
          break;
        case "ID": rowValues.push(id); break;
        case "ชื่อเด็ก": rowValues.push(mergedChild.name || ""); break;
        case "อายุ": rowValues.push(mergedChild.age || ""); break;
        case "บ้านเลขที่": rowValues.push(mergedChild.house || ""); break;
        case "หมู่": rowValues.push(mergedChild.moo || ""); break;
        case "ชื่อหมู่บ้าน": rowValues.push(mergedChild.village || ""); break;
        case "ตำบล": rowValues.push(mergedChild.tambon || "คลองหาด"); break;
        case "อำเภอ": rowValues.push(mergedChild.amphoe || "คลองหาด"); break;
        case "จังหวัด": rowValues.push(mergedChild.province || "สระแก้ว"); break;
        case "Latitude": rowValues.push(mergedChild.lat || ""); break;
        case "Longitude": rowValues.push(mergedChild.lng || ""); break;
        case "Hct (%)": rowValues.push(mergedChild.hct || ""); break;
        case "น้ำหนัก (กก.)": rowValues.push(mergedChild.weight || ""); break;
        case "ส่วนสูง (ซม.)": rowValues.push(mergedChild.height || ""); break;
        case "สถานะโภชนาการ": rowValues.push(mergedChild.nutrition || ""); break;
        case "ได้รับยาเหล็ก": rowValues.push(mergedChild.iron || ""); break;
        case "พฤติกรรมการกินอาหาร": rowValues.push(mergedChild.food || ""); break;
        case "ปัจจัยสังคมเศรษฐกิจ": rowValues.push(mergedChild.social || ""); break;
        case "ผู้ดูแล": rowValues.push(mergedChild.guardian || ""); break;
        case "คะแนน Hct": rowValues.push(hctScore); break;
        case "คะแนนน้ำหนัก": rowValues.push(nutrScore); break;
        case "คะแนนยาเหล็ก": rowValues.push(ironScore); break;
        case "คะแนนอาหาร": rowValues.push(foodScore); break;
        case "คะแนนสังคม": rowValues.push(socialScore); break;
        case "คะแนนรวม": rowValues.push(totalScore); break;
        case "ระดับความเสี่ยง": rowValues.push(status); break;
        case "วันที่กินยาล่าสุด": rowValues.push(mergedChild.lastDate || "-"); break;
        case "หมายเหตุ": rowValues.push(mergedChild.notes || ""); break;
        case "Active": rowValues.push(true); break;
        default: rowValues.push("");
      }
    });

    if (targetRowIndex !== -1) {
      editRows.push({ rowNum: targetRowIndex, values: rowValues });
      updatedCount++;
    } else {
      newRows.push(rowValues);
      addedCount++;
    }
  });

  // Apply edits to existing rows
  editRows.forEach(function(item) {
    dataSheet.getRange(item.rowNum, 1, 1, item.values.length).setValues([item.values]);
  });

  // Bulk append new rows
  if (newRows.length > 0) {
    var startRow = dataSheet.getLastRow() + 1;
    dataSheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
  }

  logActivity("นำเข้าข้อมูลเด็ก (Batch)", "นำเข้าเด็กปฐมวัยจำนวน " + childrenList.length + " คน (เพิ่มใหม่ " + addedCount + ", อัปเดต " + updatedCount + ")", userEmail);

  return { success: true, added: addedCount, updated: updatedCount };
}

// ── USER AUTHENTICATION ─────────────────────────────────────
function verifyUserLogin(loginType, identifier, passwordOrToken) {
  setupDatabase();
  var ss = getSpreadsheet();
  if (!ss) return { success: false, error: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้" };
  var usersSheet = ss.getSheetByName(SHEET_USERS) || ss.getSheetByName("Users");
  if (!usersSheet) return { success: false, error: "ไม่พบแผ่นงาน Users" };
  
  var rows = usersSheet.getDataRange().getValues();
  var headers = rows[0];
  var idxId = headers.indexOf("ID");
  var idxName = headers.indexOf("Name");
  var idxRole = headers.indexOf("Role");
  var idxEmail = headers.indexOf("Email");
  var idxLineUserId = headers.indexOf("LineUserId");
  var idxPhone = headers.indexOf("Phone");
  var idxAssignedVillage = headers.indexOf("AssignedVillage");
  var idxStatus = headers.indexOf("Status");
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var status = idxStatus !== -1 ? String(row[idxStatus]).trim() : "Active";
    
    var matched = false;
    if ((loginType === "SSO" || loginType === "MOPH") && idxEmail !== -1 && String(row[idxEmail]).trim().toLowerCase() === String(identifier).trim().toLowerCase()) {
      matched = true;
    } else if ((loginType === "SSO" || loginType === "MOPH") && idxId !== -1 && String(row[idxId]).trim().toLowerCase() === String(identifier).trim().toLowerCase()) {
      matched = true;
    } else if (loginType === "OTP" && idxPhone !== -1 && String(row[idxPhone]).replace(/[- ]/g, "") === String(identifier).replace(/[- ]/g, "")) {
      matched = true;
    } else if (loginType === "LINE" && idxLineUserId !== -1 && String(row[idxLineUserId]).trim() === String(identifier).trim()) {
      matched = true;
    }
    
    if (matched) {
      var user = {
        id: idxId !== -1 ? row[idxId] : "",
        name: idxName !== -1 ? row[idxName] : "",
        role: idxRole !== -1 ? row[idxRole] : "",
        email: idxEmail !== -1 ? row[idxEmail] : "",
        lineUserId: idxLineUserId !== -1 ? row[idxLineUserId] : "",
        phone: idxPhone !== -1 ? row[idxPhone] : "",
        assignedVillage: idxAssignedVillage !== -1 ? row[idxAssignedVillage] : "",
        status: status
      };

      // ตรวจสอบสถานะ - Pending ให้กลับ error พิเศษ
      if (status === "Pending") {
        return { success: false, pending: true, user: user, error: "บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ" };
      }
      // ตรวจสอบสถานะ - Inactive
      if (status === "Inactive" || status === "Disabled") {
        return { success: false, error: "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
      }
      
      logActivity("เข้าสู่ระบบ", "เข้าสู่ระบบผ่าน " + loginType, user.email || user.phone || user.lineUserId);
      return { success: true, user: user };
    }
  }
  
  return { success: false, error: "ไม่พบบัญชีผู้ใช้งานในระบบ (LINE ID: " + identifier + ")" };
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// -- USER MANAGEMENT BACKEND ----------------------------------
function getUsersList() {
  setupDatabase();
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_USERS);
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  var users = [];
  for (var i = 1; i < rows.length; i++) {
    var user = {};
    headers.forEach(function(h, idx) {
      var key = h.charAt(0).toLowerCase() + h.slice(1);
      if (h === "ID") key = "id"; // Fix ID mapping
      user[key] = rows[i][idx];
    });
    // Fallback ID if missing
    if (!user.id) user.id = "U" + i;
    users.push(user);
  }
  return users;
}

function saveUserRecord(userData) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_USERS);
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  var idxId = headers.indexOf("ID");
  var rowValues = headers.map(function(h) {
    var key = h.charAt(0).toLowerCase() + h.slice(1);
    if (h === "ID") key = "id"; // Fix ID mapping
    return userData[key] || "";
  });

  var targetRow = -1;
  if (userData.id) {
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][idxId]) === String(userData.id)) {
        targetRow = i + 1;
        break;
      }
    }
  }

  if (targetRow !== -1) {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    logActivity("แก้ไขผู้ใช้งาน", "อัปเดตข้อมูลผู้ใช้: " + userData.name);
  } else {
    if (idxId !== -1 && !rowValues[idxId]) {
      rowValues[idxId] = "USR" + new Date().getTime();
    }
    sheet.appendRow(rowValues);
    logActivity("เพิ่มผู้ใช้งาน", "เพิ่มผู้ใช้ใหม่: " + userData.name);
  }

  SpreadsheetApp.flush();
  return { success: true };
}
