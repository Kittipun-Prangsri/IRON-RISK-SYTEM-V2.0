/**
 * IRON ZERO RISK -- CORE JAVASCRIPT
 */

// -- ENVIRONMENT & STORAGE HELPERS ----------------------------
var safeStorage = {
  getItem: function(key) {
    try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : null; } catch (e) { return null; }
  },
  setItem: function(key, val) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, val); } catch (e) { }
  },
  removeItem: function(key) {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch (e) { }
  }
};

// -- CORE UI & AUTH HELPERS (TOP-LEVEL EXPOSURE) ----------------

window.showToast = function(message, type) {
  var type = type || "success";
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.className = "toast " + type;
  
  var iconClass = "fa-check-circle";
  if (type === "error") { iconClass = "fa-exclamation-circle"; }
  else if (type === "info") { iconClass = "fa-info-circle"; }
  
  toast.innerHTML = '<i class="fas ' + iconClass + '"></i><span>' + message + '</span>';
  container.appendChild(toast);
  
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 400);
  }, 3000);
};

/**
 * แสดงหน้า "รอการอนุมัติ" สำหรับผู้ใช้ที่เพิ่งลงทะเบียนใหม่ (Provider ID / LINE / อื่นๆ)
 */
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

window.showPendingApprovalScreen = function(user, message) {
  var loginContainer = document.getElementById('login-container');
  if (!loginContainer) return;
  user = user || {};

  // Badge colour/icon and the identity lines depend on how the user signed in.
  var badge, idLines;
  if (user.providerId) {
    badge = { color: '#008f7a', icon: 'fas fa-user-doctor' };
    idLines = ['Provider ID: ' + user.providerId, user.position, user.hospitalName];
  } else if (user.lineUserId) {
    badge = { color: '#06c755', icon: 'fab fa-line' };
    idLines = ['LINE ID: ' + user.lineUserId];
  } else {
    badge = { color: '#64748b', icon: 'fas fa-user' };
    idLines = [user.email || user.phone];
  }
  var displayName = user.displayName || user.name || 'ผู้ใช้งานใหม่';
  var msg = message || 'บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ';
  var avatarInner = user.avatarUrl
    ? '<img src="' + escapeHtml(user.avatarUrl) + '" style="width:100%;height:100%;object-fit:cover;">'
    : '<div style="width:100%;height:100%;background:' + badge.color + ';display:flex;align-items:center;justify-content:center;"><i class="' + badge.icon + '" style="color:#fff;font-size:36px;"></i></div>';
  var idHtml = idLines.filter(Boolean).map(function(line) {
    return '<p style="margin:4px 0 0;font-size:0.8rem;color:var(--text-muted);">' + escapeHtml(line) + '</p>';
  }).join('');

  loginContainer.innerHTML = [
    '<div class="login-card" style="text-align:center;max-width:440px;">',
    '  <div style="display:flex;flex-direction:column;align-items:center;">',
    '    <div style="width:80px;height:80px;border-radius:50%;overflow:hidden;margin:0 auto 12px;border:3px solid ' + badge.color + ';box-shadow:0 0 0 6px rgba(0,0,0,0.12);">',
    avatarInner,
    '    </div>',
    '    <h2 style="margin:0;font-size:1.1rem;font-weight:600;color:var(--text-primary);">' + escapeHtml(displayName) + '</h2>',
    idHtml,
    '  </div>',
    '  <div style="margin:24px 0;padding:16px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:12px;">',
    '    <i class="fas fa-clock" style="font-size:2rem;color:#eab308;margin-bottom:8px;display:block;"></i>',
    '    <h3 style="margin:0 0 8px;color:#eab308;font-size:1rem;">รอการอนุมัติ</h3>',
    '    <p style="margin:0;font-size:0.85rem;color:var(--text-secondary);line-height:1.5;">' + escapeHtml(msg) + '</p>',
    '  </div>',
    '  <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:20px;">กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดสิทธิ์การใช้งาน<br>หลังจากได้รับการอนุมัติแล้ว ให้กดเข้าสู่ระบบอีกครั้ง</p>',
    '  <button onclick="window.location.href=window.location.pathname" class="btn btn-primary" style="width:100%;">',
    '    <i class="fas fa-arrow-left"></i> กลับหน้าเข้าสู่ระบบ',
    '  </button>',
    '</div>'
  ].join('\n');
};


window.showLoading = function(show, text) {
  var show = (show === undefined) ? true : show;
  var text = text || "กำลังโหลดข้อมูล...";
  var overlay = document.getElementById('loading-overlay');
  document.getElementById('loading-text').textContent = text;
  if (show) { overlay.classList.add('show'); }
  else { overlay.classList.remove('show'); }
};

