// ============================================================
// IRON ZERO RISK — GOOGLE APPS SCRIPT BACKEND
// Platform: Google Apps Script + Google Sheets
// ============================================================

// Configuration via PropertiesService
function getSpreadsheetId() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty("SPREADSHEET_ID") || "1lpQ502MZlt8sUyOlgirGozD05Gs1N8B6QEJdVxHNoDs";
}

function getSpreadsheet() {
  const id = getSpreadsheetId();
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    console.error("Error opening spreadsheet: ", e);
    return null;
  }
}

const SHEET_DATA = "ข้อมูลเด็ก";
const SHEET_LOG  = "ActivityLog";
const SHEET_AOR  = "AOR";
const SHEET_MED  = "MedicineLog";
const SHEET_USERS = "Users";

// Default LINE Notify Token (User can update in script or via UI)
function getLineToken() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty("LINE_TOKEN") || "YOUR_LINE_NOTIFY_TOKEN_HERE";
}

function getSystemSettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    lineToken: getLineToken(),
    spreadsheetId: getSpreadsheetId(),
    lineClientId: props.getProperty("LINE_CLIENT_ID") || "",
    lineClientSecret: props.getProperty("LINE_CLIENT_SECRET") || "",
    lineRedirectUri: props.getProperty("LINE_REDIRECT_URI") || ""
  };
}

function saveSystemSettings(settings) {
  const props = PropertiesService.getScriptProperties();
  if (settings.lineToken !== undefined) {
    props.setProperty("LINE_TOKEN", settings.lineToken);
  }
  if (settings.spreadsheetId !== undefined) {
    props.setProperty("SPREADSHEET_ID", settings.spreadsheetId);
  }
  if (settings.lineClientId !== undefined) {
    props.setProperty("LINE_CLIENT_ID", settings.lineClientId);
  }
  if (settings.lineClientSecret !== undefined) {
    props.setProperty("LINE_CLIENT_SECRET", settings.lineClientSecret);
  }
  if (settings.lineRedirectUri !== undefined) {
    props.setProperty("LINE_REDIRECT_URI", settings.lineRedirectUri);
  }
  return { success: true };
}

