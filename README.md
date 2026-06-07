# 🏥 Iron Zero Risk System V2.0

ระบบประเมินและติดตามภาวะซีดจากการขาดธาตุเหล็กในเด็กปฐมวัย (Anemia Tracking System) พัฒนาด้วย **Google Apps Script** และ **Google Sheets** เพื่อการจัดการข้อมูลที่สะดวกรวดเร็วและเป็นระบบ

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
├── src/                # ไฟล์หลักสำหรับ Google Apps Script
│   ├── Code.gs         # Backend Logic (JavaScript / GAS)
│   ├── Index.html      # UI หลัก (Main Entry Point)
│   ├── Stylesheet.html # รวมสไตล์ CSS ทั้งหมด
│   ├── JavaScript.html # รวม Logic ฝั่ง Frontend (Restored & Stabilized)
│   ├── Sidebar.html    # เมนูการใช้งานด้านข้าง (Flexible Sidebar)
│   ├── Footer.html     # ส่วนท้ายของหน้าเว็บ
│   └── Modals.html     # หน้าต่าง Pop-up ทั้งหมด
├── data/               # ไฟล์ข้อมูลตัวอย่างและที่อยู่
│   ├── sakaeo_address.json
│   └── test.csv
├── docs/               # เอกสารประกอบการใช้งาน
└── dev.py              # Local Development Server (Python)
```

---

## 🚀 การติดตั้งและใช้งาน (Getting Started)

### 1. การใช้งานบน Google Apps Script (Production)
1. สร้างโปรเจกต์ใหม่ใน [script.google.com](https://script.google.com)
2. สร้างไฟล์ในหน้า Script Editor ให้ชื่อตรงกับไฟล์ในโฟลเดอร์ `src/`
3. ก๊อปปี้โค้ดจากไฟล์ใน `src/` ไปวางตามชื่อไฟล์ที่สร้างไว้
4. กด **Deploy** > **New Deployment** > เลือกประเภท **Web App**
5. ตั้งค่า "Execute as: Me" และ "Who has access: Anyone"
6. นำ URL ที่ได้ไปใช้งาน

### 2. การรันบนเครื่อง Local (Development)
หากต้องการแก้ไข UI หรือทดสอบ Logic บนเครื่องตัวเอง:
1. ตรวจสอบว่ามี Python 3 ติดตั้งอยู่ในเครื่อง
2. รันคำสั่ง:
   ```bash
   python3 dev.py
   ```
3. ระบบจะเปิด Browser ไปที่ `http://localhost:8001/Index.html` อัตโนมัติ

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Backend**: Google Apps Script (V8 Engine)
- **Database**: Google Sheets (Real-time Sync)
- **Frontend**: HTML5, CSS3 (Modern UI), JavaScript (ES5 Compatible)
- **Library**: [Chart.js](https://www.chartjs.org/) (Data Visualization), [FontAwesome](https://fontawesome.com/) (Icons)

---

## 👤 ผู้พัฒนา (Developer)

**Kittipun Prangsri**
- GitHub: [@Kittipun-Prangsri](https://github.com/Kittipun-Prangsri)
- Repository: [IRON-RISK-SYTEM-V2.0](https://github.com/Kittipun-Prangsri/IRON-RISK-SYTEM-V2.0.git)

---
*© 2026 Iron Zero Risk System - สร้างสรรค์เพื่อสุขภาพที่ดีของชุมชน*