window.navigate = function(pageId) {
  document.querySelectorAll('.page').forEach(function(page) { page.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(item) { item.classList.remove('active'); });
  
  var targetPage = document.getElementById('page-' + pageId);
  var targetNav = document.getElementById('nav-' + pageId);
  
  if (targetPage) { targetPage.classList.add('active'); }
  if (targetNav) { targetNav.classList.add('active'); }
  
  if (pageId === 'users') { window.refreshUsers(); }

  var pageTitles = {
    dashboard: "Dashboard ภาพรวม",
    children: "ข้อมูลเด็กทั้งหมด",
    risk: "การประเมินความเสี่ยง",
    assessment: "แบบประเมินรายบุคคล",
    nutrition: "สถานะโภชนาการ",
    iron: "ยาธาตุเหล็ก",
    villages: "หมู่บ้าน",
    add: selectedChild ? "แก้ไขข้อมูลเด็ก" : "เพิ่มข้อมูลเด็ก",
    log: "บันทึกกิจกรรม",
    users: "จัดการผู้ใช้งาน",
    settings: "ตั้งค่าระบบ"
  };
  
  document.getElementById('page-title').textContent = pageTitles[pageId] || "Dashboard";
  window.closeSidebar();
  
  setTimeout(function() {
    if (pageId === 'dashboard') { window.renderDashboardCharts(); }
    else if (pageId === 'risk') { window.renderRiskCharts(); }
    else if (pageId === 'nutrition') { window.renderNutritionCharts(); }
  }, 100);
};

window.setSession = function(user) {
  currentUser = user;

  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  
  window.applyUserRolePermissions();
  window.showToast("เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ " + currentUser.name + " 🎉");
  
  window.navigate('dashboard');
  window.refreshData();
};

window.triggerDevLogin = function() {
  var selectedId = document.getElementById('dev-role-selector').value;
  if (!selectedId) {
    window.showToast("กรุณาเลือกบัญชีผู้ใช้จำลอง", "info");
    return;
  }
  
  var user = MOCK_USERS.filter(function(u) { return u.id === selectedId; })[0];
  if (user) {
    window.setSession(user);
  }
};

window.handleSSOLogin = function(provider) {
  if (provider === 'healthid') {
    window.handleHealthIdLogin();
    return;
  }
  if (provider === 'providerid') {
    window.handleProviderIdLogin();
    return;
  }
  if (provider !== 'google') {
    window.showToast("ผู้ให้บริการนี้ยังไม่เปิดใช้งาน กรุณาใช้ Google, Health ID หรือ LINE", "info");
    return;
  }
  window.showLoading(true, "กำลังเชื่อมต่อกับ Google SSO...");
  window.fb.signInGoogle().then(function(res) {
    window.showLoading(false);
    if (res.pending) {
      window.showPendingApprovalScreen(res.user, "บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ");
    } else if (res.success) {
      window.setSession(res.user);
    } else {
      window.showToast(res.error || "ไม่พบสิทธิ์การใช้งานของ Google Account นี้ กรุณาติดต่อผู้ดูแลระบบ", "info");
    }
  }).catch(function(err) {
    window.showLoading(false);
    window.showToast(err && err.message ? err.message : String(err), "error");
  });
};

// -- STATE MANAGEMENT -----------------------------------------
var allChildren = [];
var filteredChildren = [];
var activities = [];
var villagesData = {};
var selectedChild = null;
var currentUser = null;
var charts = {};
var selectedAssessmentChild = null;
var mockGeneratedOTP = "";
var otpTimerInterval = null;

// -- MOCK DATA ------------------------------------------------
var MOCK_USERS = [
  { id: "ST001", name: "นพ. สมชาย รักดี", role: "เจ้าหน้าที่ รพ.", email: "staff1@example.com", lineUserId: "", phone: "0811112222", assignedVillage: "ทั้งหมด", status: "Active" },
  { id: "ST002", name: "พยาบาล สมศรี สุขใจ", role: "เจ้าหน้าที่ รพ.", email: "staff2@example.com", lineUserId: "", phone: "0822223333", assignedVillage: "ทั้งหมด", status: "Active" },
  { id: "AOR001", name: "อสม. สมใจ ชุมชน", role: "อสม.", email: "", lineUserId: "U111122223333", phone: "0833334444", assignedVillage: "บ้านคลองหาด", status: "Active" },
  { id: "AOR002", name: "อสม. บุญมี รักถิ่น", role: "อสม.", email: "", lineUserId: "U444455556666", phone: "0844445555", assignedVillage: "บ้านเขาดิน", status: "Active" },
  { id: "AOR003", name: "อสม. ดวงใจ ปัญญา", role: "อสม.", email: "", lineUserId: "", phone: "0855556666", assignedVillage: "บ้านป่าช้ากวาง", status: "Active" }
];

var SAKAEO_ADDRESS_DATA = {
  "id": 18,
  "name": "สระแก้ว",
  "districts": [
    {
      "id": 2701,
      "name": "เมืองสระแก้ว",
      "sub_districts": [
        { "id": 270101, "name": "สระแก้ว", "zip_code": 27000 },
        { "id": 270102, "name": "บ้านแก้ง", "zip_code": 27000 },
        { "id": 270103, "name": "ศาลาลำดวน", "zip_code": 27000 },
        { "id": 270104, "name": "โคกปี่ฆ้อง", "zip_code": 27000 },
        { "id": 270105, "name": "ท่าแยก", "zip_code": 27000 },
        { "id": 270106, "name": "ท่าเกษม", "zip_code": 27000 },
        { "id": 270108, "name": "สระขวัญ", "zip_code": 27000 },
        { "id": 270111, "name": "หนองบอน", "zip_code": 27000 }
      ]
    },
    {
      "id": 2702,
      "name": "คลองหาด",
      "sub_districts": [
        { "id": 270201, "name": "คลองหาด", "zip_code": 27260 },
        { "id": 270202, "name": "ไทยอุดม", "zip_code": 27260 },
        { "id": 270203, "name": "ซับมะกรูด", "zip_code": 27260 },
        { "id": 270204, "name": "ไทรเดี่ยว", "zip_code": 27260 },
        { "id": 270205, "name": "คลองไก่เถื่อน", "zip_code": 27260 },
        { "id": 270206, "name": "เบญจขร", "zip_code": 27260 },
        { "id": 270207, "name": "ไทรทอง", "zip_code": 27260 }
      ]
    },
    {
      "id": 2703,
      "name": "ตาพระยา",
      "sub_districts": [
        { "id": 270301, "name": "ตาพระยา", "zip_code": 27180 },
        { "id": 270302, "name": "ทัพเสด็จ", "zip_code": 27180 },
        { "id": 270306, "name": "ทัพราช", "zip_code": 27180 },
        { "id": 270307, "name": "ทัพไทย", "zip_code": 27180 },
        { "id": 270309, "name": "โคคลาน", "zip_code": 27180 }
      ]
    },
    {
      "id": 2704,
      "name": "วังน้ำเย็น",
      "sub_districts": [
        { "id": 270401, "name": "วังน้ำเย็น", "zip_code": 27210 },
        { "id": 270403, "name": "ตาหลังใน", "zip_code": 27210 },
        { "id": 270405, "name": "คลองหินปูน", "zip_code": 27210 },
        { "id": 270406, "name": "ทุ่งมหาเจริญ", "zip_code": 27210 }
      ]
    },
    {
      "id": 2705,
      "name": "วัฒนานคร",
      "sub_districts": [
        { "id": 270501, "name": "วัฒนานคร", "zip_code": 27160 },
        { "id": 270502, "name": "ท่าเกวียน", "zip_code": 27160 },
        { "id": 270503, "name": "ผักขะ", "zip_code": 27160 },
        { "id": 270504, "name": "โนนหมากเค็ง", "zip_code": 27160 },
        { "id": 270505, "name": "หนองน้ำใส", "zip_code": 27160 },
        { "id": 270506, "name": "ช่องกุ่ม", "zip_code": 27160 },
        { "id": 270507, "name": "หนองแวง", "zip_code": 27160 },
        { "id": 270508, "name": "แซร์ออ", "zip_code": 27160 },
        { "id": 270509, "name": "หนองหมากฝ้าย", "zip_code": 27160 },
        { "id": 270510, "name": "หนองตะเคียนบอน", "zip_code": 27160 },
        { "id": 270511, "name": "ห้วยโจด", "zip_code": 27160 }
      ]
    },
    {
      "id": 2706,
      "name": "อรัญประเทศ",
      "sub_districts": [
        { "id": 270601, "name": "อรัญประเทศ", "zip_code": 27120 },
        { "id": 270602, "name": "เมืองไผ่", "zip_code": 27120 },
        { "id": 270603, "name": "หันทราย", "zip_code": 27120 },
        { "id": 270604, "name": "คลองน้ำใส", "zip_code": 27120 },
        { "id": 270605, "name": "ท่าข้าม", "zip_code": 27120 },
        { "id": 270606, "name": "ป่าไร่", "zip_code": 27120 },
        { "id": 270607, "name": "ทับพริก", "zip_code": 27120 },
        { "id": 270608, "name": "บ้านใหม่หนองไทร", "zip_code": 27120 },
        { "id": 270609, "name": "ผ่านศึก", "zip_code": 27120 },
        { "id": 270610, "name": "หนองสังข์", "zip_code": 27120 },
        { "id": 270611, "name": "คลองทับจันทร์", "zip_code": 27120 },
        { "id": 270612, "name": "ฟากห้วย", "zip_code": 27120 },
        { "id": 270613, "name": "บ้านด่าน", "zip_code": 27120 }
      ]
    },
    {
      "id": 2707,
      "name": "เขาฉกรรจ์",
      "sub_districts": [
        { "id": 270701, "name": "เขาฉกรรจ์", "zip_code": 27000 },
        { "id": 270702, "name": "หนองหว้า", "zip_code": 27000 },
        { "id": 270703, "name": "พระเพลิง", "zip_code": 27000 },
        { "id": 270704, "name": "เขาสามสิบ", "zip_code": 27000 }
      ]
    },
    {
      "id": 2708,
      "name": "โคกสูง",
      "sub_districts": [
        { "id": 270801, "name": "โคกสูง", "zip_code": 27120 },
        { "id": 270802, "name": "หนองม่วง", "zip_code": 27180 },
        { "id": 270803, "name": "หนองแวง", "zip_code": 27180 },
        { "id": 270804, "name": "โนนหมากมุ่น", "zip_code": 27120 }
      ]
    },
    {
      "id": 2709,
      "name": "วังสมบูรณ์",
      "sub_districts": [
        { "id": 270901, "name": "วังสมบูรณ์", "zip_code": 27250 },
        { "id": 270902, "name": "วังใหม่", "zip_code": 27250 },
        { "id": 270903, "name": "วังทอง", "zip_code": 27250 }
      ]
    }
  ]
};

var KHLONG_HAT_VILLAGES = [
  { name: "บ้านคลองหาด", moo: 1, label: "บ้านคลองหาด (หมู่ 1)" },
  { name: "บ้านเขาผาผึ้ง", moo: 2, label: "บ้านเขาผาผึ้ง (หมู่ 2)" },
  { name: "บ้านป่าช้ากวาง", moo: 3, label: "บ้านป่าช้ากวาง (หมู่ 3)" },
  { name: "บ้านเขาเลื่อม", moo: 4, label: "บ้านเขาเลื่อม (หมู่ 4)" },
  { name: "บ้านคลองหาด", moo: 5, label: "บ้านคลองหาด (หมู่ 5)" },
  { name: "บ้านทับวังวน", moo: 6, label: "บ้านทับวังวน (หมู่ 6)" },
  { name: "บ้านซับมะกรูด", moo: 7, label: "บ้านซับมะกรูด (หมู่ 7)" },
  { name: "บ้านเขาดิน", moo: 8, label: "บ้านเขาดิน (หมู่ 8)" },
  { name: "บ้านเขาเลื่อมใต้", moo: 9, label: "บ้านเขาเลื่อมใต้ (หมู่ 9)" },
  { name: "บ้านไทยพัฒนา", moo: 10, label: "บ้านไทยพัฒนา (หมู่ 10)" },
  { name: "บ้านป่าตะแบก", moo: 11, label: "บ้านป่าตะแบก (หมู่ 11)" },
  { name: "บ้านเขาช่องแคบ", moo: 12, label: "บ้านเขาช่องแคบ (หมู่ 12)" },
  { name: "บ้านคลองหาดพัฒนา", moo: 13, label: "บ้านคลองหาดพัฒนา (หมู่ 13)" }
];

var MOCK_CHILDREN = [
  { id: "CHILD001", name: "ดช.ภวินท์ ศรีสวนแก้ว", age: "4 ปี", house: "77.0", moo: "3.0", village: "บ้านป่าช้ากวาง", tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lat: 13.462987, lng: 102.253093, hct: 35.0, weight: 15.8, height: 103.0, nutrition: "สมส่วน", iron: "ได้", food: "บางครั้ง", social: "ขัดสน", guardian: "สมหญิง", status: "เสี่ยงปานกลาง", lastDate: "-", notes: "" },
  { id: "CHILD002", name: "ดช.หัสดี ศรีดำ", age: "4 ปี", house: "9849.0", moo: "8.0", village: "บ้านเขาดิน", tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lat: 13.452623, lng: 102.33218, hct: 35.0, weight: 19.4, height: 104.0, nutrition: "สมส่วน", iron: "ได้", food: "บางครั้ง", social: "ขัดสน", guardian: "เทวัญ", status: "เสี่ยงปานกลาง", lastDate: "-", notes: "" },
  { id: "CHILD003", name: "ดช.ธารณ์ภัควัฒน์ สุทธินันท์", age: "4 ปี", house: "320.0", moo: "1.0", village: "บ้านคลองหาด", tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lat: 13.453589, lng: 102.299076, hct: 34.0, weight: 13.7, height: 103.0, nutrition: "สมส่วน", iron: "ได้", food: "เป็นประจำ", social: "เพียงพอ", guardian: "เบญจมาศ", status: "เสี่ยงต่ำ", lastDate: "-", notes: "" },
  { id: "CHILD004", name: "ดญ.นิรดา คล้อยตาม", age: "9 เดือน", house: "250.0", moo: "9.0", village: "บ้านเขาเลื่อมใต้", tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lat: 13.4089029, lng: 102.3070586, hct: 36.0, weight: 7.52, height: 69.0, nutrition: "สมส่วน", iron: "ได้", food: "เป็นประจำ", social: "เพียงพอ", guardian: "ณรงค์", status: "เสี่ยงต่ำ", lastDate: "-", notes: "" },
  { id: "CHILD005", name: "ดช.ภูรินทร์ ทองวิจิตร", age: "4 ปี", house: "120.0", moo: "5.0", village: "บ้านคลองหาด", tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lat: 13.4507208, lng: 102.2989702, hct: 35.0, weight: 16.1, height: 98.0, nutrition: "สมส่วน", iron: "ได้", food: "เป็นประจำ", social: "เพียงพอ", guardian: "ลออ", status: "เสี่ยงต่ำ", lastDate: "-", notes: "" },
  { id: "CHILD006", name: "ดญ.สุนีย์พร โพธิ์งาม", age: "4 ปี", house: "100.0", moo: "4.0", village: "บ้านเขาเลื่อม", tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lat: 13.41006, lng: 102.30072, hct: 31.0, weight: 15.2, height: 101.0, nutrition: "สมส่วน", iron: "ได้", food: "บางครั้ง", social: "เพียงพอ", guardian: "นที", status: "เสี่ยงปานกลาง", lastDate: "-", notes: "" },
  { id: "CHILD007", name: "ดญ.ภูรดา แก้วละลัย", age: "4 ปี", house: "129.0", moo: "5.0", village: "บ้านคลองหาด", tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lat: 13.459817, lng: 102.301409, hct: 36.0, weight: 15.2, height: 108.0, nutrition: "สมส่วน", iron: "ได้", food: "เป็นประจำ", social: "เพียงพอ", guardian: "ลออ", status: "เสี่ยงต่ำ", lastDate: "-", notes: "" },
  { id: "CHILD008", name: "ดช.ชินภัทร แก้วละลัย", age: "9 เดือน", house: "129.0", moo: "5.0", village: "บ้านคลองหาด", tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lat: 13.4721432, lng: 102.2568526, hct: 31.0, weight: 8.3, height: 74.0, nutrition: "สมส่วน", iron: "ได้", food: "บางครั้ง", social: "เพียงพอ", guardian: "ลออ", status: "เสี่ยงปานกลาง", lastDate: "-", notes: "" },
  { id: "CHILD009", name: "ดช.ธนดล กางกอน", age: "9 เดือน", house: "67.0", moo: "11.0", village: "บ้านป่าตะแบก", tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lat: 13.4916354, lng: 102.2773734, hct: 34.0, weight: 7.35, height: 68.0, nutrition: "สมส่วน", iron: "ได้", food: "เป็นประจำ", social: "เพียงพอ", guardian: "นฤมล", status: "เสี่ยงต่ำ", lastDate: "-", notes: "" },
  { id: "CHILD010", name: "ดช.ธนวินต์ ธนสัญชัย", age: "4 ปี", house: "4.0", moo: "6.0", village: "บ้านทับวังวน", tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lat: 13.4589002, lng: 102.3052735, hct: 37.0, weight: 14.0, height: 100.0, nutrition: "สมส่วน", iron: "ได้", food: "เป็นประจำ", social: "เพียงพอ", guardian: "รัชฎาภรณ์", status: "เสี่ยงต่ำ", lastDate: "-", notes: "" },
  { id: "CHILD011", name: "ดช.รัชพล สาลีนนท์", age: "9 เดือน", house: "8.0", moo: "6.0", village: "บ้านทับวังวน", tambon: "คลองหาด", amphoe: "คลองหาด", province: "สระแก้ว", lat: 13.4497395, lng: 102.3048127, hct: 30.0, weight: 6.8, height: 68.0, nutrition: "ค่อนข้างผอม", iron: "ได้", food: "ไม่ได้บริโภค", social: "ไม่เพียงพอ", guardian: "สัมฤทธิ์", status: "เสี่ยงสูง", lastDate: "-", notes: "ได้รับยาแต่ไม่ได้กินยา, Hct ก่อนรักษา 30%" }
];

var MOCK_LOGS = [
  { timestamp: "05/06/2025 21:00", user: "local-user@example.com", action: "โหลดข้อมูล", details: "โหลดข้อมูลเด็กเข้าระบบทั้งหมด" },
  { timestamp: "05/06/2025 20:30", user: "local-user@example.com", action: "เพิ่มข้อมูลเด็ก", details: "เพิ่มเด็ก ดช.รัชพล สาลีนนท์" }
];

var CSV_HEADER_MAP = {
  "id": ["ID", "id", "ไอดี", "รหัสเด็ก"],
  "name": ["ชื่อเด็ก", "ชื่อ", "Name", "name", "ชื่อ-นามสกุล"],
  "age": ["อายุ", "Age", "age"],
  "house": ["บ้านเลขที่", "บ้าน", "House", "house", "บ้านเลขที่ตามทะเบียนบ้าน"],
  "moo": ["หมู่", "หมู่ที่", "Moo", "moo"],
  "village": ["ชื่อหมู่บ้าน", "หมู่บ้าน", "village", "Village"],
  "tambon": ["ตำบล", "Subdistrict", "subdistrict", "Tambon", "tambon"],
  "amphoe": ["อำเภอ", "District", "district", "Amphoe", "amphoe"],
  "province": ["จังหวัด", "Province", "province"],
  "lat": ["Lat", "Latitude", "lat", "latitude", "พิกัดละติจูด"],
  "lng": ["Lng", "Longitude", "lng", "longitude", "พิกัดลองจิจูด"],
  "hct": ["Hct", "Hct (%)", "hct", "ผลเลือด Hct"],
  "weight": ["น้ำหนัก(กก.)", "น้ำหนัก (กก.)", "น้ำหนัก", "weight", "Weight"],
  "height": ["ส่วนสูง(ซม.)", "ส่วนสูง (ซม.)", "ส่วนสูง", "height", "Height"],
  "nutrition": ["สถานะโภชนาการ", "โภชนาการ", "nutrition", "Nutrition"],
  "iron": ["ได้รับยาเหล็ก", "ยาเหล็ก", "iron", "Iron", "พฤติกรรมการได้รับยาเสริมธาตุเหล็ก"],
  "food": ["พฤติกรรมการกินอาหาร", "อาหาร", "food", "Food", "พฤติกรรมการบริโภคอาหารที่มีธาตุเหล็กสูง"],
  "social": ["ปัจจัยสังคมเศรษฐกิจ", "สังคม", "social", "Social", "ปัจจัยด้านการดูแลและเศรษฐานะครอบครัว"],
  "guardian": ["ผู้ดูแล", "guardian", "Guardian", "ผู้ปกครอง"],
  "notes": ["หมายเหตุ", "Notes", "notes", "Note", "note"]
};

// -- SYSTEM INITIALIZATION ------------------------------------

window.refreshData = function() {
  window.showLoading(true, "กำลังดึงข้อมูลฐานข้อมูลล่าสุด...");

  window.backend
    .withSuccessHandler(function(data) {
      allChildren = data.children;
      activities = data.logs;
      villagesData = data.villages;

      if (currentUser && currentUser.role === 'อสม.') {
        activities = activities.filter(function(log) {
          return allChildren.some(function(c) { return log.details.indexOf(c.name) !== -1 || log.details.indexOf(c.id) !== -1; }) || log.user === (currentUser.email || currentUser.name);
        });
      }

      var elEmail = document.getElementById('s-email');
      var elSheet = document.getElementById('s-sheet');
      var elUpdated = document.getElementById('s-updated');
      if (elEmail) { elEmail.textContent = data.userEmail; }
      if (elSheet) { elSheet.textContent = data.sheetName; }
      if (elUpdated) { elUpdated.textContent = data.lastUpdated; }

      var elEmailInput = document.getElementById('s-email-input');
      var elSheetIdInput = document.getElementById('s-sheet-id-input');
      var elLastUpdatedAbout = document.getElementById('s-last-updated-about');
      if (elEmailInput) { elEmailInput.value = data.userEmail; }
      if (elSheetIdInput) { elSheetIdInput.value = data.sheetName; }
      if (elLastUpdatedAbout) { elLastUpdatedAbout.textContent = data.lastUpdated; }

      window.updateUI();
      window.showLoading(false);
      window.showToast("รีเฟรชข้อมูลฐานข้อมูลเรียบร้อย ✅");
    })
    .withFailureHandler(function(err) {
      window.showLoading(false);
      window.showToast("รีเฟรชข้อมูลล้มเหลว: " + (err && err.message ? err.message : err), "error");
    })
    .getData();
};

// -- UI UPDATES & FILTERS -------------------------------------

window.updateUI = function() {
  filteredChildren = allChildren.slice();
  
  var bChildren = document.getElementById('badge-children');
  var bLabel = document.getElementById('children-count-label');
  if (bChildren) { bChildren.textContent = allChildren.length; }
  if (bLabel) { bLabel.textContent = "มีเด็กปฐมวัยในระบบทั้งหมด " + allChildren.length + " คน"; }
  
  window.populateFilterOptions();
  window.applyFilters();

  var sEmail = document.getElementById('s-email');
  var sSheet = document.getElementById('s-sheet');
  var sUpdated = document.getElementById('s-updated');
  var sEmailInput = document.getElementById('s-email-input');
  var sSheetIdInput = document.getElementById('s-sheet-id-input');
  var sLastUpdatedAbout = document.getElementById('s-last-updated-about');

  if (sEmailInput && sEmail) { sEmailInput.value = sEmail.textContent; }
  if (sSheetIdInput && sSheet) { sSheetIdInput.value = sSheet.textContent; }
  if (sLastUpdatedAbout && sUpdated) { sLastUpdatedAbout.textContent = sUpdated.textContent; }

  window.loadSystemSettings();

  var isDashboardActive = document.getElementById('page-dashboard') && document.getElementById('page-dashboard').classList.contains('active');
  var isRiskActive = document.getElementById('page-risk') && document.getElementById('page-risk').classList.contains('active');
  var isNutritionActive = document.getElementById('page-nutrition') && document.getElementById('page-nutrition').classList.contains('active');

  if (isDashboardActive) { window.renderDashboardCharts(); }
  if (isRiskActive) { window.renderRiskCharts(); }
  if (isNutritionActive) { window.renderNutritionCharts(); }
};

window.populateFilterOptions = function() {
  var villageSelect = document.getElementById('filter-village');
  if (villageSelect) {
    villageSelect.innerHTML = '<option value="all">ทุกหมู่บ้าน</option>';
    var villagesSet = [];
    allChildren.forEach(function(c) {
      if (c.village && villagesSet.indexOf(c.village) === -1) { villagesSet.push(c.village); }
    });
    villagesSet.forEach(function(v) {
      var opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      villageSelect.appendChild(opt);
    });
  }
  
  var addVillageSelect = document.getElementById('f-village');
  if (addVillageSelect) {
    addVillageSelect.innerHTML = '';
    var defVillages = ["บ้านคลองหาด", "บ้านเขาเลื่อม", "บ้านเขาเลื่อมใต้", "บ้านป่าช้ากวาง", "บ้านเขาดิน", "บ้านป่าตะแบก", "บ้านทับวังวน"];
    var allUniqueVillages = defVillages.slice();
    allChildren.forEach(function(c) {
      if (c.village && allUniqueVillages.indexOf(c.village) === -1) { allUniqueVillages.push(c.village); }
    });
    allUniqueVillages.forEach(function(v) {
      var opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      addVillageSelect.appendChild(opt);
    });
  }

  var assessChildSelect = document.getElementById('f-assess-child-select');
  if (assessChildSelect) {
    assessChildSelect.innerHTML = '<option value="">-- กรุณาเลือกรายชื่อเด็ก --</option>';
    allChildren.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name + " (" + (c.village ? c.village : 'ไม่ระบุหมู่บ้าน') + ")";
      assessChildSelect.appendChild(opt);
    });
  }
};