function testLineNotify(token) {
  const message = "\n🔔 [Iron Zero Risk]\nระบบทดสอบการแจ้งเตือนสำเร็จแล้ว!\nเวลา: " + Utilities.formatDate(new Date(), "Asia/Bangkok", "HH:mm:ss");
  try {
    const res = UrlFetchApp.fetch("https://notify-api.line.me/api/notify", {
      method: "post",
      headers: { "Authorization": "Bearer " + token },
      payload: { message: message },
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code === 200) return { success: true };
    return { success: false, error: "HTTP " + code + ": " + res.getContentText() };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

const HEADER_MAPPING = {
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
  const aliases = HEADER_MAPPING[key] || [key];
  for (let i = 0; i < aliases.length; i++) {
    const idx = headers.indexOf(aliases[i]);
    if (idx !== -1) return idx;
  }
  return -1;
}

function getMappedKey(header) {
  for (const key in HEADER_MAPPING) {
    if (HEADER_MAPPING[key].indexOf(header) !== -1) {
      return key;
    }
  }
  return header;
}

// ── GET ENTRYPOINT ──────────────────────────────────────────
function doGet(e) {
  let lineUser = null;
  if (e && e.parameter && e.parameter.code) {
    try {
      lineUser = handleLineLoginCallback(e.parameter.code);
    } catch (err) {
      console.error("LINE Login failed:", err);
    }
  }
  
  const template = HtmlService.createTemplateFromFile("Index");
  template.lineUser = lineUser ? JSON.stringify(lineUser) : "null";
  
  return template.evaluate()
    .setTitle("Iron Zero Risk — ระบบติดตามสุขภาพเด็ก")
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

function handleLineLoginCallback(code) {
  const settings = getSystemSettings();
  const clientId = settings.lineClientId;
  const clientSecret = settings.lineClientSecret;
  const redirectUri = settings.lineRedirectUri || ScriptApp.getService().getUrl();
  
  if (!clientId || !clientSecret) {
    console.warn("LINE Credentials not set in System Settings");
    return null;
  }
  
  const tokenUrl = "https://api.line.me/oauth2/v2.1/token";
  const payload = {
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  };
  
  const options = {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: Object.keys(payload).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(payload[k])).join("&"),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(tokenUrl, options);
  const tokenData = JSON.parse(response.getContentText());
  
  if (tokenData.error) {
    console.error("LINE Token exchange error:", tokenData.error_description);
    return null;
  }
  
  const accessToken = tokenData.access_token;
  
  // Fetch profile
  const profileUrl = "https://api.line.me/v2/profile";
  const profileResponse = UrlFetchApp.fetch(profileUrl, {
    method: "get",
    headers: { "Authorization": "Bearer " + accessToken },
    muteHttpExceptions: true
  });
  
  const profileData = JSON.parse(profileResponse.getContentText());
  if (profileData.userId) {
    const ss = getSpreadsheet();
    if (!ss) return null;
    let usersSheet = ss.getSheetByName(SHEET_USERS);
    if (!usersSheet) return null;
    
    const rows = usersSheet.getDataRange().getValues();
    const headers = rows[0];
    const idxLineUserId = headers.indexOf("LineUserId");
    const idxId = headers.indexOf("ID");
    const idxName = headers.indexOf("Name");
    const idxRole = headers.indexOf("Role");
    const idxAssignedVillage = headers.indexOf("AssignedVillage");
    const idxStatus = headers.indexOf("Status");
    
    if (idxLineUserId === -1) return null;
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][idxLineUserId]).trim() === profileData.userId) {
        if (idxStatus !== -1 && rows[i][idxStatus] !== "Active") {
          return { error: "User is suspended" };
        }
        return {
          id: idxId !== -1 ? rows[i][idxId] : "",
          name: idxName !== -1 ? rows[i][idxName] : "",
          role: idxRole !== -1 ? rows[i][idxRole] : "",
          lineUserId: profileData.userId,
          assignedVillage: idxAssignedVillage !== -1 ? rows[i][idxAssignedVillage] : "",
          avatarUrl: profileData.pictureUrl || ""
        };
      }
    }
    
    return {
      lineUserId: profileData.userId,
      name: profileData.displayName,
      avatarUrl: profileData.pictureUrl || "",
      unregistered: true
    };
  }
  
  return null;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
    .getContent();
}

// ── DATABASE SETUP ──────────────────────────────────────────
function setupDatabase() {
  const ss = getSpreadsheet();
  if (!ss) return;

  // 1. Data Sheet (Child records)
  let dataSheet = ss.getSheetByName(SHEET_DATA);
  const targetHeaders = [
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
    const lastCol = dataSheet.getLastColumn();
    if (lastCol > 0) {
      const currentHeaders = dataSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      targetHeaders.forEach(h => {
        const aliases = HEADER_MAPPING[h] || [h];
        const exists = aliases.some(alias => currentHeaders.indexOf(alias) !== -1);
        if (!exists) {
          const newCol = dataSheet.getLastColumn() + 1;
          dataSheet.getRange(1, newCol).setValue(h).setFontWeight("bold").setBackground("#e2e8f0");
        }
      });
    } else {
      dataSheet.appendRow(targetHeaders);
      dataSheet.getRange(1, 1, 1, targetHeaders.length).setFontWeight("bold").setBackground("#e2e8f0");
    }
  }

  // 2. Activity Log Sheet
  let logSheet = ss.getSheetByName(SHEET_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_LOG);
    const headers = ["Timestamp", "User", "Action", "Details"];
    logSheet.appendRow(headers);
    logSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
  }

  // 3. VHV / VHV Info Sheet (อสม.)
  let aorSheet = ss.getSheetByName(SHEET_AOR);
  if (!aorSheet) {
    aorSheet = ss.insertSheet(SHEET_AOR);
    const headers = ["อสม. ID", "ชื่อ-นามสกุล", "เบอร์โทรศัพท์", "LINE Token"];
    aorSheet.appendRow(headers);
    aorSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
    // Append dummy VHV
    aorSheet.appendRow(["AOR001", "สมหญิง รักดี", "081-234-5678", ""]);
  }

  // 4. Medicine Log Sheet
  let medSheet = ss.getSheetByName(SHEET_MED);
  if (!medSheet) {
    medSheet = ss.insertSheet(SHEET_MED);
    const headers = ["Log ID", "Child ID", "Date", "Taken", "VHV ID", "Time", "Notes"];
    medSheet.appendRow(headers);
    medSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
  }

  // 5. Users Database Sheet
  let usersSheet = ss.getSheetByName(SHEET_USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(SHEET_USERS);
    const headers = ["ID", "Name", "Role", "Email", "LineUserId", "Phone", "AssignedVillage", "Status"];
    usersSheet.appendRow(headers);
    usersSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
    
    // Seed initial users
    const initialUsers = [
      ["ST001", "นพ. สมชาย รักดี", "เจ้าหน้าที่ รพ.", "staff1@example.com", "", "081-111-2222", "ทั้งหมด", "Active"],
      ["ST002", "พยาบาล สมศรี สุขใจ", "เจ้าหน้าที่ รพ.", "staff2@example.com", "", "082-222-3333", "ทั้งหมด", "Active"],
      ["AOR001", "อสม. สมใจ ชุมชน", "อสม.", "", "U111122223333", "083-333-4444", "บ้านคลองหาด", "Active"],
      ["AOR002", "อสม. บุญมี รักถิ่น", "อสม.", "", "U444455556666", "084-444-5555", "บ้านเขาดิน", "Active"],
      ["AOR003", "อสม. ดวงใจ ปัญญา", "อสม.", "", "", "085-555-6666", "บ้านป่าช้ากวาง", "Active"]
    ];
    initialUsers.forEach(u => usersSheet.appendRow(u));
  }
}

