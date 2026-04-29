# NH Event Registration & Attendance Management System

A professional, full-stack event management solution designed for high-volume registration, real-time monitoring, and onsite check-in. This system is optimized for local or VPS deployment and does not require AWS.

## 🚀 Features

- **Pre-Event Registration:** Professional web portal for Delegates and Media.
- **Automated Badge Generation:** 
  - Dynamic PDF generation (4x6 inches).
  - Category-based color themes (Delegates: Navy, Media: Red).
  - Embedded unique QR codes.
- **Real-Time Dashboard:** Live monitoring of registration totals and attendance percentages.
- **Onsite QR Scanner:** Mobile-friendly web scanner for instant entry verification and check-in.
- **Bulk Communication:** Integrated email service for sending badges and mass reminders.
- **Mass Data Import:** Support for importing external attendee lists via CSV.
- **Zero-Config Database:** Uses SQLite for persistent local storage without complex setup.

## 🏗️ Project Structure

- `client/`: React + TypeScript frontend.
- `server/`: Node.js + Express + TypeScript backend.

## 🛠️ Technical Stack

- **Frontend:** React, TypeScript, html5-qrcode.
- **Backend:** Node.js, Express, TypeScript, SQLite3, PDFKit, QRCode, Nodemailer.
- **Storage:** Local SQLite database and file-system based uploads.

## 🚦 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd EveMange
   ```

2. **Install Server Dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install Client Dependencies:**
   ```bash
   cd ../client
   npm install
   ```

### Configuration

1. **Configure Backend Environment:**
   Open `server/.env` and update your SMTP settings:
   ```env
   EMAIL_HOST=smtp.your-provider.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@example.com
   EMAIL_PASS=your-app-password
   ```

### Running the Project

1. **Start the Backend (from `server/`):**
   ```bash
   npm run dev
   ```
2. **Start the Frontend (from `client/`):**
   ```bash
   npm start
   ```

- **Registration Portal:** [http://localhost:3000](http://localhost:3000)
- **API Server:** [http://localhost:5001](http://localhost:5001)

## 📊 Deployment Note

This system is designed to run on a local laptop or a simple VPS. Ensure the `uploads/` directory has write permissions for badge and QR code generation to function correctly.

## 📄 License

Internal Project - All Rights Reserved.