window.applyFilters = function() {
  var riskFilter = document.getElementById('filter-status').value;
  var villageFilter = document.getElementById('filter-village').value;
  var nutritionFilter = document.getElementById('filter-nutrition').value;
  
  filteredChildren = allChildren.filter(function(c) {
    var mRisk = riskFilter === 'all' || c.status === riskFilter;
    var mVillage = villageFilter === 'all' || c.village === villageFilter;
    var mNutrition = nutritionFilter === 'all' || c.nutrition === nutritionFilter;
    return mRisk && mVillage && mNutrition;
  });
  
  window.renderChildrenTable();
  window.renderDashboardStats();
  window.renderRiskList();
  window.renderNutritionTable();
  window.renderIronTable();
  window.renderVillageList();
  window.renderActivityLog();
};

window.clearFilters = function() {
  document.getElementById('filter-status').value = 'all';
  document.getElementById('filter-village').value = 'all';
  document.getElementById('filter-nutrition').value = 'all';
  window.applyFilters();
};

window.handleGlobalSearch = function(val) {
  var query = val.trim().toLowerCase();
  if (!query) {
    window.applyFilters();
    return;
  }
  
  filteredChildren = allChildren.filter(function(c) { 
    return (c.name || "").toLowerCase().indexOf(query) !== -1 ||
           (c.guardian || "").toLowerCase().indexOf(query) !== -1 ||
           (c.village || "").toLowerCase().indexOf(query) !== -1 ||
           (c.house || "").toLowerCase().indexOf(query) !== -1;
  });
  
  window.renderChildrenTable();
};

// -- RENDERING DATA -------------------------------------------

window.renderChildrenTable = function() {
  var tbody = document.getElementById('tbody-children');
  if (!tbody) { return; }
  tbody.innerHTML = '';
  
  if (filteredChildren.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state"><i class="fas fa-folder-open"></i><p>ไม่พบข้อมูลเด็กปฐมวัย</p></td></tr>';
    return;
  }
  
  filteredChildren.forEach(function(c) {
    var riskClass = c.status === "เสี่ยงสูง" ? "high" : c.status === "เสี่ยงปานกลาง" ? "mid" : "low";
    
    var ironBadgeText = 'ไม่ได้';
    var ironColor = 'var(--accent-red)';
    var ironIcon = 'fa-times-circle';
    if (c.iron === 'สม่ำเสมอ' || c.iron === 'ได้') {
      ironBadgeText = 'สม่ำเสมอ';
      ironColor = 'var(--accent-teal)';
      ironIcon = 'fa-check-circle';
    } else if (c.iron === 'ไม่สม่ำเสมอ') {
      ironBadgeText = 'ไม่สม่ำเสมอ';
      ironColor = 'var(--accent-amber)';
      ironIcon = 'fa-exclamation-circle';
    }
    var ironBadge = '<span style="color:' + ironColor + ';font-weight:600;"><i class="fas ' + ironIcon + '"></i> ' + ironBadgeText + '</span>';
    
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><strong>' + c.name + '</strong></td>' +
                   '<td>' + c.age + '</td>' +
                   '<td>' + c.village + '</td>' +
                   '<td><span class="badge-risk ' + riskClass + '">' + c.status + '</span></td>' +
                   '<td><strong style="color:var(--accent-blue)">' + (c.hct ? c.hct + '%' : '-') + '</strong></td>' +
                   '<td>' + (c.weight || '-') + '</td>' +
                   '<td>' + (c.height || '-') + '</td>' +
                   '<td>' + (c.nutrition || '-') + '</td>' +
                   '<td>' + ironBadge + '</td>' +
                   '<td>' +
                     '<button class="btn btn-secondary btn-sm" onclick="window.showChildDetail(\'' + c.id + '\')"><i class="fas fa-eye"></i></button> ' +
                     '<button class="btn btn-secondary btn-sm" onclick="window.editChild(\'' + c.id + '\')" style="color:var(--accent-teal)"><i class="fas fa-edit"></i></button>' +
                   '</td>';
    tbody.appendChild(tr);
  });
};

window.renderDashboardStats = function() {
  var total = allChildren.length;
  var high = allChildren.filter(function(c) { return c.status === "เสี่ยงสูง"; }).length;
  var mid = allChildren.filter(function(c) { return c.status === "เสี่ยงปานกลาง"; }).length;
  var low = allChildren.filter(function(c) { return c.status === "เสี่ยงต่ำ"; }).length;
  
  var hctSum = 0;
  var hctCount = 0;
  allChildren.forEach(function(c) {
    if (c.hct > 0) { hctSum += c.hct; hctCount++; }
  });
  var hctAvg = hctCount ? (hctSum / hctCount).toFixed(1) : "—";
  
  var ironGot = allChildren.filter(function(c) { return c.iron === "สม่ำเสมอ" || c.iron === "ได้" || c.iron === "ไม่สม่ำเสมอ"; }).length;
  var ironPct = total ? Math.round((ironGot / total) * 100) : 0;
  
  if (document.getElementById('stat-total')) { document.getElementById('stat-total').textContent = total; }
  if (document.getElementById('stat-high')) { document.getElementById('stat-high').textContent = high; }
  if (document.getElementById('stat-mid')) { document.getElementById('stat-mid').textContent = mid; }
  if (document.getElementById('stat-low')) { document.getElementById('stat-low').textContent = low; }
  if (document.getElementById('stat-hct')) { document.getElementById('stat-hct').textContent = hctCount ? hctAvg + "%" : "—"; }
  if (document.getElementById('stat-iron')) { document.getElementById('stat-iron').textContent = ironGot; }
  if (document.getElementById('stat-iron-pct')) { document.getElementById('stat-iron-pct').textContent = "คิดเป็น " + ironPct + "%"; }
  
  if (document.getElementById('iron-pct-label')) { document.getElementById('iron-pct-label').textContent = ironPct + "%"; }
  if (document.getElementById('iron-progress')) { document.getElementById('iron-progress').style.width = ironPct + "%"; }
  
  var tbodyUrgent = document.getElementById('tbody-urgent');
  if (!tbodyUrgent) { return; }
  tbodyUrgent.innerHTML = '';
  
  var urgentCases = allChildren.filter(function(c) { return c.status === "เสี่ยงสูง"; });
  if (urgentCases.length === 0) {
    tbodyUrgent.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-heart"></i><p>ยินดีด้วย! ไม่พบเด็กกลุ่มเสี่ยงสูงในระบบ</p></td></tr>';
    return;
  }
  
  urgentCases.forEach(function(c) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><strong>' + c.name + '</strong></td>' +
                   '<td>' + c.age + '</td>' +
                   '<td>' + c.village + '</td>' +
                   '<td><span class="badge-risk high">เสี่ยงสูง</span></td>' +
                   '<td><strong style="color:var(--accent-red)">' + c.hct + '%</strong></td>' +
                   '<td><span style="color:var(--accent-amber); font-weight:600;">' + c.nutrition + '</span></td>';
    tr.style.cursor = 'pointer';
    tr.onclick = function() { window.showChildDetail(c.id); };
    tbodyUrgent.appendChild(tr);
  });
};

window.renderRiskList = function() {
  var highList = document.getElementById('risk-high-list');
  var midList = document.getElementById('risk-mid-list');
  var lowList = document.getElementById('risk-low-list');
  if (!highList || !midList || !lowList) { return; }
  
  highList.innerHTML = '';
  midList.innerHTML = '';
  lowList.innerHTML = '';
  
  var high = allChildren.filter(function(c) { return c.status === "เสี่ยงสูง"; });
  var mid = allChildren.filter(function(c) { return c.status === "เสี่ยงปานกลาง"; });
  var low = allChildren.filter(function(c) { return c.status === "เสี่ยงต่ำ"; });
  
  if (high.length === 0) { highList.innerHTML = '<div class="empty-state" style="padding:16px;"><p>ไม่มีเด็กกลุ่มเสี่ยงสูง</p></div>'; }
  if (mid.length === 0) { midList.innerHTML = '<div class="empty-state" style="padding:16px;"><p>ไม่มีเด็กกลุ่มเสี่ยงปานกลาง</p></div>'; }
  if (low.length === 0) { lowList.innerHTML = '<div class="empty-state" style="padding:16px;"><p>ไม่มีเด็กกลุ่มเสี่ยงต่ำ</p></div>'; }
  
  high.forEach(function(c) { highList.appendChild(window.createRiskItem(c)); });
  mid.forEach(function(c) { midList.appendChild(window.createRiskItem(c)); });
  low.forEach(function(c) { lowList.appendChild(window.createRiskItem(c)); });
};

window.createRiskItem = function(c) {
  var card = document.createElement('div');
  card.className = 'risk-item-card';
  card.onclick = function() { window.showChildDetail(c.id); };
  card.innerHTML = '<div><div class="risk-item-name">' + c.name + '</div>' +
                   '<div class="risk-item-sub">' + c.village + ' · Hct: ' + (c.hct ? c.hct + '%' : '-') + '</div></div>' +
                   '<i class="fas fa-chevron-right" style="color:var(--text-muted);font-size:12px;"></i>';
  return card;
};

window.renderNutritionTable = function() {
  var tbody = document.getElementById('tbody-nutrition');
  if (!tbody) { return; }
  tbody.innerHTML = '';
  
  if (allChildren.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fas fa-folder-open"></i><p>ไม่พบข้อมูลโภชนาการ</p></td></tr>';
    return;
  }
  
  allChildren.forEach(function(c) {
    var nutritionColor = 'var(--text-primary)';
    if (c.nutrition === 'ผอม') { nutritionColor = 'var(--accent-red)'; }
    else if (c.nutrition === 'ค่อนข้างผอม') { nutritionColor = 'var(--accent-amber)'; }
    else if (c.nutrition === 'สมส่วน') { nutritionColor = 'var(--accent-teal)'; }
    
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><strong>' + c.name + '</strong></td>' +
                   '<td>' + c.age + '</td>' +
                   '<td>' + (c.weight || '-') + '</td>' +
                   '<td>' + (c.height || '-') + '</td>' +
                   '<td><span style="color:' + nutritionColor + '; font-weight:600;">' + (c.nutrition || '-') + '</span></td>';
    tbody.appendChild(tr);
  });
};