// ── GET DATA ────────────────────────────────────────────────
function getData() {
  setupDatabase();
  const ss = getSpreadsheet();
  const dataSheet = ss.getSheetByName(SHEET_DATA);
  const logSheet = ss.getSheetByName(SHEET_LOG);
  
  const result = {
    children: [],
    logs: [],
    villages: {},
    userEmail: Session.getActiveUser().getEmail() || "local-user@example.com",
    sheetName: ss.getName(),
    lastUpdated: Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm")
  };

  // Parse Children
  const dataRows = dataSheet.getDataRange().getValues();
  const headers = dataRows[0];
  
  // Col mappings helper using aliases
  const idxId = getColIndex(headers, "ID");
  const idxName = getColIndex(headers, "ชื่อเด็ก");
  const idxAge = getColIndex(headers, "อายุ");
  const idxHouse = getColIndex(headers, "บ้านเลขที่");
  const idxMoo = getColIndex(headers, "หมู่");
  const idxVillage = getColIndex(headers, "ชื่อหมู่บ้าน");
  const idxTambon = getColIndex(headers, "ตำบล");
  const idxAmphoe = getColIndex(headers, "อำเภอ");
  const idxProvince = getColIndex(headers, "จังหวัด");
  const idxLat = getColIndex(headers, "Latitude");
  const idxLng = getColIndex(headers, "Longitude");
  const idxHct = getColIndex(headers, "Hct (%)");
  const idxWeight = getColIndex(headers, "น้ำหนัก (กก.)");
  const idxHeight = getColIndex(headers, "ส่วนสูง (ซม.)");
  const idxNutrition = getColIndex(headers, "สถานะโภชนาการ");
  const idxIron = getColIndex(headers, "ได้รับยาเหล็ก");
  const idxFood = getColIndex(headers, "พฤติกรรมการกินอาหาร");
  const idxSocial = getColIndex(headers, "ปัจจัยสังคมเศรษฐกิจ");
  const idxGuardian = getColIndex(headers, "ผู้ดูแล");
  const idxTotalScore = getColIndex(headers, "คะแนนรวม");
  const idxStatus = getColIndex(headers, "ระดับความเสี่ยง");
  const idxLastDate = getColIndex(headers, "วันที่กินยาล่าสุด");
  const idxNotes = getColIndex(headers, "หมายเหตุ");
  const idxActive = getColIndex(headers, "Active");

  for (let i = 1; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (idxActive !== -1 && (row[idxActive] === false || row[idxActive] === "false")) {
      continue;
    }
    
    const child = {
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
  const logRows = logSheet.getDataRange().getValues();
  const startRow = Math.max(1, logRows.length - 50);
  for (let i = logRows.length - 1; i >= startRow; i--) {
    const row = logRows[i];
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
  const ss = getSpreadsheet();
  if (!ss) return { success: false, error: "ไม่สามารถเชื่อมต่อกับ Google Sheets ได้ กรุณาตรวจสอบ Spreadsheet ID ในการตั้งค่า" };
  
  const dataSheet = ss.getSheetByName(SHEET_DATA);
  if (!dataSheet) return { success: false, error: "ไม่พบแผ่นงาน '" + SHEET_DATA + "' ใน Google Sheets" };

  const dataRows = dataSheet.getDataRange().getValues();
  const headers = dataRows[0];

  const idxId = getColIndex(headers, "ID");
  const id = childData.id || "CHILD_" + new Date().getTime();
  
  // 1. Calculate Scores
  // Hct score: <30% = 2, 30-32.9% = 1, >=33% = 0
  const hctVal = Number(childData.hct);
  let hctScore = 0;
  if (hctVal > 0) {
    if (hctVal < 30) hctScore = 2;
    else if (hctVal < 33) hctScore = 1;
  }
  
  // Nutrition score: ผอม = 2, ค่อนข้างผอม = 1, other = 0
  let nutrScore = 0;
  if (childData.nutrition === "ผอม") nutrScore = 2;
  else if (childData.nutrition === "ค่อนข้างผอม") nutrScore = 1;
  
  // Iron score: ไม่เคยได้รับ/ไม่ได้กิน = 2, ไม่สม่ำเสมอ = 1, สม่ำเสมอ = 0 (support "ไม่ได้" as "ไม่เคยได้รับ", "ได้" as "สม่ำเสมอ")
  let ironScore = 0;
  if (childData.iron === "ไม่เคยได้รับ" || childData.iron === "ไม่ได้" || childData.iron === "ได้รับยาแต่ไม่ได้กินยา") ironScore = 2;
  else if (childData.iron === "ไม่สม่ำเสมอ") ironScore = 1;
  
  // Food score: ไม่ได้บริโภค = 2, บางครั้ง = 1, เป็นประจำ = 0
  let foodScore = 0;
  if (childData.food === "ไม่ได้บริโภค") foodScore = 2;
  else if (childData.food === "บางครั้ง") foodScore = 1;
  
  // Social score: ไม่เพียงพอ = 2, ขัดสน = 1, เพียงพอ = 0
  let socialScore = 0;
  if (childData.social === "ไม่เพียงพอ") socialScore = 2;
  else if (childData.social === "ขัดสน") socialScore = 1;
  
  const totalScore = hctScore + nutrScore + ironScore + foodScore + socialScore;
  
  // Determine risk level based on score (matches HTML UI values)
  let status = "เสี่ยงต่ำ";
  if (totalScore >= 4) status = "เสี่ยงสูง";
  else if (totalScore >= 2) status = "เสี่ยงปานกลาง";

  // Build row data mapping using dynamic alias matching
  const rowValues = [];
  headers.forEach(h => {
    const canonicalKey = getMappedKey(h);
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
  let isEdit = false;
  let targetRowIndex = -1;
  if (idxId !== -1) {
    for (let i = 1; i < dataRows.length; i++) {
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
  const ss = getSpreadsheet();
  const dataSheet = ss.getSheetByName(SHEET_DATA);
  const dataRows = dataSheet.getDataRange().getValues();
  const headers = dataRows[0];
  
  const idxId = getColIndex(headers, "ID");
  const idxActive = getColIndex(headers, "Active");
  const idxName = getColIndex(headers, "ชื่อเด็ก");

  let found = false;
  if (idxId !== -1 && idxActive !== -1) {
    for (let i = 1; i < dataRows.length; i++) {
      if (String(dataRows[i][idxId]) === String(childId)) {
        // Set Active column to false
        dataSheet.getRange(i + 1, idxActive + 1).setValue(false);
        const nameVal = idxName !== -1 ? dataRows[i][idxName] : childId;
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
  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName(SHEET_LOG);
  if (!logSheet) return;
  const user = userEmail || Session.getActiveUser().getEmail() || "local-user@example.com";
  logSheet.appendRow([new Date(), user, action, details]);
}

// ── UTILITIES: LINE NOTIFY ──────────────────────────────────
function sendLineNotifyAlert(name, village, hct, score) {
  const token = getLineToken();
  if (token === "YOUR_LINE_NOTIFY_TOKEN_HERE" || !token) return;

  const message = `
🚨 [Iron Zero Risk - Alert] 🚨
พบเด็กความเสี่ยงสูง (ต้องลงเยี่ยมบ้านด่วน!)
👶 ชื่อ: ${name}
📍 หมู่บ้าน: ${village}
🩸 Hct: ${hct}%
📊 คะแนนความเสี่ยง: ${score}/10 คะแนน
──────────────────────
กรุณาลงพื้นที่ติดตามการกินยาเสริมธาตุเหล็กทันที`;

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
  const ss = getSpreadsheet();
  const medSheet = ss.getSheetByName(SHEET_MED);
  if (!medSheet) return { success: false, error: "MedicineLog sheet not found" };
  
  const logId = "MED_" + new Date().getTime();
  const dateStr = logData.date; // e.g. "2026-06-05"
  const timeStr = logData.time; // e.g. "08:30"
  
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
  const dataSheet = ss.getSheetByName(SHEET_DATA);
  const dataRows = dataSheet.getDataRange().getValues();
  const headers = dataRows[0];
  const idxId = getColIndex(headers, "ID");
  const idxLastDate = getColIndex(headers, "วันที่กินยาล่าสุด");
  
  if (idxId !== -1 && idxLastDate !== -1 && logData.taken === "กินยาแล้ว") {
    for (let i = 1; i < dataRows.length; i++) {
      if (String(dataRows[i][idxId]) === String(logData.childId)) {
        // Date can be stored as Date object or string
        const parsedDate = new Date(dateStr + "T" + timeStr);
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
  const ss = getSpreadsheet();
  const dataSheet = ss.getSheetByName(SHEET_DATA);
  const dataRows = dataSheet.getDataRange().getValues();
  const headers = dataRows[0];

  const idxId = getColIndex(headers, "ID");
  const idxName = getColIndex(headers, "ชื่อเด็ก");
  
  // Create mapping of existing child ID to row index (1-based)
  const existingMap = {};
  // Create mapping of existing child Name to { id, rowIndex }
  const nameMap = {};
  
  if (idxId !== -1) {
    for (let i = 1; i < dataRows.length; i++) {
      const idVal = String(dataRows[i][idxId]);
      existingMap[idVal] = i + 1;
      
      if (idxName !== -1) {
        const nameVal = String(dataRows[i][idxName]).trim();
        if (nameVal) {
          nameMap[nameVal] = { id: idVal, rowIndex: i + 1 };
        }
      }
    }
  }

  // Pre-calculate scores and build rows
  const newRows = [];
  const editRows = []; // array of { rowNum, values }
  
  let addedCount = 0;
  let updatedCount = 0;

  childrenList.forEach(childData => {
    let id = childData.id;
    let targetRowIndex = -1;
    let existingRow = null;
    
    // Fallback: match by Name if no ID is specified
    if (!id && childData.name) {
      const cleanName = String(childData.name).trim();
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
    let mergedChild = {};
    if (existingRow) {
      headers.forEach((h, idx) => {
        const canonicalKey = getMappedKey(h);
        // Find standard property name mapping
        let prop = null;
        for (const p in HEADER_MAPPING) {
          if (HEADER_MAPPING[p].includes(canonicalKey)) {
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
    const fieldsToOverride = ["name", "age", "house", "moo", "village", "tambon", "amphoe", "province", "lat", "lng", "hct", "weight", "height", "nutrition", "iron", "food", "social", "guardian", "notes"];
    fieldsToOverride.forEach(field => {
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
    const hctVal = Number(mergedChild.hct);
    let hctScore = 0;
    if (hctVal > 0) {
      if (hctVal < 30) hctScore = 2;
      else if (hctVal < 33) hctScore = 1;
    }
    
    let nutrScore = 0;
    if (mergedChild.nutrition === "ผอม") nutrScore = 2;
    else if (mergedChild.nutrition === "ค่อนข้างผอม") nutrScore = 1;
    
    let ironScore = 0;
    if (mergedChild.iron === "ไม่เคยได้รับ" || mergedChild.iron === "ไม่ได้" || mergedChild.iron === "ได้รับยาแต่ไม่ได้กินยา" || mergedChild.iron === "ได้แต่ไม่ได้กิน" || mergedChild.iron === "สม่ำเสมอ") {
      if (mergedChild.iron === "ไม่เคยได้รับ" || mergedChild.iron === "ไม่ได้" || mergedChild.iron === "ได้รับยาแต่ไม่ได้กินยา" || mergedChild.iron === "ได้แต่ไม่ได้กิน") ironScore = 2;
      else ironScore = 0;
    } else if (mergedChild.iron === "ไม่สม่ำเสมอ") {
      ironScore = 1;
    }
    
    let foodScore = 0;
    if (mergedChild.food === "ไม่ได้บริโภค") foodScore = 2;
    else if (mergedChild.food === "บางครั้ง") foodScore = 1;
    
    let socialScore = 0;
    if (mergedChild.social === "ไม่เพียงพอ") socialScore = 2;
    else if (mergedChild.social === "ขัดสน") socialScore = 1;
    
    const totalScore = hctScore + nutrScore + ironScore + foodScore + socialScore;
    
    let status = "เสี่ยงต่ำ";
    if (totalScore >= 4) status = "เสี่ยงสูง";
    else if (totalScore >= 2) status = "เสี่ยงปานกลาง";

    // Build row values
    const rowValues = [];
    headers.forEach(h => {
      const canonicalKey = getMappedKey(h);
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
  editRows.forEach(item => {
    dataSheet.getRange(item.rowNum, 1, 1, item.values.length).setValues([item.values]);
  });

  // Bulk append new rows
  if (newRows.length > 0) {
    const startRow = dataSheet.getLastRow() + 1;
    dataSheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
  }

  logActivity("นำเข้าข้อมูลเด็ก (Batch)", "นำเข้าเด็กปฐมวัยจำนวน " + childrenList.length + " คน (เพิ่มใหม่ " + addedCount + ", อัปเดต " + updatedCount + ")", userEmail);

  return { success: true, added: addedCount, updated: updatedCount };
}

// ── USER AUTHENTICATION ─────────────────────────────────────
function verifyUserLogin(loginType, identifier, passwordOrToken) {
  setupDatabase();
  const ss = getSpreadsheet();
  if (!ss) return { success: false, error: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้" };
  const usersSheet = ss.getSheetByName(SHEET_USERS);
  if (!usersSheet) return { success: false, error: "ไม่พบแผ่นงาน Users" };
  
  const rows = usersSheet.getDataRange().getValues();
  const headers = rows[0];
  const idxId = headers.indexOf("ID");
  const idxName = headers.indexOf("Name");
  const idxRole = headers.indexOf("Role");
  const idxEmail = headers.indexOf("Email");
  const idxLineUserId = headers.indexOf("LineUserId");
  const idxPhone = headers.indexOf("Phone");
  const idxAssignedVillage = headers.indexOf("AssignedVillage");
  const idxStatus = headers.indexOf("Status");
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (idxStatus !== -1 && row[idxStatus] !== "Active") continue;
    
    let matched = false;
    if (loginType === "SSO" && idxEmail !== -1 && String(row[idxEmail]).trim().toLowerCase() === String(identifier).trim().toLowerCase()) {
      matched = true;
    } else if (loginType === "OTP" && idxPhone !== -1 && String(row[idxPhone]).replace(/[- ]/g, "") === String(identifier).replace(/[- ]/g, "")) {
      matched = true;
    } else if (loginType === "LINE" && idxLineUserId !== -1 && String(row[idxLineUserId]).trim() === String(identifier).trim()) {
      matched = true;
    }
    
    if (matched) {
      const user = {
        id: idxId !== -1 ? row[idxId] : "",
        name: idxName !== -1 ? row[idxName] : "",
        role: idxRole !== -1 ? row[idxRole] : "",
        email: idxEmail !== -1 ? row[idxEmail] : "",
        lineUserId: idxLineUserId !== -1 ? row[idxLineUserId] : "",
        phone: idxPhone !== -1 ? row[idxPhone] : "",
        assignedVillage: idxAssignedVillage !== -1 ? row[idxAssignedVillage] : "",
        status: idxStatus !== -1 ? row[idxStatus] : ""
      };
      
      logActivity("เข้าสู่ระบบ", "เข้าสู่ระบบผ่าน " + loginType, user.email || user.phone || user.lineUserId);
      return { success: true, user: user };
    }
  }
  
  return { success: false, error: "ไม่พบบัญชีผู้ใช้งานในระบบ หรือไม่มีสิทธิ์เข้าถึง" };
}

