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

## โครงสร้างไฟล์ที่สำคัญ
- `Index.html` - หน้าหลักของระบบ
- `JavaScript.html` - ไฟล์สคริปต์ JavaScript ที่ถูกดึงเข้าไปใช้ใน Index.html
- `Stylesheet.html` - ไฟล์สไตล์ CSS ที่ถูกดึงเข้าไปใช้ใน Index.html
- `Code.gs` - โค้ดฝั่ง Server-side (Google Apps Script) สำหรับระบบเมื่อนำไปใช้งานจริงบน Google Workspace
- `dev.py` - สคริปต์จำลอง Server สำหรับการพัฒนาบนเครื่อง Local