window.renderIronTable = function() {
  var total = allChildren.length;
  var ironGot = allChildren.filter(function(c) { return c.iron === "สม่ำเสมอ" || c.iron === "ได้" || c.iron === "ไม่สม่ำเสมอ"; }).length;
  var ironNotGot = allChildren.filter(function(c) { return c.iron === "ไม่เคยได้รับ" || c.iron === "ไม่ได้" || !c.iron; }).length;
  var ironPct = total ? Math.round((ironGot / total) * 100) : 0;
  
  if (document.getElementById('iron-got')) { document.getElementById('iron-got').textContent = ironGot; }
  if (document.getElementById('iron-notgot')) { document.getElementById('iron-notgot').textContent = ironNotGot; }
  if (document.getElementById('iron-coverage')) { document.getElementById('iron-coverage').textContent = ironPct + "%"; }
  
  var tbody = document.getElementById('tbody-iron');
  if (!tbody) { return; }
  tbody.innerHTML = '';
  
  if (allChildren.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-folder-open"></i><p>ไม่พบข้อมูลยาธาตุเหล็ก</p></td></tr>';
    return;
  }
  
  allChildren.forEach(function(c) {
    var ironBadge = '<span class="badge-risk high"><i class="fas fa-times-circle"></i> ไม่เคยได้รับยาเสริมธาตุเหล็กเลย</span>';
    if (c.iron === "สม่ำเสมอ" || c.iron === "ได้") {
      ironBadge = '<span class="badge-risk low"><i class="fas fa-check-circle"></i> ได้รับและกินสม่ำเสมอ</span>';
    } else if (c.iron === "ไม่สม่ำเสมอ") {
      ironBadge = '<span class="badge-risk mid"><i class="fas fa-exclamation-circle"></i> ได้รับแต่กินไม่สม่ำเสมอ &lt; 5 วัน/สัปดาห์</span>';
    } else if (c.iron === "ได้รับยาแต่ไม่ได้กินยา") {
      ironBadge = '<span class="badge-risk high"><i class="fas fa-exclamation-circle"></i> ได้รับยาแต่ไม่ได้กินยา</span>';
    }
      
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><strong>' + c.name + '</strong></td>' +
                   '<td>' + c.age + '</td>' +
                   '<td>' + c.village + '</td>' +
                   '<td>' + (c.guardian || '-') + '</td>' +
                   '<td>' + ironBadge + '</td>' +
                   '<td><strong style="color:var(--accent-blue)">' + (c.hct ? c.hct + '%' : '-') + '</strong></td>' +
                   '<td>' +
                     '<button class="btn btn-primary btn-sm" onclick="window.openMedicineLogModal(\'' + c.id + '\', \'' + c.name.replace(/'/g, "\\'") + '\')" style="padding: 4px 8px; font-size: 11.5px;">' +
                       '<i class="fas fa-pills"></i> บันทึกกินยา' +
                     '</button>' +
                   '</td>';
    tbody.appendChild(tr);
  });
};

window.renderVillageList = function() {
  var container = document.getElementById('village-grid');
  if (!container) { return; }
  container.innerHTML = '';
  
  var villages = {};
  allChildren.forEach(function(c) {
    if (c.village) { villages[c.village] = (villages[c.village] || 0) + 1; }
  });
  
  var vKeys = Object.keys(villages);
  if (vKeys.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>ไม่พบข้อมูลหมู่บ้าน</p></div>';
    return;
  }
  
  vKeys.forEach(function(v) {
    var card = document.createElement('div');
    card.className = 'village-card';
    card.onclick = function() {
      document.getElementById('filter-village').value = v;
      window.navigate('children');
      window.applyFilters();
    };
    card.innerHTML = '<div class="vc-name">' + v + '</div>' +
                     '<div class="vc-count">' + villages[v] + ' <span style="font-size:14px;font-weight:normal;">คน</span></div>' +
                     '<div class="vc-label">จำนวนเด็กในความรับผิดชอบ</div>';
    container.appendChild(card);
  });
};

window.renderActivityLog = function() {
  var tbody = document.getElementById('tbody-log');
  if (!tbody) { return; }
  tbody.innerHTML = '';
  
  if (activities.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state"><i class="fas fa-folder-open"></i><p>ไม่พบประวัติกิจกรรม</p></td></tr>';
    return;
  }
  
  activities.forEach(function(log) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td style="white-space:nowrap;">' + log.timestamp + '</td>' +
                   '<td style="color:var(--accent-teal)">' + log.user + '</td>' +
                   '<td><strong>' + log.action + '</strong></td>' +
                   '<td>' + log.details + '</td>';
    tbody.appendChild(tr);
  });
};

// -- USER MANAGEMENT HANDLERS ---------------------------------
var allUsers = [];

window.openUserModal = function(userId) {
  window.resetUserForm();
  var modal = document.getElementById('modal-user');
  var title = document.getElementById('modal-user-title');
  
  // Populate villages for the dropdown
  var vSelect = document.getElementById('f-user-village');
  vSelect.innerHTML = '<option value="">-- ไม่ระบุ --</option>';
  KHLONG_HAT_VILLAGES.forEach(function(v) {
    var opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = v.label;
    vSelect.appendChild(opt);
  });

  if (userId) {
    var user = allUsers.find(function(u) { return u.id === userId; });
    if (user) {
      title.textContent = "แก้ไขข้อมูลผู้ใช้งาน";
      document.getElementById('f-user-internal-id').value = user.id;
      document.getElementById('f-user-name').value = user.name;
      document.getElementById('f-user-role').value = user.role;
      document.getElementById('f-user-email').value = user.email;
      document.getElementById('f-user-phone').value = user.phone;
      document.getElementById('f-user-village').value = user.assignedVillage;
      document.getElementById('f-user-status').value = user.status;
      document.getElementById('f-user-line-id').value = user.lineUserId || ''; // Store Line ID
      window.toggleUserVillageField();
    }
  } else {
    title.textContent = "เพิ่มผู้ใช้งานใหม่";
  }
  
  if (modal) modal.classList.add('open');
};

window.resetUserForm = function() {
  document.getElementById('f-user-internal-id').value = '';
  document.getElementById('f-user-line-id').value = ''; // Reset Line ID
  document.getElementById('f-user-name').value = '';
  document.getElementById('f-user-role').value = 'เจ้าหน้าที่ รพ.';
  document.getElementById('f-user-email').value = '';
  document.getElementById('f-user-phone').value = '';
  document.getElementById('f-user-village').value = '';
  document.getElementById('f-user-status').value = 'Active';
  window.toggleUserVillageField();
};

window.toggleUserVillageField = function() {
  var role = document.getElementById('f-user-role').value;
  var villageGroup = document.getElementById('user-village-group');
  if (villageGroup) {
    villageGroup.style.display = (role === 'อสม.') ? 'block' : 'none';
  }
};

window.submitUserForm = function() {
  var userData = {
    id: document.getElementById('f-user-internal-id').value || null,
    lineUserId: document.getElementById('f-user-line-id').value || '', // Include Line ID
    name: document.getElementById('f-user-name').value.trim(),
    role: document.getElementById('f-user-role').value,
    email: document.getElementById('f-user-email').value.trim(),
    phone: document.getElementById('f-user-phone').value.trim(),
    assignedVillage: document.getElementById('f-user-village').value,
    status: document.getElementById('f-user-status').value
  };

  if (!userData.name) {
    window.showToast("กรุณากรอกชื่อ-นามสกุล", "error");
    return;
  }

  window.showLoading(true, "กำลังบันทึกข้อมูลผู้ใช้งาน...");

  window.backend
    .withSuccessHandler(function(res) {
      window.showLoading(false);
      if (res.success) {
        window.showToast("บันทึกข้อมูลผู้ใช้งานเรียบร้อยแล้ว ✅");
        window.closeModal('modal-user');
        window.refreshUsers();
      } else {
        window.showToast(res.error, "error");
      }
    })
    .withFailureHandler(function(err) {
      window.showLoading(false);
      window.showToast(err && err.message ? err.message : String(err), "error");
    })
    .saveUserRecord(userData);
};

window.refreshUsers = function() {
  window.showLoading(true, "กำลังดึงรายชื่อผู้ใช้งาน...");
  window.backend
    .withSuccessHandler(function(users) {
      allUsers = users;
      window.renderUsersTable();
      window.showLoading(false);
    })
    .withFailureHandler(function(err) {
      window.showLoading(false);
      window.showToast("ไม่สามารถโหลดรายชื่อได้: " + (err && err.message ? err.message : err), "error");
    })
    .getUsersList();
};

window.renderUsersTable = function(users) {
  var displayUsers = users || allUsers;
  var tbody = document.getElementById('tbody-users');
  var badge = document.getElementById('user-count-badge');
  
  if (badge) {
    badge.textContent = displayUsers.length + " คน";
  }

  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (displayUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>ไม่พบข้อมูลผู้ใช้งาน</p></td></tr>';
    return;
  }
  
  displayUsers.forEach(function(u) {
    var tr = document.createElement('tr');
    var statusClass = (u.status === 'Active') ? 'low' : 'high';
    var contact = (u.email ? '<div><i class="far fa-envelope" style="width:16px"></i> ' + u.email + '</div>' : '') + 
                  (u.phone ? '<div><i class="fas fa-phone-alt" style="width:16px"></i> ' + u.phone + '</div>' : '');
    
    tr.innerHTML = '<td><strong>' + u.name + '</strong></td>' +
                   '<td>' + u.role + '</td>' +
                   '<td>' + (contact || '-') + '</td>' +
                   '<td>' + (u.assignedVillage || 'ทั้งหมด') + '</td>' +
                   '<td><span class="badge-risk ' + statusClass + '">' + u.status + '</span></td>' +
                   '<td style="text-align: center;">' +
                     '<button class="btn btn-secondary btn-sm" onclick="window.openUserModal(\'' + u.id + '\')" title="แก้ไข">' +
                       '<i class="fas fa-edit"></i>' +
                     '</button>' +
                   '</td>';
    tbody.appendChild(tr);
  });
};

window.handleUserSearch = function(val) {
  var query = val.toLowerCase().trim();
  if (!allUsers) return;
  
  var filtered = allUsers.filter(function(u) {
    return (u.name || "").toLowerCase().indexOf(query) !== -1 || 
           (u.email || "").toLowerCase().indexOf(query) !== -1 || 
           (u.phone || "").indexOf(query) !== -1;
  });
  window.renderUsersTable(filtered);
};

// -- CHARTS ---------------------------------------------------

window.getGridColor = function() {
  var isDark = document.body.getAttribute('data-theme') === 'dark';
  return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
};

window.getTextColor = function() {
  var isDark = document.body.getAttribute('data-theme') === 'dark';
  return isDark ? '#8eafc0' : '#64748b';
};

window.renderDashboardCharts = function() {
  var high = allChildren.filter(function(c) { return c.status === "เสี่ยงสูง"; }).length;
  var mid = allChildren.filter(function(c) { return c.status === "เสี่ยงปานกลาง"; }).length;
  var low = allChildren.filter(function(c) { return c.status === "เสี่ยงต่ำ"; }).length;
  
  if (charts.risk) { charts.risk.destroy(); }
  charts.risk = new Chart(document.getElementById('chart-risk'), {
    type: 'doughnut',
    data: {
      labels: ['เสี่ยงสูง', 'เสี่ยงปานกลาง', 'เสี่ยงต่ำ'],
      datasets: [{
        data: [high, mid, low],
        backgroundColor: ['#ff5e6c', '#f5a623', '#00c9a7'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: window.getTextColor(), font: { family: 'Sarabun' } } }
      }
    }
  });

  var nutritionCounts = { 'สมส่วน': 0, 'ค่อนข้างผอม': 0, 'ผอม': 0, 'เริ่มอ้วน': 0, 'อ้วน': 0 };
  allChildren.forEach(function(c) {
    if (nutritionCounts[c.nutrition] !== undefined) { nutritionCounts[c.nutrition]++; }
  });
  
  if (charts.nutrition) { charts.nutrition.destroy(); }
  charts.nutrition = new Chart(document.getElementById('chart-nutrition'), {
    type: 'pie',
    data: {
      labels: Object.keys(nutritionCounts),
      datasets: [{
        data: Object.values(nutritionCounts),
        backgroundColor: ['#00c9a7', '#f5a623', '#ff5e6c', '#a78bfa', '#3e9eff'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: window.getTextColor(), font: { family: 'Sarabun' } } }
      }
    }
  });

  var villagesSet = {};
  allChildren.forEach(function(c) {
    if (c.village) { villagesSet[c.village] = (villagesSet[c.village] || 0) + 1; }
  });
  
  if (charts.village) { charts.village.destroy(); }
  charts.village = new Chart(document.getElementById('chart-village'), {
    type: 'bar',
    data: {
      labels: Object.keys(villagesSet),
      datasets: [{
        label: 'จำนวนเด็ก (คน)',
        data: Object.values(villagesSet),
        backgroundColor: 'rgba(62, 158, 255, 0.8)',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: window.getGridColor() }, ticks: { color: window.getTextColor(), font: { family: 'Sarabun' } } },
        y: { grid: { color: window.getGridColor() }, ticks: { color: window.getTextColor(), font: { family: 'Sarabun' }, stepSize: 1 } }
      }
    }
  });

  var agesSet = { '9 เดือน': 0, '1 ปี': 0, '2 ปี': 0, '3 ปี': 0, '4 ปี': 0, '5 ปี': 0 };
  allChildren.forEach(function(c) {
    if (agesSet[c.age] !== undefined) { agesSet[c.age]++; }
  });
  
  if (charts.age) { charts.age.destroy(); }
  charts.age = new Chart(document.getElementById('chart-age'), {
    type: 'bar',
    data: {
      labels: Object.keys(agesSet),
      datasets: [{
        label: 'จำนวนเด็ก (คน)',
        data: Object.values(agesSet),
        backgroundColor: 'rgba(167, 139, 250, 0.8)',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: window.getGridColor() }, ticks: { color: window.getTextColor(), font: { family: 'Sarabun' } } },
        y: { grid: { color: window.getGridColor() }, ticks: { color: window.getTextColor(), font: { family: 'Sarabun' }, stepSize: 1 } }
      }
    }
  });
};

