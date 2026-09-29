# 🏥 Iron Zero Risk System V2.0

ระบบประเมินและติดตามภาวะซีดจากการขาดธาตุเหล็กในเด็กปฐมวัย (Anemia Tracking System) พัฒนาด้วย **Firebase Hosting + Cloud Functions + Firestore**

> โปรเจกต์นี้ย้ายฐานข้อมูลจาก Google Sheets มาเป็น Firestore แล้ว (เดิมรันบน Google Apps Script) โค้ด GAS เดิมใน `src/Code.gs` และ `dev.py` ยังเก็บไว้เป็นข้อมูลอ้างอิง แต่ไม่ใช่ระบบที่ deploy จริงอีกต่อไป

---

## 🌟 คุณสมบัติเด่น (Key Features)

- **📊 Comprehensive Dashboard**: แสดงภาพรวมสถิติเด็กกลุ่มเสี่ยง, สถานะโภชนาการ และความครอบคลุมของการได้รับยาเหล็ก
- **👶 Child Data Management**: ระบบลงทะเบียน ค้นหา และจัดการข้อมูลเด็กรายบุคคล พร้อมระบบพิกัดแผนที่
- **⚖️ Risk Assessment**: แบบประเมินความเสี่ยง 5 มิติ (Hct, โภชนาการ, การกินยา, อาหาร, สังคมเศรษฐกิจ) พร้อมระบบคำนวณคะแนนอัตโนมัติ
- **💊 Iron Supplement Tracking**: บันทึกและติดตามการกินยาเสริมธาตุเหล็กแบบรายวัน
- **🔔 Smart Notifications**: เชื่อมต่อ LINE Notify เพื่อแจ้งเตือนเคสเด็กที่มีความเสี่ยงสูง (High Risk) ไปยังทีมสาธารณสุข
- **⚙️ Professional Settings**: หน้าตั้งค่าระบบที่สามารถปรับเปลี่ยน Spreadsheet ID และ LINE Token ได้ผ่าน UI
- **🌓 Dark/Light Mode**: รองรับการเปลี่ยนธีมเพื่อความสบายตาในการใช้งาน

---

## 🏗️ โครงสร้างโปรเจกต์ (Project Structure)

```text
IronRiskSystem/
├── src/                    # Source ที่แก้ไขจริง — build script ประกอบเป็น public/
│   ├── Index.html          # โครง HTML หลัก
│   ├── Stylesheet.html     # → build เป็น public/assets/css/style.css
│   ├── JavaScript.html     # → build เป็น public/assets/js/app.js
│   ├── Sidebar.html, Footer.html, Modals.html   # Partial ที่ build ฝังเข้า index.html
│   └── Code.gs              # โค้ด GAS เดิม (ไม่ได้ deploy แล้ว เก็บไว้อ้างอิง)
├── public/                 # Firebase Hosting root (build output + ไฟล์ Firebase-specific)
│   ├── firebase-config.js          # Firebase Web config (ไม่ใช่ความลับ)
│   └── assets/js/firebase-adapter.js  # เชื่อม app.js เข้ากับ Firebase Auth/Functions
├── functions/               # Cloud Functions (Node.js) — แทน Code.gs ทั้งหมด
│   ├── index.js
│   └── lib/                 # scoring.js (คำนวณคะแนนความเสี่ยง), auth.js (ตรวจสิทธิ์)
├── scripts/
│   ├── build.js              # ประกอบ src/*.html → public/
│   └── importFromSheets.js   # ย้ายข้อมูลจาก Google Sheet เดิม → Firestore (รันครั้งเดียว)
├── firebase.json, .firebaserc, firestore.rules, firestore.indexes.json
├── data/                    # ไฟล์ข้อมูลตัวอย่างและที่อยู่
├── docs/                    # เอกสารประกอบการใช้งาน
└── dev.py                   # (เดิม) Local server สำหรับ GAS — ไม่ใช้กับ Firebase workflow แล้ว
```

---

## 🚀 การติดตั้งและใช้งาน (Getting Started)

### 1. Build ไฟล์ static
แก้ไขไฟล์ต้นทางใน `src/*.html` แล้วรัน:
```bash
node scripts/build.js
```
คำสั่งนี้จะประกอบ `src/Index.html` + partials ต่างๆ เป็น `public/index.html`, `public/assets/css/style.css`, `public/assets/js/app.js`

### 2. รันบนเครื่อง Local ด้วย Firebase Emulator
```bash
firebase emulators:start
```
เปิด Hosting/Functions/Firestore/Auth emulator พร้อมกัน (ต้องมี JDK 21+ สำหรับ Firestore emulator) เข้าใช้งานที่ `http://localhost:5000`

### 3. Deploy ขึ้น Production
```bash
firebase deploy --only firestore:rules   # ล็อก Firestore ก่อนเสมอ
firebase deploy --only functions
firebase deploy --only hosting:ironrisk
```

### 4. ตั้งค่า Secret (ทำครั้งเดียวต่อ environment)
LINE Token และ LINE Client Secret **ไม่เก็บใน Firestore หรือโค้ด** ต้องตั้งผ่าน CLI เท่านั้น:
```bash
firebase functions:secrets:set LINE_TOKEN
firebase functions:secrets:set LINE_CLIENT_SECRET
```
ค่าที่ไม่ใช่ความลับ (LIFF ID, LINE Client ID, Redirect URI) ตั้งได้ผ่านหน้า Settings ในเว็บ (staff เท่านั้น)

### 5. ย้ายข้อมูลจาก Google Sheet เดิม (ครั้งเดียว)
ดู `scripts/importFromSheets.js` — ต้องมี service-account key ที่มีสิทธิ์อ่าน Sheet เดิมและเขียน Firestore

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Backend**: Firebase Cloud Functions (Node.js 20)
- **Database**: Cloud Firestore
- **Auth**: Firebase Authentication (Google SSO, Email/Password, LINE Login ผ่าน custom token, Phone/OTP)
- **Hosting**: Firebase Hosting (multi-site: `ironrisk`)
- **Frontend**: HTML5, CSS3, JavaScript (ES5-compatible app.js + ES module adapter)
- **Library**: [Chart.js](https://www.chartjs.org/) (Data Visualization), [FontAwesome](https://fontawesome.com/) (Icons)

---

## 👤 ผู้พัฒนา (Developer)

**Kittipun Prangsri**
- GitHub: [@Kittipun-Prangsri](https://github.com/Kittipun-Prangsri)
- Repository: [IRON-RISK-SYTEM-V2.0](https://github.com/Kittipun-Prangsri/IRON-RISK-SYTEM-V2.0.git)

---
*© 2026 Iron Zero Risk System - สร้างสรรค์เพื่อสุขภาพที่ดีของชุมชน*
