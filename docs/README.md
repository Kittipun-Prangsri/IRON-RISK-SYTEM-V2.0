# วิธีการรันระบบ (How to Run)

ระบบนี้จำลองสภาพแวดล้อม Google Apps Script (GAS) เพื่อให้รันและทดสอบบนเครื่อง Local ได้สะดวก

## ขั้นตอนการรันระบบ

### 1. รัน Local Development Server
รันสคริปต์ Python เพื่อเปิด Server จำลองบนเครื่อง Local ที่พอร์ต `8000`:
```bash
python3 dev.py
```
*ระบบจะจำลองฟังก์ชัน `include` ของ GAS และเปิดหน้าเบราว์เซอร์ไปที่ `http://localhost:8000/Index.html` ให้โดยอัตโนมัติ*

### 2. รัน ngrok เพื่อแชร์ลิงก์ภายนอก (ถ้าต้องการ)
หากต้องการแชร์พอร์ตให้บุคคลอื่น หรือเชื่อมต่อภายนอก ให้รันคำสั่ง ngrok:
```bash
ngrok http 8000
```

---

## การ Deploy ขึ้น Google Apps Script ด้วย clasp

[clasp](https://github.com/google/clasp) คือ CLI tool ที่ช่วยให้พัฒนา Google Apps Script บนเครื่อง Local แล้ว Push ขึ้น Google ได้สะดวก

### ขั้นตอนการใช้งาน clasp

#### ขั้นที่ 1: ติดตั้ง clasp (ถ้ายังไม่มี)
```bash
npm install -g @google/clasp
```

#### ขั้นที่ 2: Login เข้า Google Account
```bash
clasp login
```
> ระบบจะเปิดเบราว์เซอร์ให้ยืนยันสิทธิ์เข้าถึง Google Account  
> หากแสดง `You are logged in as <email>` แสดงว่า Login สำเร็จแล้ว

#### ขั้นที่ 3: Push โค้ดขึ้น Google Apps Script แบบ Watch Mode
```bash
clasp push --watch
```
> **`--watch`** คือ โหมดที่ clasp จะ **คอยตรวจสอบการเปลี่ยนแปลงไฟล์อัตโนมัติ**  
> ทุกครั้งที่บันทึกไฟล์ใน `src/` ระบบจะ Push โค้ดไปยัง Google Apps Script ทันที  
> กด `Ctrl + C` เพื่อหยุดการทำงาน

#### ขั้นที่ 4: เปิด Script ใน Google Apps Script Editor (ถ้าต้องการ)
```bash
clasp open
```

---

### สรุปคำสั่ง clasp ที่ใช้บ่อย

| คำสั่ง | ความหมาย |
|---|---|
| `clasp login` | เข้าสู่ระบบ Google Account |
| `clasp push` | Push โค้ดขึ้น GAS ครั้งเดียว |
| `clasp push --watch` | Push อัตโนมัติทุกครั้งที่ไฟล์เปลี่ยน |
| `clasp pull` | ดึงโค้ดจาก GAS มาไว้บนเครื่อง |
| `clasp open` | เปิด GAS Editor ในเบราว์เซอร์ |
| `clasp deploy` | Deploy Script เป็น Web App |

---

## โครงสร้างไฟล์ที่สำคัญ
- `Index.html` - หน้าหลักของระบบ
- `JavaScript.html` - ไฟล์สคริปต์ JavaScript ที่ถูกดึงเข้าไปใช้ใน Index.html
- `Stylesheet.html` - ไฟล์สไตล์ CSS ที่ถูกดึงเข้าไปใช้ใน Index.html
- `Code.gs` - โค้ดฝั่ง Server-side (Google Apps Script) สำหรับระบบเมื่อนำไปใช้งานจริงบน Google Workspace
- `dev.py` - สคริปต์จำลอง Server สำหรับการพัฒนาบนเครื่อง Local