window.renderRiskCharts = function() {
  var activeChildren = allChildren.filter(function(c) { return c.hct > 0; });
  var labels = activeChildren.map(function(c) { return c.name; });
  var hcts = activeChildren.map(function(c) { return c.hct; });
  var colors = activeChildren.map(function(c) { return c.hct < 33 ? '#ff5e6c' : (c.hct <= 35 ? '#f5a623' : '#00c9a7'); });
  
  if (charts.hctBar) { charts.hctBar.destroy(); }
  charts.hctBar = new Chart(document.getElementById('chart-hct-bar'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Hct (%)',
        data: hcts,
        backgroundColor: colors,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: window.getGridColor() }, ticks: { color: window.getTextColor(), font: { family: 'Sarabun', size: 10 } } },
        y: { min: 20, max: 45, grid: { color: window.getGridColor() }, ticks: { color: window.getTextColor(), font: { family: 'Sarabun' } } }
      }
    }
  });
};

window.renderNutritionCharts = function() {
  var nutritionCounts = { 'สมส่วน': 0, 'ค่อนข้างผอม': 0, 'ผอม': 0, 'เริ่มอ้วน': 0, 'อ้วน': 0 };
  allChildren.forEach(function(c) {
    if (nutritionCounts[c.nutrition] !== undefined) { nutritionCounts[c.nutrition]++; }
  });
  
  if (charts.nutritionDetail) { charts.nutritionDetail.destroy(); }
  charts.nutritionDetail = new Chart(document.getElementById('chart-nutrition-detail'), {
    type: 'pie',
    data: {
      labels: Object.keys(nutritionCounts),
      datasets: [{
        data: Object.values(nutritionCounts),
        backgroundColor: ['#00c9a7', '#f5a623', '#ff5e6c', '#a78bfa', '#3e9eff'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: window.getTextColor(), font: { family: 'Sarabun' } } }
      }
    }
  });

  var weightChildren = allChildren.filter(function(c) { return c.weight > 0; });
  var labels = weightChildren.map(function(c) { return c.name; });
  var weights = weightChildren.map(function(c) { return c.weight; });
  
  if (charts.weight) { charts.weight.destroy(); }
  charts.weight = new Chart(document.getElementById('chart-weight'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'น้ำหนัก (กก.)',
        data: weights,
        backgroundColor: 'rgba(0, 201, 167, 0.7)',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: window.getGridColor() }, ticks: { color: window.getTextColor(), font: { family: 'Sarabun', size: 10 } } },
        y: { grid: { color: window.getGridColor() }, ticks: { color: window.getTextColor(), font: { family: 'Sarabun' } } }
      }
    }
  });
};

// -- MAP & NAVIGATION -----------------------------------------

window.loadMap = function() {
  var mapLoading = document.getElementById('map-loading');
  if (mapLoading) { mapLoading.style.display = 'none'; }
  
  var mapFrame = document.getElementById('map-frame');
  if (mapFrame) {
    var googleMapUrl = "https://www.google.com/maps/d/embed?mid=12gfM7cWidzJQRfA5yXoz16Tj78-0Dfg&ll=13.450266192790611%2C102.29263650000001&z=13";
    mapFrame.src = googleMapUrl;
  }
  window.showToast("แผนที่ชุมชนโหลดสำเร็จ 🗺️", "info");
};

window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('show');
};
window.closeSidebar = function() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
};

window.toggleSidebarCollapse = function() {
  var sidebar = document.getElementById('sidebar');
  var main = document.getElementById('main');
  var icon = document.getElementById('collapse-icon');
  
  sidebar.classList.toggle('collapsed');
  main.classList.toggle('expanded');
  
  if (sidebar.classList.contains('collapsed')) { icon.className = 'fas fa-chevron-right'; }
  else { icon.className = 'fas fa-chevron-left'; }
  
  setTimeout(function() {
    if (document.getElementById('page-dashboard').classList.contains('active')) { window.renderDashboardCharts(); }
    else if (document.getElementById('page-risk').classList.contains('active')) { window.renderRiskCharts(); }
    else if (document.getElementById('page-nutrition').classList.contains('active')) { window.renderNutritionCharts(); }
  }, 310);
};

window.toggleTheme = function() {
  var currentTheme = document.body.getAttribute('data-theme');
  var targetTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', targetTheme);
  
  var icon = document.querySelector('#theme-toggle i');
  if (targetTheme === 'dark') { icon.className = 'fas fa-sun'; }
  else { icon.className = 'fas fa-moon'; }
  
  if (document.getElementById('page-dashboard').classList.contains('active')) { window.renderDashboardCharts(); }
  else if (document.getElementById('page-risk').classList.contains('active')) { window.renderRiskCharts(); }
  else if (document.getElementById('page-nutrition').classList.contains('active')) { window.renderNutritionCharts(); }
};

// -- MODALS & DETAILS -----------------------------------------

window.closeModal = function(modalId) {
  document.getElementById(modalId).classList.remove('open');
  if (modalId === 'modal-confirm') { selectedChild = null; }
};

window.showChildDetail = function(id) {
  var child = allChildren.filter(function(c) { return c.id === id; })[0];
  if (!child) { return; }
  selectedChild = child;
  
  var riskClass = child.status === "เสี่ยงสูง" ? "high" : child.status === "เสี่ยงปานกลาง" ? "mid" : "low";
  var hctClass = child.hct && child.hct < 33 ? "low" : "normal";
  var hctStatusText = child.hct && child.hct < 33 ? "ภาวะซีด (Anemia)" : "ฮีมาโตคริตปกติ";
  
  var modalBody = document.getElementById('modal-detail-body');
  modalBody.innerHTML = '<div class="hct-indicator ' + hctClass + '">' +
                        '<i class="fas fa-tint"></i>' +
                        '<span>ผลตรวจเลือด Hct: ' + (child.hct ? child.hct + '%' : '-') + ' (' + hctStatusText + ')</span></div>' +
                        '<div style="margin-top:14px;">' +
                        '<div class="detail-row"><span class="detail-label">ชื่อเด็ก</span><span class="detail-value">' + child.name + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">อายุ</span><span class="detail-value">' + child.age + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">บ้านเลขที่</span><span class="detail-value">' + (child.house || '-') + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">หมู่</span><span class="detail-value">' + (child.moo || '-') + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">หมู่บ้าน</span><span class="detail-value">' + (child.village || '-') + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">ระดับความเสี่ยง</span><span class="detail-value"><span class="badge-risk ' + riskClass + '">' + child.status + '</span></span></div>' +
                        '<div class="detail-row"><span class="detail-label">พิกัดแผนที่</span><span class="detail-value">' + (child.lat && child.lng ? child.lat + ', ' + child.lng : 'ไม่ได้ระบุ') + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">น้ำหนัก</span><span class="detail-value">' + (child.weight ? child.weight + ' กก.' : '-') + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">ส่วนสูง</span><span class="detail-value">' + (child.height ? child.height + ' ซม.' : '-') + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">โภชนาการ</span><span class="detail-value">' + (child.nutrition || '-') + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">กินยาเสริมธาตุเหล็ก</span><span class="detail-value">' + (child.iron || '-') + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">กินอาหารเหล็กสูง</span><span class="detail-value">' + (child.food || '-') + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">สังคมเศรษฐกิจครอบครัว</span><span class="detail-value">' + (child.social || '-') + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">กินยาล่าสุด</span><span class="detail-value">' + child.lastDate + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">ผู้ดูแลเด็ก</span><span class="detail-value">' + (child.guardian || '-') + '</span></div>' +
                        '<div class="detail-row"><span class="detail-label">หมายเหตุ</span><span class="detail-value" style="white-space:pre-wrap;">' + (child.notes || '-') + '</span></div></div>';
  
  document.getElementById('modal-detail').classList.add('open');
};

// -- CRUD OPERATIONS ------------------------------------------

window.resetForm = function() {
  document.getElementById('edit-child-id').value = '';
  document.getElementById('f-name').value = '';
  document.getElementById('f-age').value = '4 ปี';
  document.getElementById('f-province').value = 'สระแก้ว';
  document.getElementById('f-amphoe').value = 'คลองหาด';
  document.getElementById('f-amphoe').dispatchEvent(new Event('change'));
  document.getElementById('f-tambon').value = 'คลองหาด';
  document.getElementById('f-tambon').dispatchEvent(new Event('change'));
  document.getElementById('f-house').value = '';
  document.getElementById('f-moo').value = '';
  document.getElementById('f-village-text').value = '';
  document.getElementById('f-lat').value = '';
  document.getElementById('f-lng').value = '';
  document.getElementById('f-hct').value = '';
  document.getElementById('f-weight').value = '';
  document.getElementById('f-height').value = '';
  document.getElementById('f-nutrition').selectedIndex = 0;
  document.getElementById('f-iron').selectedIndex = 0;
  document.getElementById('f-food').selectedIndex = 0;
  document.getElementById('f-social').selectedIndex = 0;
  document.getElementById('f-guardian').value = '';
  document.getElementById('f-notes').value = '';
  
  document.getElementById('add-page-title').textContent = "เพิ่มข้อมูลเด็ก";
  document.getElementById('save-btn').innerHTML = '<i class="fas fa-save"></i> บันทึก';
  selectedChild = null;
};

window.editChild = function(id) {
  var child = allChildren.filter(function(c) { return c.id === id; })[0];
  if (!child) { return; }
  selectedChild = child;
  
  document.getElementById('edit-child-id').value = child.id;
  document.getElementById('f-name').value = child.name;
  document.getElementById('f-age').value = child.age;
  document.getElementById('f-province').value = child.province || 'สระแก้ว';
  
  var amphoeVal = child.amphoe || 'คลองหาด';
  var tambonVal = child.tambon || 'คลองหาด';
  
  document.getElementById('f-amphoe').value = amphoeVal;
  document.getElementById('f-amphoe').dispatchEvent(new Event('change'));
  document.getElementById('f-tambon').value = tambonVal;
  document.getElementById('f-tambon').dispatchEvent(new Event('change'));
  
  document.getElementById('f-house').value = child.house;
  document.getElementById('f-moo').value = child.moo;
  
  if (tambonVal === 'คลองหาด') {
    var rawVal = child.village + "|" + String(child.moo).replace(/\.0$/, '');
    document.getElementById('f-village-select').value = rawVal;
    document.getElementById('f-village-select').dispatchEvent(new Event('change'));
  } else {
    document.getElementById('f-village-text').value = child.village;
  }
  
  document.getElementById('f-lat').value = child.lat || '';
  document.getElementById('f-lng').value = child.lng || '';
  document.getElementById('f-hct').value = child.hct || '';
  document.getElementById('f-weight').value = child.weight || '';
  document.getElementById('f-height').value = child.height || '';
  document.getElementById('f-nutrition').value = child.nutrition;
  document.getElementById('f-iron').value = child.iron || 'สม่ำเสมอ';
  document.getElementById('f-food').value = child.food || 'เป็นประจำ';
  document.getElementById('f-social').value = child.social || 'เพียงพอ';
  document.getElementById('f-guardian').value = child.guardian;
  document.getElementById('f-notes').value = child.notes || '';
  
  document.getElementById('add-page-title').textContent = "แก้ไขข้อมูลเด็ก";
  document.getElementById('save-btn').innerHTML = '<i class="fas fa-save"></i> อัปเดตข้อมูล';
  
  window.navigate('add');
};

window.editFromDetail = function() {
  if (!selectedChild) { return; }
  var childId = selectedChild.id;
  window.closeModal('modal-detail');
  window.editChild(childId);
};

window.deleteChild = function(id) {
  var child = allChildren.filter(function(c) { return c.id === id; })[0];
  if (!child) { return; }
  selectedChild = child;
  document.getElementById('confirm-name').textContent = child.name;
  
  var confirmBtn = document.getElementById('confirm-delete-btn');
  confirmBtn.onclick = function() { window.confirmDelete(child.id); };
  document.getElementById('modal-confirm').classList.add('open');
};

window.deleteFromDetail = function() {
  if (!selectedChild) { return; }
  var childId = selectedChild.id;
  window.closeModal('modal-detail');
  window.deleteChild(childId);
};

window.confirmDelete = function(id) {
  window.closeModal('modal-confirm');
  window.showLoading(true, "กำลังลบข้อมูลเด็กออกจากฐานข้อมูล...");
  
  window.backend
    .withSuccessHandler(function(res) {
      window.showLoading(false);
      if (res.success) {
        window.showToast("ลบข้อมูลเด็กเรียบร้อยแล้ว 🗑️");
        window.refreshData();
      } else {
        window.showToast("ลบข้อมูลไม่สำเร็จ", "error");
      }
    })
    .withFailureHandler(function(err) {
      window.showLoading(false);
      window.showToast("เกิดข้อผิดพลาดในการลบ: " + (err && err.message ? err.message : err), "error");
    })
    .deleteChild(id);
};

