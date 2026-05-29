# 🫷🤚 ก๊อปวาง เอนจิ้น

> **Stop writing DTOs by hand.** — แปลง SQL columns เป็น TypeScript Interface และ Java JPA Entity ได้ทันที ทุกอย่างทำงานบน client-side ล้วน ไม่มีเซิร์ฟเวอร์ ไม่มี backend

[![Live Demo](https://img.shields.io/badge/Live-Demo-00d4aa?style=flat-square&logo=github)](https://devgreenpink.github.io/kop-wang-engine/)
[![Client Side Only](https://img.shields.io/badge/client--side-only-00d4aa?style=flat-square)](#)
[![No Dependencies](https://img.shields.io/badge/dependencies-none-7c6af7?style=flat-square)](#)

---

## ✨ Features

- **TypeScript Interface** — แปลงชื่อคอลัมน์ SQL เป็น `camelCase` พร้อม type inference อัตโนมัติ (`string`, `number`, `Date`, `boolean`)
- **Java JPA Entity** — สร้าง class พร้อม `@Entity`, `@Table`, `@Id`, `@Column`, Lombok annotations (`@Data`, `@NoArgsConstructor`)
- **Bean Validation** — เพิ่ม `@NotNull`, `@NotBlank`, `@Size`, `@Min`/`@Max`, `@Email`, `@Pattern` ผ่าน modal UI
- **Relationship Mapping** — คลิกเดียวเพิ่ม `@OneToOne`, `@ManyToOne`, `@OneToMany`, `@ManyToMany`, `@Enumerated` พร้อม FetchType/CascadeType
- **SQL Junk Stripping** — วางทั้ง raw column list หรือ SQL DDL จะตัด `VARCHAR(150)`, `NOT NULL`, `DEFAULT 0` ออกให้อัตโนมัติ
- **Length / Precision Sync** — ค่า `length`, `precision`, `scale` จาก DDL ถูก parse มาใส่ตารางและ `@Column` ให้เลย
- **Inline Editing** — แก้ type, length, precision ได้ตรง mapping table โดยไม่ต้องเปิด modal
- **Strip Prefix** — ตัด prefix เช่น `RPT_`, `tbl_`, `T_` ออกจากชื่อคอลัมน์ก่อนแปลง
- **Reserved Keyword Guard** — ป้องกันชื่อ field ชนกับ keyword ของ TS/Java อัตโนมัติ
- **Syntax Highlighting** — output window highlight สี keyword, annotation, type, string, comment, number
- **Copy & Download** — copy โค้ดไปคลิปบอร์ด หรือ download เป็นไฟล์ `.ts` / `.java`
- **Dark / Light Theme** — toggle ธีมพร้อม persist ใน `localStorage`
- **Draggable Panels** — ปรับขนาด left panel (↔) และ mapping/output panel (↕) ได้ด้วยเมาส์
- **🫷🤚 Slap Logo** — กดโลโก้แล้วดูเอง

---

## 🚀 Quick Start

### วิธีใช้งาน
1. เปิด **[หน้าเว็บ](https://devgreenpink.github.io/kop-wang-engine/)** (หรือ run local ด้านล่าง)
2. วางชื่อคอลัมน์ SQL ในช่อง **SQL Columns** — รองรับทั้ง format นี้:
   ```
   USER_ID
   FIRST_NAME
   CREATED_AT
   IS_ACTIVE
   TOTAL_AMOUNT
   ```
   และ raw SQL DDL:
   ```sql
   USER_NAME VARCHAR(150) NOT NULL,
   PRICE DECIMAL(10,2),
   EMAIL VARCHAR(255) UNIQUE,
   ```
3. เลือก tab **TypeScript** หรือ **Java** ที่ tab bar ด้านบน
4. ปรับ type, optional, length ในตาราง mapping ได้ตามต้องการ
5. กด **copy** หรือ **download** เพื่อเอาโค้ดไปใช้

---

## 🗂 Project Structure

```
kop-wang-engine/
│
├── index.html          # Main entry point — HTML structure only, no inline JS/CSS
│
├── css/
│   └── styles.css      # Design system: tokens, layouts, themes, animations
│
└── js/
    ├── main.js         # App orchestrator — state, render pipeline, event bridge
    ├── parser.js       # Pure logic — SQL stripping, type inference, case conversion
    ├── builders.js     # DOM factories — mapping table, modal UI, code output, syntax highlighter
    └── animations.js   # Interactive UI — slap logo particles, panel drag-resize handlers
```

### Module Responsibilities

| File | Responsibility |
|------|----------------|
| `parser.js` | SQL stripping, camelCase/PascalCase, type inference, reserved keyword guard |
| `builders.js` | `buildTable()`, `buildOutput()`, `openModal()`, `hl()` syntax highlighter |
| `animations.js` | Logo slap particle effect, horizontal & vertical panel resizers |
| `main.js` | Global state, render pipeline, window bridge for inline HTML event handlers |

---

## 💻 Run Locally

เนื่องจากใช้ **ES Modules** (`type="module"`) การเปิดผ่าน `file://` โดยตรงจะถูก browser block เพราะ CORS ให้ใช้ local server แทน:

```bash
# Node.js
npx http-server -p 8080

# Python 3
python -m http.server 8080
```

แล้วเปิด `http://localhost:8080`

---

## 📦 Deploy to GitHub Pages

1. Push โปรเจกต์ขึ้น GitHub repository
2. ไปที่ **Settings → Pages**
3. เลือก branch (เช่น `main`) และ folder `/root`
4. กด **Save** — ไม่กี่นาทีก็ live ที่ `https://<username>.github.io/<repo>/`

> ✅ ทุก path เป็น relative (`css/styles.css`, `js/main.js`) พร้อม deploy ทันที ไม่ต้อง config อะไรเพิ่ม

---

## 🧩 Type Inference Rules

### TypeScript
| Pattern | Inferred Type |
|---------|--------------|
| `IS_`, `HAS_`, `CAN_` prefix | `boolean` |
| `_ID`, `_NO`, `VERSION` suffix | `number` |
| `_DATE`, `_AT`, `_TIME`, `_DT` suffix | `Date` |
| `_AMOUNT`, `_PRICE`, `_TOTAL`, `_BALANCE`, `_RATE` suffix | `number` |
| อื่นๆ | `string` |

### Java
| Pattern | Inferred Type |
|---------|--------------|
| `IS_`, `HAS_`, `CAN_` prefix | `Boolean` |
| `_ID` suffix | `Long` |
| `_NO`, `VERSION`, `_COUNT`, `_QTY`, `_SEQ` suffix | `Integer` |
| `_DATE`, `_AT`, `_DATETIME`, `_DT`, `_TIME` suffix | `LocalDateTime` |
| `_AMOUNT`, `_PRICE`, `_TOTAL`, `_BALANCE`, `_RATE` suffix | `BigDecimal` |
| `_EMAIL`, `_MAIL`, `_CODE` suffix | `String` |
| อื่นๆ | `String` |

---

## 🛠 Tech Stack

- **Vanilla HTML5** — semantic markup, zero framework
- **Vanilla CSS** — custom design system, CSS variables, `@keyframes`
- **ES Modules (Vanilla JS)** — `import`/`export`, no bundler needed
- **Google Fonts** — JetBrains Mono + Syne
- **localStorage** — theme preference persistence

---

## 📝 License

MIT — ใช้ได้เลย ไม่ต้องขอ บูชา `Ctrl+C` `Ctrl+V` ✌️
