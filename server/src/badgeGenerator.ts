import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface Attendee {
  fullName: string;
  designation?: string;
  company?: string;
  category: 'Delegate' | 'Media';
  qrCodePath: string;
}

export async function generateBadge(attendee: Attendee): Promise<string> {
  return new Promise((resolve, reject) => {
    const attendeeId = path.basename(attendee.qrCodePath, '.png');
    const badgeDir = path.join(__dirname, '../uploads/badges');
    
    if (!fs.existsSync(badgeDir)) {
      fs.mkdirSync(badgeDir, { recursive: true });
    }

    const badgePath = `uploads/badges/${attendeeId}.pdf`;
    const fullBadgePath = path.join(__dirname, '..', badgePath);
    
    const doc = new PDFDocument({
        size: [288, 432], // 4x6 inches
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
    });

    const stream = fs.createWriteStream(fullBadgePath);
    doc.pipe(stream);

    // Styling based on category
    const themeColor = attendee.category === 'Delegate' ? '#003366' : '#990000';
    
    // Header/Branding
    doc.rect(0, 0, 288, 60).fill(themeColor);
    doc.fillColor('#FFFFFF').fontSize(16).text('NH EVENT 2026', 0, 22, { align: 'center' });
    doc.fontSize(10).text(attendee.category.toUpperCase(), 0, 42, { align: 'center' });

    // Attendee Info
    doc.fillColor('#000000').fontSize(18).text(attendee.fullName, 20, 100, { align: 'center' });
    
    if (attendee.designation) {
      doc.fontSize(12).text(attendee.designation, 20, 130, { align: 'center' });
    }
    
    if (attendee.company) {
      doc.fontSize(12).font('Helvetica-Bold').text(attendee.company, 20, 150, { align: 'center' });
    }

    // QR Code
    const fullQrPath = path.join(__dirname, '..', attendee.qrCodePath);
    if (fs.existsSync(fullQrPath)) {
        doc.image(fullQrPath, 74, 180, { width: 140 });
    }

    // Footer
    doc.fontSize(10).font('Helvetica').text('Scan for Verification', 0, 340, { align: 'center' });

    doc.end();

    stream.on('finish', () => resolve(badgePath));
    stream.on('error', reject);
  });
}