window.saveChild = function() {
  var name = document.getElementById('f-name').value.trim();
  if (!name) {
    window.showToast("กรุณากรอกชื่อเด็กด้วยครับ", "error");
    return;
  }
  
  var id = document.getElementById('edit-child-id').value;
  var age = document.getElementById('f-age').value;
  var province = document.getElementById('f-province').value;
  var amphoe = document.getElementById('f-amphoe').value;
  var tambon = document.getElementById('f-tambon').value;
  var house = document.getElementById('f-house').value.trim();
  var moo = document.getElementById('f-moo').value.trim();
  
  var village = "";
  if (tambon === 'คลองหาด') {
    var rawVal = document.getElementById('f-village-select').value;
    village = rawVal ? rawVal.split('|')[0] : "";
  } else {
    village = document.getElementById('f-village-text').value.trim();
  }

  var lat = document.getElementById('f-lat').value ? parseFloat(document.getElementById('f-lat').value) : null;
  var lng = document.getElementById('f-lng').value ? parseFloat(document.getElementById('f-lng').value) : null;
  var hct = document.getElementById('f-hct').value ? parseFloat(document.getElementById('f-hct').value) : null;
  var weight = document.getElementById('f-weight').value ? parseFloat(document.getElementById('f-weight').value) : null;
  var height = document.getElementById('f-height').value ? parseFloat(document.getElementById('f-height').value) : null;
  var nutrition = document.getElementById('f-nutrition').value;
  var iron = document.getElementById('f-iron').value;
  var food = document.getElementById('f-food').value;
  var social = document.getElementById('f-social').value;
  var guardian = document.getElementById('f-guardian').value.trim();
  var notes = document.getElementById('f-notes').value.trim();
  
  var data = {
    id: id || null,
    name: name,
    age: age,
    province: province,
    amphoe: amphoe,
    tambon: tambon,
    house: house,
    moo: moo,
    village: village,
    lat: lat,
    lng: lng,
    hct: hct,
    weight: weight,
    height: height,
    nutrition: nutrition,
    iron: iron,
    food: food,
    social: social,
    guardian: guardian,
    notes: notes
  };
  
  window.showLoading(true, "กำลังบันทึกข้อมูลเข้าระบบ...");

  window.backend
    .withSuccessHandler(function(res) {
      window.showLoading(false);
      if (res.success) {
        window.showToast("บันทึกข้อมูลเด็กเรียบร้อยแล้ว ✅");
        window.resetForm();
        window.navigate('children');
        window.refreshData();
      } else {
        window.showToast("บันทึกไม่สำเร็จ", "error");
      }
    })
    .withFailureHandler(function(err) {
      window.showLoading(false);
      window.showToast("เกิดข้อผิดพลาดในการบันทึก: " + (err && err.message ? err.message : err), "error");
    })
    .saveChild(data);
};

// -- EXPORT & IMPORT ------------------------------------------

window.exportCSV = function() {
  if (allChildren.length === 0) {
    window.showToast("ไม่มีข้อมูลให้ออกรายงาน", "error");
    return;
  }
  
  var headers = ["ID", "ชื่อเด็ก", "อายุ", "บ้านเลขที่", "หมู่", "หมู่บ้าน", "Hct (%)", "น้ำหนัก (กก.)", "ส่วนสูง (ซม.)", "โภชนาการ", "มิติที่ 3: ได้รับยาเหล็ก", "มิติที่ 4: การกินอาหารเหล็กสูง", "มิติที่ 5: สังคมเศรษฐกิจครอบครัว", "ผู้ดูแล", "ระดับความเสี่ยง"];
  
  var csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
  csvContent += headers.join(",") + "\n";
  
  allChildren.forEach(function(c) {
    var row = [
      c.id,
      '"' + c.name + '"',
      '"' + c.age + '"',
      '"' + c.house + '"',
      '"' + c.moo + '"',
      '"' + c.village + '"',
      c.hct || "",
      c.weight || "",
      c.height || "",
      '"' + c.nutrition + '"',
      '"' + c.iron + '"',
      '"' + (c.food || "") + '"',
      '"' + (c.social || "") + '"',
      '"' + c.guardian + '"',
      '"' + c.status + '"'
    ];
    csvContent += row.join(",") + "\n";
  });
  
  var encodedUri = encodeURI(csvContent);
  var link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "IronZeroRiskExport_" + new Date().toISOString().slice(0,10) + ".csv");
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
  
  window.showToast("ส่งออกไฟล์ CSV สำเร็จ 📊");
};

window.triggerCSVImport = function() {
  var fileInput = document.getElementById('csv-import-input');
  if (fileInput) {
    fileInput.value = ''; 
    fileInput.click();
  }
};

