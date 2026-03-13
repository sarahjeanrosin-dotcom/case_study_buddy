import jsPDF from 'jspdf';

// ── PDF Export ────────────────────────────────────────────────────────────────

const MARGIN = 20;
const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BLUE = [37, 99, 235];
const DARK = [15, 23, 42];
const MID = [71, 85, 105];
const LIGHT_BG = [248, 250, 252];
const BORDER = [226, 232, 240];

function newPage(doc) {
  doc.addPage();
  return MARGIN;
}

function checkPageBreak(doc, y, needed = 10) {
  if (y + needed > PAGE_H - MARGIN) {
    return newPage(doc);
  }
  return y;
}

function drawSectionHeader(doc, y, title) {
  y = checkPageBreak(doc, y, 14);

  // Blue left border accent
  doc.setFillColor(...BLUE);
  doc.rect(MARGIN, y - 1, 3, 8, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text(title.toUpperCase(), MARGIN + 6, y + 6);

  y += 12;

  // Divider line
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  return y;
}

function drawText(doc, y, text, options = {}) {
  const {
    fontSize = 10,
    color = DARK,
    indent = 0,
    bold = false,
    lineHeight = 5,
  } = options;

  y = checkPageBreak(doc, y, lineHeight + 4);

  doc.setFontSize(fontSize);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(...color);

  const lines = doc.splitTextToSize(text, CONTENT_W - indent);
  lines.forEach((line, i) => {
    if (i > 0) y = checkPageBreak(doc, y, lineHeight);
    doc.text(line, MARGIN + indent, y);
    y += lineHeight;
  });
  return y;
}

function drawBullet(doc, y, text, color = DARK) {
  y = checkPageBreak(doc, y, 6);
  doc.setFillColor(...BLUE);
  doc.circle(MARGIN + 3, y - 1.5, 1, 'F');
  y = drawText(doc, y, text, { indent: 8, color, lineHeight: 5 });
  return y + 1;
}

export function downloadPDF(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // ── Cover band ──
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, PAGE_W, 38, 'F');

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Case Study Content', MARGIN, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(186, 211, 254);
  const customer = data.customer || 'Case Study';
  const industry = data.industry ? `  ·  ${data.industry}` : '';
  doc.text(`${customer}${industry}`, MARGIN, 28);

  doc.setFontSize(8);
  doc.setTextColor(147, 197, 253);
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, PAGE_W - MARGIN, 28, { align: 'right' });

  let y = 50;

  // ── Customer + Industry ──
  if (data.customer || data.industry) {
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(MARGIN, y, CONTENT_W, 20, 2, 2, 'F');

    if (data.customer) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...MID);
      doc.text('CUSTOMER', MARGIN + 6, y + 7);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(data.customer, MARGIN + 6, y + 14);
    }

    if (data.industry) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...MID);
      doc.text('INDUSTRY', PAGE_W / 2 + 4, y + 7);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(data.industry, PAGE_W / 2 + 4, y + 14);
    }

    y += 28;
  }

  // ── Challenge ──
  if (data.challenge) {
    y = drawSectionHeader(doc, y, 'Challenge');
    y = drawText(doc, y, data.challenge, { lineHeight: 5.5 });
    y += 6;
  }

  // ── Use Case ──
  if (data.use_case) {
    y = drawSectionHeader(doc, y, 'Use Case');
    y = drawText(doc, y, data.use_case, { lineHeight: 5.5 });
    y += 6;
  }

  // ── Business Outcomes ──
  if (data.business_outcomes?.length) {
    y = drawSectionHeader(doc, y, 'Business Outcomes');
    data.business_outcomes.forEach(item => {
      if (item?.trim()) y = drawBullet(doc, y, item.trim());
    });
    y += 6;
  }

  // ── Solutions ──
  if (data.solutions?.length) {
    y = drawSectionHeader(doc, y, 'Solutions');
    data.solutions.forEach(item => {
      if (item?.trim()) y = drawBullet(doc, y, item.trim());
    });
    y += 6;
  }

  // ── How Statements ──
  if (data.how_statements?.length) {
    y = drawSectionHeader(doc, y, 'How Statements');
    data.how_statements.forEach(item => {
      if (item?.trim()) y = drawBullet(doc, y, item.trim());
    });
    y += 6;
  }

  // ── Quotes ──
  if (data.quotes?.length) {
    y = drawSectionHeader(doc, y, 'Notable Quotes');

    data.quotes.forEach((q, i) => {
      if (!q?.text?.trim()) return;
      const quoteLines = doc.splitTextToSize(`"${q.text}"`, CONTENT_W - 12);
      const blockH = quoteLines.length * 5.5 + (q.attribution ? 10 : 4) + 8;

      y = checkPageBreak(doc, y, blockH);

      // Quote card background
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(MARGIN, y, CONTENT_W, blockH, 2, 2, 'F');

      // Blue left accent
      doc.setFillColor(...BLUE);
      doc.rect(MARGIN, y, 2, blockH, 'F');

      // Quote text
      y += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...DARK);
      quoteLines.forEach(line => {
        doc.text(line, MARGIN + 8, y);
        y += 5.5;
      });

      // Attribution
      if (q.attribution?.trim()) {
        y += 2;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...MID);
        doc.text(`— ${q.attribution}`, MARGIN + 8, y);
        y += 6;
      } else {
        y += 4;
      }

      if (i < data.quotes.length - 1) y += 3;
    });

    y += 4;
  }

  // ── Footer on all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MID);
    doc.text('Case Study Buddy', MARGIN, PAGE_H - 7);
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
  }

  const fileName = data.customer
    ? `${data.customer.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-case-study.pdf`
    : 'case-study.pdf';

  doc.save(fileName);
}

// ── Logo recoloring via Canvas ────────────────────────────────────────────────
// Colorizes a logo image: dark areas take on the target hex color,
// bright/white areas stay white. Transparent pixels are preserved.

export function recolorLogoCanvas(src, hexColor) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return reject(new Error('Invalid image dimensions'));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, w, h);
      const px = imageData.data;

      // Parse target color
      const hex = hexColor.replace('#', '');
      const tr = parseInt(hex.substring(0, 2), 16);
      const tg = parseInt(hex.substring(2, 4), 16);
      const tb = parseInt(hex.substring(4, 6), 16);

      for (let i = 0; i < px.length; i += 4) {
        const alpha = px[i + 3];
        if (alpha === 0) continue; // skip transparent

        const r = px[i], g = px[i + 1], b = px[i + 2];
        // Perceptual luminance: 0 = black, 1 = white
        const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        // Dark pixels → target color; bright pixels → white
        px[i]     = Math.round(tr + (255 - tr) * lum);
        px[i + 1] = Math.round(tg + (255 - tg) * lum);
        px[i + 2] = Math.round(tb + (255 - tb) * lum);
        // alpha unchanged
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('Failed to load image for recoloring'));
    img.src = src;
  });
}