window.handleCSVImport = function(input) {
  if (!input.files || input.files.length === 0) { return; }
  var file = input.files[0];
  var encoding = document.getElementById('import-encoding').value || 'UTF-8';

  var reader = new FileReader();
  window.showLoading(true, "กำลังอ่านไฟล์ CSV...");

  reader.onload = function(e) {
    var text = e.target.result;
    try {
      var csvRows = window.parseCSV(text);
      if (csvRows.length < 2) {
        window.showLoading(false);
        window.showToast("ไฟล์ CSV ไม่มีข้อมูลเพียงพอหรือหัวตารางว่างเปล่า", "error");
        return;
      }

      var headers = csvRows[0];
      var dataRows = csvRows.slice(1);

      var propMapping = headers.map(function(h) {
        var cleanH = h.trim().replace(/^["']|["']$/g, '');
        for (var prop in CSV_HEADER_MAP) {
          if (CSV_HEADER_MAP[prop].indexOf(cleanH) !== -1) {
            return prop;
          }
        }
        return null;
      });

      var nameIndex = propMapping.indexOf('name');
      if (nameIndex === -1) {
        window.showLoading(false);
        window.showToast("ไม่พบคอลัมน์ 'ชื่อเด็ก' ในไฟล์ CSV กรุณาตรวจสอบหัวตาราง", "error");
        return;
      }

      var childrenToImport = [];
      dataRows.forEach(function(row) {
        if (row.length === 0 || (row.length === 1 && row[0].trim() === '')) { return; }

        var child = {};
        propMapping.forEach(function(prop, index) {
          if (prop && index < row.length) {
            var val = row[index].trim();
            val = val.replace(/^["']|["']$/g, '');
            if (prop === 'lat' || prop === 'lng' || prop === 'hct' || prop === 'weight' || prop === 'height') {
              child[prop] = val !== '' ? Number(val) : null;
            } else {
              child[prop] = val;
            }
          }
        });
        
        if (child.name) { childrenToImport.push(child); }
      });

      if (childrenToImport.length === 0) {
        window.showLoading(false);
        window.showToast("ไม่พบข้อมูลเด็กที่ถูกต้องในไฟล์ CSV", "error");
        return;
      }

      window.showLoading(true, "กำลังนำเข้าข้อมูลเด็ก " + childrenToImport.length + " รายการ เข้าระบบ...");

      window.backend
        .withSuccessHandler(function(res) {
          window.showLoading(false);
          if (res.success) {
            window.showToast("นำเข้าสำเร็จเรียบร้อย! 🎉 (เพิ่มใหม่ " + res.added + " คน, อัปเดต " + res.updated + " คน)");
            window.refreshData();
          } else {
            window.showToast("เกิดข้อผิดพลาดในการนำเข้า: " + res.error, "error");
          }
        })
        .withFailureHandler(function(err) {
          window.showLoading(false);
          window.showToast("ล้มเหลวในการเชื่อมต่อ: " + (err && err.message ? err.message : err), "error");
        })
        .saveChildrenBatch(childrenToImport);
    } catch (err) {
      window.showLoading(false);
      window.showToast("เกิดข้อผิดพลาดในการนำเข้าไฟล์: " + err.message, "error");
    }
  };
  reader.onerror = function() { window.showLoading(false); window.showToast("เกิดข้อผิดพลาดในการอ่านไฟล์ CSV", "error"); };
  reader.readAsText(file, encoding);
};

window.parseCSV = function(text) {
  var lines = [];
  var row = [""];
  var inQuotes = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    var next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') { row[row.length - 1] += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) { row.push(''); }
    else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') { i++; }
      lines.push(row); row = [''];
    } else { row[row.length - 1] += c; }
  }
  if (row.length > 1 || row[0] !== '') { lines.push(row); }
  return lines;
};

// -- ADDRESS & VHV HELPERS ------------------------------------

window.initAddressCascading = function() {
  var provinceSelect = document.getElementById('f-province');
  var amphoeSelect = document.getElementById('f-amphoe');
  var tambonSelect = document.getElementById('f-tambon');
  var vSelectGroup = document.getElementById('f-village-select-group');
  var vTextGroup = document.getElementById('f-village-text-group');
  var vSelect = document.getElementById('f-village-select');
  var vText = document.getElementById('f-village-text');
  var mooInput = document.getElementById('f-moo');

  if (!provinceSelect || !amphoeSelect || !tambonSelect) { return; }
  provinceSelect.innerHTML = '<option value="สระแก้ว" selected>สระแก้ว</option>';

  window.updateAmphoe = function() {
    amphoeSelect.innerHTML = '';
    SAKAEO_ADDRESS_DATA.districts.forEach(function(d) {
      var opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = d.name;
      if (d.name === 'คลองหาด') { opt.selected = true; }
      amphoeSelect.appendChild(opt);
    });
    window.updateTambon();
  };

  window.updateTambon = function() {
    var selectedAmphoeName = amphoeSelect.value;
    var district = SAKAEO_ADDRESS_DATA.districts.filter(function(d) { return d.name === selectedAmphoeName; })[0];
    tambonSelect.innerHTML = '';
    if (district) {
      district.sub_districts.forEach(function(sd) {
        var opt = document.createElement('option');
        opt.value = sd.name;
        opt.textContent = sd.name;
        if (sd.name === 'คลองหาด') { opt.selected = true; }
        tambonSelect.appendChild(opt);
      });
    }
    window.updateVillageView();
  };

  window.updateVillageView = function() {
    var selectedTambon = tambonSelect.value;
    if (selectedTambon === 'คลองหาด') {
      vSelectGroup.style.display = 'block'; vTextGroup.style.display = 'none';
      vSelect.innerHTML = '';
      KHLONG_HAT_VILLAGES.forEach(function(v) {
        var opt = document.createElement('option');
        opt.value = v.name + "|" + v.moo;
        opt.textContent = v.label;
        vSelect.appendChild(opt);
      });
      if (KHLONG_HAT_VILLAGES.length > 0) { mooInput.value = KHLONG_HAT_VILLAGES[0].moo; }
    } else {
      vSelectGroup.style.display = 'none'; vTextGroup.style.display = 'block';
      vText.value = ''; mooInput.value = '';
    }
  };

  amphoeSelect.onchange = window.updateTambon;
  tambonSelect.onchange = window.updateVillageView;
  vSelect.onchange = function() {
    var parts = vSelect.value.split('|');
    if (parts.length === 2) { mooInput.value = parts[1]; }
  };
  window.updateAmphoe();
};

window.openMedicineLogModal = function(childId, childName) {
  document.getElementById('f-med-child-id').value = childId;
  document.getElementById('f-med-child-name').value = childName;
  var today = new Date();
  var dateStr = today.toISOString().split('T')[0];
  document.getElementById('f-med-date').value = dateStr;
  var timeStr = today.toTimeString().split(' ')[0].substring(0, 5);
  document.getElementById('f-med-time').value = timeStr;
  document.getElementById('f-med-taken').value = "กินยาแล้ว";
  document.getElementById('f-med-notes').value = "";
  var vhvInput = document.getElementById('f-med-vhv-id');
  if (vhvInput) {
    if (currentUser) {
      vhvInput.value = currentUser.id; vhvInput.readOnly = true;
      vhvInput.style.opacity = '0.8'; vhvInput.style.background = 'var(--bg-elevated)';
    } else {
      vhvInput.value = "AOR001"; vhvInput.readOnly = false;
      vhvInput.style.opacity = '1'; vhvInput.style.background = '';
    }
  }
  document.getElementById('modal-med').classList.add('open');
};

window.logMedicineFromDetail = function() {
  if (!selectedChild) { return; }
  var childId = selectedChild.id;
  var childName = selectedChild.name;
  window.closeModal('modal-detail');
  window.openMedicineLogModal(childId, childName);
};

window.submitMedicineLog = function() {
  var childId = document.getElementById('f-med-child-id').value;
  var childName = document.getElementById('f-med-child-name').value;
  var date = document.getElementById('f-med-date').value;
  var time = document.getElementById('f-med-time').value;
  var taken = document.getElementById('f-med-taken').value;
  var vhvId = document.getElementById('f-med-vhv-id').value.trim();
  var notes = document.getElementById('f-med-notes').value.trim();

  if (!date || !time) { window.showToast("กรุณากรอกวันที่และเวลาด้วยครับ", "error"); return; }
  var logData = { childId: childId, date: date, time: time, taken: taken, vhvId: vhvId || "AOR001", notes: notes };
  window.showLoading(true, "กำลังบันทึกข้อมูลการกินยา...");

  window.backend
    .withSuccessHandler(function(res) {
      window.showLoading(false);
      if (res.success) { window.showToast("บันทึกการกินยาสำเร็จแล้ว ✅"); window.closeModal('modal-med'); window.refreshData(); }
      else { window.showToast("บันทึกไม่สำเร็จ: " + res.error, "error"); }
    })
    .withFailureHandler(function(err) { window.showLoading(false); window.showToast("เกิดข้อผิดพลาด: " + (err && err.message ? err.message : err), "error"); })
    .saveMedicineLog(logData);
};

// -- ASSESSMENT -----------------------------------------------

window.loadChildForAssessment = function(childId) {
  if (!childId) { window.resetAssessmentForm(); return; }
  selectedAssessmentChild = allChildren.filter(function(c) { return c.id === childId; })[0];
  if (!selectedAssessmentChild) { window.resetAssessmentForm(); return; }

  document.getElementById('assess-sum-name').textContent = selectedAssessmentChild.name || '-';
  document.getElementById('assess-sum-age').textContent = selectedAssessmentChild.age || '-';
  document.getElementById('assess-sum-village').textContent = selectedAssessmentChild.village || '-';
  document.getElementById('assess-sum-guardian').textContent = selectedAssessmentChild.guardian || '-';
  document.getElementById('assess-sum-hct').textContent = selectedAssessmentChild.hct ? selectedAssessmentChild.hct + '%' : 'ไม่มีข้อมูล';
  document.getElementById('assess-sum-nutrition').textContent = selectedAssessmentChild.nutrition || 'ไม่มีข้อมูล';
  document.getElementById('assess-child-summary').style.display = 'block';

  var hctVal = selectedAssessmentChild.hct ? Number(selectedAssessmentChild.hct) : 0;
  var hctScore = 0;
  var hctDisplay = 'ไม่มีข้อมูล';
  if (hctVal > 0) {
    hctDisplay = hctVal + '%';
    if (hctVal < 30) { hctScore = 2; }
    else if (hctVal < 33) { hctScore = 1; }
  }
  document.getElementById('assess-dim1-val').textContent = hctDisplay;
  var dim1Badge = document.getElementById('assess-dim1-points');
  dim1Badge.textContent = hctScore + ' คะแนน';
  if (hctScore === 2) { dim1Badge.style.background = 'rgba(255, 94, 108, 0.12)'; dim1Badge.style.color = 'var(--accent-red)'; }
  else if (hctScore === 1) { dim1Badge.style.background = 'rgba(245, 166, 35, 0.12)'; dim1Badge.style.color = 'var(--accent-amber)'; }
  else { dim1Badge.style.background = 'rgba(0, 201, 167, 0.12)'; dim1Badge.style.color = 'var(--accent-teal)'; }

  var nutrVal = selectedAssessmentChild.nutrition || '';
  var nutrScore = 0;
  if (nutrVal === 'ผอม') { nutrScore = 2; }
  else if (nutrVal === 'ค่อนข้างผอม') { nutrScore = 1; }
  document.getElementById('assess-dim2-val').textContent = nutrVal || 'ไม่มีข้อมูล';
  var dim2Badge = document.getElementById('assess-dim2-points');
  dim2Badge.textContent = nutrScore + ' คะแนน';
  if (nutrScore === 2) { dim2Badge.style.background = 'rgba(255, 94, 108, 0.12)'; dim2Badge.style.color = 'var(--accent-red)'; }
  else if (nutrScore === 1) { dim2Badge.style.background = 'rgba(245, 166, 35, 0.12)'; dim2Badge.style.color = 'var(--accent-amber)'; }
  else { dim2Badge.style.background = 'rgba(0, 201, 167, 0.12)'; dim2Badge.style.color = 'var(--accent-teal)'; }

  var ironVal = selectedAssessmentChild.iron || 'สม่ำเสมอ';
  var foodVal = selectedAssessmentChild.food || 'เป็นประจำ';
  var socialVal = selectedAssessmentChild.social || 'เพียงพอ';
  var ironTarget = ironVal;
  if (ironVal === 'ได้') { ironTarget = 'สม่ำเสมอ'; }
  if (ironVal === 'ไม่ได้' || ironVal === 'ไม่เคยได้รับ') { ironTarget = 'ได้รับยาแต่ไม่ได้กินยา'; }

  window.setRadioChecked('assess-iron', ironTarget);
  window.setRadioChecked('assess-food', foodVal);
  window.setRadioChecked('assess-social', socialVal);
  document.getElementById('f-assess-notes').value = selectedAssessmentChild.notes || '';
  document.getElementById('assess-empty-state').style.display = 'none';
  document.getElementById('assess-form-area').style.display = 'block';
  window.calculateLiveScore();
};

window.setRadioChecked = function(name, value) {
  var radios = document.getElementsByName(name);
  for (var i = 0; i < radios.length; i++) {
    if (radios[i].value === value) { radios[i].checked = true; break; }
  }
};

function getRadioValue(name) {
  var radios = document.getElementsByName(name);
  for (var i = 0; i < radios.length; i++) {
    if (radios[i].checked) { return radios[i].value; }
  }
  return "";
}

window.calculateLiveScore = function() {
  if (!selectedAssessmentChild) { return; }
  var hctVal = selectedAssessmentChild.hct ? Number(selectedAssessmentChild.hct) : 0;
  var hctScore = 0;
  if (hctVal > 0) {
    if (hctVal < 30) { hctScore = 2; }
    else if (hctVal < 33) { hctScore = 1; }
  }
  var nutrScore = 0;
  var nutrVal = selectedAssessmentChild.nutrition || '';
  if (nutrVal === 'ผอม') { nutrScore = 2; }
  else if (nutrVal === 'ค่อนข้างผอม') { nutrScore = 1; }

  var ironChoice = getRadioValue('assess-iron');
  var foodChoice = getRadioValue('assess-food');
  var socialChoice = getRadioValue('assess-social');

  var ironScore = 0;
  if (ironChoice === 'ได้รับยาแต่ไม่ได้กินยา' || ironChoice === 'ไม่เคยได้รับ') { ironScore = 2; }
  else if (ironChoice === 'ไม่สม่ำเสมอ') { ironScore = 1; }
  var foodScore = 0;
  if (foodChoice === 'ไม่ได้บริโภค') { foodScore = 2; }
  else if (foodChoice === 'บางครั้ง') { foodScore = 1; }
  var socialScore = 0;
  if (socialChoice === 'ไม่เพียงพอ') { socialScore = 2; }
  else if (socialChoice === 'ขัดสน') { socialScore = 1; }

  var totalScore = hctScore + nutrScore + ironScore + foodScore + socialScore;
  document.getElementById('assess-score-val').textContent = totalScore;
  var riskBadge = document.getElementById('assess-risk-badge');
  var resultPanel = document.getElementById('assess-result-panel');
  var recContent = document.getElementById('assess-recommendation');
  riskBadge.className = 'risk-badge-display';
  
  if (totalScore >= 4) {
    riskBadge.textContent = 'เสี่ยงสูง'; riskBadge.classList.add('high');
    resultPanel.style.borderTopColor = 'var(--accent-red)';
    recContent.innerHTML = '<strong>กลุ่มเสี่ยงสูง (ส่งต่อรพ. และเยี่ยมบ้านด่วน):</strong> เด็กมีคะแนนความเสี่ยงสะสมสูง ควรส่งต่อพบแพทย์ทันที และจัดทีมสาธารณสุขลงพื้นที่เยี่ยมบ้านติดตามการได้รับยาเหล็กและโภชนาการอย่างเร่งด่วน';
  } else if (totalScore >= 2) {
    riskBadge.textContent = 'เสี่ยงปานกลาง'; riskBadge.classList.add('mid');
    resultPanel.style.borderTopColor = 'var(--accent-amber)';
    recContent.innerHTML = '<strong>กลุ่มเสี่ยงปานกลาง (ติดตามใกล้ชิด):</strong> แนะนำให้ยาเหล็กเสริมสม่ำเสมอและปรับพฤติกรรมการกินอาหาร นัดติดตามตรวจเช็คผลเลือด Hct ซ้ำใน 1-2 เดือน';
  } else {
    riskBadge.textContent = 'เสี่ยงต่ำ'; riskBadge.classList.add('low');
    resultPanel.style.borderTopColor = 'var(--accent-teal)';
    recContent.innerHTML = '<strong>กลุ่มเสี่ยงต่ำ (เฝ้าระวังปกติ):</strong> ให้การบริโภคยาเหล็กเสริมและอาหารครบ 5 หมู่ตามแนวทางมาตรฐาน เฝ้าระวังและประเมินตามกำหนดรอบปกติ';
  }
};

window.submitAssessment = function() {
  if (!selectedAssessmentChild) { window.showToast("กรุณาเลือกเด็กก่อนบันทึกผลการประเมิน", "error"); return; }
  var ironChoice = getRadioValue('assess-iron');
  var foodChoice = getRadioValue('assess-food');
  var socialChoice = getRadioValue('assess-social');
  var notesText = document.getElementById('f-assess-notes').value || '';
  var updateData = JSON.parse(JSON.stringify(selectedAssessmentChild));
  updateData.iron = ironChoice; updateData.food = foodChoice; updateData.social = socialChoice; updateData.notes = notesText;

  window.showLoading(true, "กำลังบันทึกผลการประเมินความเสี่ยง...");
  window.backend
    .withSuccessHandler(function(res) {
      window.showLoading(false);
      if (res.success) { window.showToast("บันทึกผลการประเมินความเสี่ยงสำเร็จเรียบร้อย ✅"); window.resetAssessmentForm(); window.refreshData(); }
      else { window.showToast("บันทึกข้อมูลไม่สำเร็จ: " + res.error, "error"); }
    })
    .withFailureHandler(function(err) { window.showLoading(false); window.showToast("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: " + (err && err.message ? err.message : err), "error"); })
    .saveChild(updateData);
};

window.resetAssessmentForm = function() {
  selectedAssessmentChild = null;
  document.getElementById('f-assess-child-select').value = '';
  document.getElementById('assess-child-summary').style.display = 'none';
  document.getElementById('assess-form-area').style.display = 'none';
  document.getElementById('assess-empty-state').style.display = 'block';
  document.getElementById('f-assess-notes').value = '';
};

// -- SETTINGS -------------------------------------------------

window.switchSettingsTab = function(tabId) {
  document.querySelectorAll('.settings-nav-item').forEach(function(item) {
    item.classList.remove('active');
    if (item.getAttribute('onclick').indexOf(tabId) !== -1) { item.classList.add('active'); }
  });
  document.querySelectorAll('.settings-tab-page').forEach(function(page) { page.classList.remove('active'); });
  document.getElementById('settings-tab-' + tabId).classList.add('active');
};

window.togglePasswordVisibility = function(inputId) {
  var input = document.getElementById(inputId);
  if (input.type === 'password') { input.type = 'text'; }
  else { input.type = 'password'; }
};

window.loadSystemSettings = function() {
  if (!currentUser || currentUser.role !== 'เจ้าหน้าที่') return;
  window.backend
    .withSuccessHandler(function(settings) {
      if (settings.lineClientId) { document.getElementById('f-setting-line-client-id').value = settings.lineClientId; }
      if (settings.lineRedirectUri) { document.getElementById('f-setting-line-redirect-uri').value = settings.lineRedirectUri; }
      if (settings.liffId) { document.getElementById('f-setting-liff-id').value = settings.liffId; }
      if (settings.healthIdClientId) { document.getElementById('f-setting-healthid-client-id').value = settings.healthIdClientId; }
      if (settings.providerIdClientId) { document.getElementById('f-setting-providerid-client-id').value = settings.providerIdClientId; }
      if (settings.providerIdRedirectUri) { document.getElementById('f-setting-providerid-redirect-uri').value = settings.providerIdRedirectUri; }
      document.getElementById('f-setting-providerid-env').value = settings.providerIdEnv === 'uat' ? 'uat' : 'prd';
      document.getElementById('f-setting-healthid-client-secret').placeholder = settings.hasHealthIdClientSecret ? "•••••••• (ตั้งค่าไว้แล้ว — เปลี่ยนผ่าน CLI เท่านั้น)" : "ยังไม่ได้ตั้งค่า (firebase functions:secrets:set HEALTHID_CLIENT_SECRET)";
      document.getElementById('f-setting-providerid-secret-key').placeholder = settings.hasProviderIdSecretKey ? "•••••••• (ตั้งค่าไว้แล้ว — เปลี่ยนผ่าน CLI เท่านั้น)" : "ยังไม่ได้ตั้งค่า (firebase functions:secrets:set PROVIDERID_SECRET_KEY)";
      document.getElementById('f-setting-line-token').placeholder = settings.hasLineToken ? "•••••••• (ตั้งค่าไว้แล้ว — เปลี่ยนผ่าน CLI เท่านั้น)" : "ยังไม่ได้ตั้งค่า";
      document.getElementById('f-setting-line-client-secret').placeholder = settings.hasLineClientSecret ? "•••••••• (ตั้งค่าไว้แล้ว — เปลี่ยนผ่าน CLI เท่านั้น)" : "ยังไม่ได้ตั้งค่า";
    })
    .withFailureHandler(function(err) {
      console.error("Failed to load system settings:", err);
    })
    .getSystemSettings();
};

window.saveSettings = function() {
  var lineClientId = document.getElementById('f-setting-line-client-id').value.trim();
  var lineRedirectUri = document.getElementById('f-setting-line-redirect-uri').value.trim();
  var liffId = document.getElementById('f-setting-liff-id').value.trim();
  var healthIdClientId = document.getElementById('f-setting-healthid-client-id').value.trim();
  var providerIdClientId = document.getElementById('f-setting-providerid-client-id').value.trim();
  var providerIdRedirectUri = document.getElementById('f-setting-providerid-redirect-uri').value.trim();
  var providerIdEnv = document.getElementById('f-setting-providerid-env').value;

  window.showLoading(true, "กำลังบันทึกการตั้งค่าระบบ...");

  window.backend
    .withSuccessHandler(function(res) {
      window.showLoading(false);
      window.showToast("บันทึกการตั้งค่าเรียบร้อยแล้ว ✅");
      if (res.warnings && res.warnings.length) { window.showToast(res.warnings.join(" "), "info"); }
      window.refreshData();
    })
    .withFailureHandler(function(err) { window.showLoading(false); window.showToast(err && err.message ? err.message : String(err), "error"); })
    .saveSystemSettings({
      lineClientId: lineClientId,
      lineRedirectUri: lineRedirectUri,
      liffId: liffId,
      healthIdClientId: healthIdClientId,
      providerIdClientId: providerIdClientId,
      providerIdRedirectUri: providerIdRedirectUri,
      providerIdEnv: providerIdEnv
    });
};

window.testLineNotify = function() {
  window.showLoading(true, "กำลังส่งข้อความทดสอบ...");
  window.backend
    .withSuccessHandler(function(res) { window.showLoading(false); if (res.success) { window.showToast("ส่งข้อความทดสอบสำเร็จ! กรุณาตรวจสอบใน LINE"); } else { window.showToast("ส่งไม่สำเร็จ: " + res.error, "error"); } })
    .withFailureHandler(function(err) { window.showLoading(false); window.showToast(err && err.message ? err.message : String(err), "error"); })
    .testLineNotify();
};

// -- AUTHENTICATION -------------------------------------------

window.switchLoginTab = function(role) {
  document.getElementById('tab-btn-staff').classList.toggle('active', role === 'staff');
  document.getElementById('tab-btn-vhv').classList.toggle('active', role === 'vhv');
  document.getElementById('login-sec-staff').classList.toggle('active', role === 'staff');
  document.getElementById('login-sec-vhv').classList.toggle('active', role === 'vhv');
};

window.togglePasswordVisibility = function(inputId, iconId) {
  var input = document.getElementById(inputId);
  var icon = document.getElementById(iconId);
  if (!input || !icon) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
};

window.toggleDevPanel = function() {
  var panel = document.getElementById('dev-quick-login-panel-body');
  var arrow = document.getElementById('dev-panel-arrow');
  if (!panel) return;
  var isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'block' : 'none';
  if (arrow) {
    arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  }
};

window.moveOtpFocus = function(current, nextId) {
  if (current.value.length >= 1 && nextId) { document.getElementById(nextId).focus(); }
};

window.submitHOSxPLogin = function() {
  var username = document.getElementById('login-hosxp-user').value.trim();
  var password = document.getElementById('login-hosxp-password').value.trim();
  if (!username || !password) { window.showToast("กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน", "error"); return; }
  
  // แปลง username ให้เป็น email format ถ้าผู้ใช้ไม่ได้พิมพ์ @ มา
  var email = username;
  if (email.indexOf('@') === -1) {
    email = email + "@ironrisk.local"; // Dummy domain สำหรับ HOSxP Username
  }

  window.showLoading(true, "กำลังตรวจสอบข้อมูล...");
  window.fb.signInStaffEmail(email, password).then(function(res) {
    window.showLoading(false);
    if (res.pending) { window.showPendingApprovalScreen(res.user, "บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ"); }
    else if (res.success) { window.setSession(res.user); }
    else { window.showToast(res.error || "เข้าสู่ระบบล้มเหลว", "error"); }
  }).catch(function(err) {
    window.showLoading(false);
    var errMsg = "เข้าสู่ระบบล้มเหลว";
    if (err && err.code === 'auth/invalid-credential') {
      errMsg = "ชื่อผู้ใช้งาน หรือ รหัสผ่านไม่ถูกต้อง";
    }
    window.showToast(errMsg, "error");
  });
};

window.handleLineLogin = function() {
  window.showLoading(true, "กำลังเตรียม LINE Login...");
  window.fb.getLineLoginUrl().then(function(url) {
    window.top.location.href = url;
  }).catch(function(err) {
    window.showLoading(false);
    window.showToast("ไม่สามารถเตรียม LINE Login ได้: " + (err && err.message ? err.message : err), "error");
  });
};

window.handleHealthIdLogin = function() {
  window.showLoading(true, "กำลังเชื่อมต่อกับ Health ID (MOPH)...");
  window.fb.getHealthIdLoginUrl().then(function(url) {
    window.top.location.href = url;
  }).catch(function(err) {
    window.showLoading(false);
    window.showToast("ไม่สามารถเตรียม Health ID Login ได้: " + (err && err.message ? err.message : err), "error");
  });
};

window.handleProviderIdLogin = function() {
  window.showLoading(true, "กำลังเชื่อมต่อกับ Provider ID (MOPH)...");
  window.fb.getProviderIdLoginUrl().then(function(url) {
    window.top.location.href = url;
  }).catch(function(err) {
    window.showLoading(false);
    window.showToast("ไม่สามารถเตรียม Provider ID Login ได้: " + (err && err.message ? err.message : err), "error");
  });
};

window.requestSMSOTP = function() {
  var phone = document.getElementById('login-vhv-phone').value.trim();
  if (!phone) { window.showToast("กรุณากรอกเบอร์โทรศัพท์", "error"); return; }
  window.showLoading(true, "กำลังตรวจสอบเบอร์โทรศัพท์...");
  window.backend
    .withSuccessHandler(function(res) {
      window.showLoading(false);
      if (res.pending) { window.showPendingApprovalScreen(res.user, "บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ"); }
      else if (res.success) { window.startOTPDemo(phone); }
      else { window.showToast(res.error, "error"); }
    })
    .withFailureHandler(function(err) { window.showLoading(false); window.showToast(err && err.message ? err.message : String(err), "error"); })
    .checkOtpEligibility(phone);
};

window.startOTPDemo = function(phone) {
  mockGeneratedOTP = Math.floor(100000 + Math.random() * 900000).toString();
  alert("💬 [จำลอง SMS OTP]\nรหัสยืนยันตัวตนสำหรับ Iron Zero Risk ของคุณคือ: " + mockGeneratedOTP + " (มีอายุใช้งาน 1 นาที)");
  document.getElementById('otp-step-phone').style.display = 'none';
  document.getElementById('otp-step-code').style.display = 'block';
  for (var i = 1; i <= 6; i++) { document.getElementById('otp-box-' + i).value = ''; }
  document.getElementById('otp-box-1').focus();
  var seconds = 60; var timerEl = document.getElementById('otp-countdown');
  timerEl.textContent = seconds + " วินาที"; clearInterval(otpTimerInterval);
  otpTimerInterval = setInterval(function() {
    seconds--; timerEl.textContent = seconds + " วินาที";
    if (seconds <= 0) { clearInterval(otpTimerInterval); window.showToast("รหัส OTP หมดอายุการใช้งานแล้ว กรุณาขอใหม่", "error"); window.resetOTPStep(); }
  }, 1000);
};

window.resetOTPStep = function() {
  clearInterval(otpTimerInterval);
  document.getElementById('otp-step-phone').style.display = 'block';
  document.getElementById('otp-step-code').style.display = 'none';
};

window.verifySMSOTP = function() {
  var enteredCode = "";
  for (var i = 1; i <= 6; i++) { enteredCode += document.getElementById('otp-box-' + i).value.trim(); }
  if (enteredCode.length < 6) { window.showToast("กรุณากรอกรหัส OTP ให้ครบ 6 หลัก", "error"); return; }
  if (enteredCode !== mockGeneratedOTP) { window.showToast("รหัส OTP ไม่ถูกต้อง กรุณากรอกใหม่อีกครั้ง", "error"); return; }
  clearInterval(otpTimerInterval);
  var phone = document.getElementById('login-vhv-phone').value.trim();
  window.showLoading(true, "กำลังยืนยันรหัส OTP...");
  window.backend
    .withSuccessHandler(function(res) {
      if (res.pending) { window.showLoading(false); window.showPendingApprovalScreen(res.user, "บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ"); return; }
      if (!res.success || !res.customToken) { window.showLoading(false); window.showToast(res.error || "ยืนยันไม่สำเร็จ", "error"); return; }
      window.fb.signInWithCustomToken(res.customToken).then(function() {
        window.showLoading(false);
        window.setSession(res.user);
      }).catch(function(err) {
        window.showLoading(false);
        window.showToast(err && err.message ? err.message : String(err), "error");
      });
    })
    .withFailureHandler(function(err) { window.showLoading(false); window.showToast(err && err.message ? err.message : String(err), "error"); })
    .signInPhoneOtp(phone);
};

window.logout = function() {
  window.showLoading(true, "กำลังออกจากระบบ...");
  window.fb.signOut().finally(function() {
    currentUser = null;
    window.showLoading(false);
    document.getElementById('login-hosxp-user').value = ''; document.getElementById('login-hosxp-password').value = '';
    document.getElementById('login-vhv-phone').value = ''; window.resetOTPStep();
    document.getElementById('login-container').style.display = 'flex'; document.getElementById('app').style.display = 'none';
    window.showToast("ออกจากระบบสำเร็จแล้ว 🔒", "info");
  });
};

window.applyUserRolePermissions = function() {
  if (!currentUser) { return; }
  var displayName = document.getElementById('user-display-name');
  var displayRole = document.getElementById('user-display-role');
  var avatar = document.getElementById('user-avatar');

  var cleanName = (currentUser.name || '').replace(/^(อื่นๆ|ไม่ระบุ)\s*/gi, '').trim() || currentUser.name || '';
  currentUser.name = cleanName;

  if (displayName) { displayName.textContent = cleanName; }
  if (displayRole) { displayRole.textContent = currentUser.role === 'อสม.' ? (currentUser.role + " (ม." + (currentUser.assignedVillage.replace(/[^0-9]/g, '') || currentUser.assignedVillage) + ")") : currentUser.role; }
  if (avatar) {
    var avatarSrc = currentUser.avatarUrl || 'assets/images/moph-avatar.png';
    avatar.innerHTML = '<img src="' + avatarSrc + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.onerror=null;this.parentElement.textContent=\'' + (cleanName.charAt(0) || '👤') + '\';">';
  }
  var isVhv = currentUser.role === 'อสม.';
  ['add', 'settings', 'villages', 'users'].forEach(function(navId) {
    var el = document.getElementById('nav-' + navId);
    if (el) { el.style.display = isVhv ? 'none' : 'flex'; }
  });
  var deleteBtn = document.querySelector('#modal-detail .btn-danger');
  if (deleteBtn) { deleteBtn.style.display = isVhv ? 'none' : 'inline-block'; }
  var importTrigger = document.getElementById('csv-import-trigger');
  if (importTrigger) { importTrigger.style.display = isVhv ? 'none' : 'inline-flex'; }
};

window.initAuthSession = function() {
  window.showLoading(true, "กำลังตรวจสอบสถานะการเข้าสู่ระบบ...");

  // 1. Resolve an OAuth redirect (?code=...) if we just came back from Health ID
  //    (Provider ID login) or LINE's authorize page.
  var redirectLabel = "Health ID";
  window.fb.handleHealthIdRedirect().then(function(healthResult) {
    if (healthResult && healthResult.handled) return healthResult;
    redirectLabel = "Provider ID";
    return window.fb.handleProviderIdRedirect();
  }).then(function(providerResult) {
    if (providerResult && providerResult.handled) return providerResult;
    redirectLabel = "LINE";
    return window.fb.handleLineRedirect();
  }).then(function(lineResult) {
    if (lineResult && lineResult.handled) {
      window.showLoading(false);
      if (lineResult.pending) {
        window.showPendingApprovalScreen(lineResult.user, "บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ");
      } else if (lineResult.success) {
        window.setSession(lineResult.user);
      } else {
        window.showToast(lineResult.error || ("เข้าสู่ระบบด้วย " + redirectLabel + " ไม่สำเร็จ"), "error");
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
      }
      return;
    }

    // 2. Otherwise, check whether Firebase Auth already has a persisted session.
    window.fb.onAuthReady().then(function(firebaseUser) {
      if (!firebaseUser) {
        window.showLoading(false);
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        return;
      }
      window.backend
        .withSuccessHandler(function(res) {
          window.showLoading(false);
          if (res.pending) {
            window.showPendingApprovalScreen(res.user, "บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ");
          } else if (res.success) {
            window.setSession(res.user);
          } else {
            document.getElementById('login-container').style.display = 'flex';
            document.getElementById('app').style.display = 'none';
          }
        })
        .withFailureHandler(function(err) {
          window.showLoading(false);
          document.getElementById('login-container').style.display = 'flex';
          document.getElementById('app').style.display = 'none';
          window.showToast(err && err.message ? err.message : String(err), "error");
        })
        .ensureUserProfile();
    });
  });
};

// -- SCROLL NAVIGATION LOGIC ----------------------------------

window.scrollToSection = function(direction) {
  var content = document.getElementById('content');
  if (!content) return;
  
  if (direction === 'top') {
    content.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (direction === 'bottom') {
    content.scrollTo({ top: content.scrollHeight, behavior: 'smooth' });
  }
};

window.initScrollNav = function() {
  var content = document.getElementById('content');
  var btnTop = document.getElementById('scroll-to-top');
  var btnBottom = document.getElementById('scroll-to-bottom');
  
  if (!content || !btnTop || !btnBottom) return;
  
  content.addEventListener('scroll', function() {
    // Show "To Top" button if scrolled more than 300px
    if (content.scrollTop > 300) {
      btnTop.classList.add('show');
    } else {
      btnTop.classList.remove('show');
    }
    
    // Show "To Bottom" button if not at the end of the content
    var remaining = content.scrollHeight - content.scrollTop - content.clientHeight;
    if (remaining > 300) {
      btnBottom.classList.add('show');
    } else {
      btnBottom.classList.remove('show');
    }
  });
  
  // Run once to set initial visibility
  setTimeout(function() {
    var event = new Event('scroll');
    content.dispatchEvent(event);
  }, 1000);
};

window.onload = function() {
  window.initAddressCascading();
  window.initAuthSession();
  window.initScrollNav();
};