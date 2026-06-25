import jsPDF from 'jspdf';

export interface ReceiptData {
  reference: string;
  providerReference?: string | null;
  amount: number;
  status: string;
  type: string;
  category: string;
  paymentMethod?: string | null;
  paymentChannel?: string | null;
  provider?: string | null;
  description?: string | null;
  createdAt: string;
  payerName?: string | null;
  payerEmail?: string | null;
  walletBalanceAfter?: number | null;
}

const NAVY: [number, number, number] = [13, 74, 107]; // #0d4a6b
const GREEN: [number, number, number] = [22, 163, 74];
const AMBER: [number, number, number] = [202, 138, 4];
const SLATE: [number, number, number] = [100, 116, 139];
const INK: [number, number, number] = [15, 23, 42];
const LINE: [number, number, number] = [226, 232, 240];

const fmtNaira = (n: number) =>
  `NGN ${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

export function generateReceiptPdf(data: ReceiptData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Payment Receipt', margin, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Ahmadiyya Science College Ilaro — Payment Portal', margin, 70);

  // Status pill
  const pill = data.status === 'completed' ? GREEN : AMBER;
  doc.setFillColor(...pill);
  doc.roundedRect(w - margin - 100, 30, 100, 26, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(data.status.toUpperCase(), w - margin - 50, 47, { align: 'center' });

  // Amount
  doc.setTextColor(...INK);
  let y = 130;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(fmtNaira(data.amount), margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text(
    `${data.type === 'credit' ? 'Credit to wallet' : 'Debit from wallet'} • ${data.category.replace(/_/g, ' ')}`,
    margin,
    y + 16,
  );

  y += 44;
  doc.setDrawColor(...LINE);
  doc.line(margin, y, w - margin, y);
  y += 22;

  const rows: Array<[string, string]> = [
    ['Internal reference', data.reference],
    ['Provider reference', data.providerReference || '—'],
    ['Date & time', fmtDateTime(data.createdAt)],
    ['Payment method', (data.paymentMethod || data.paymentChannel || 'bank_transfer').replace(/_/g, ' ')],
    ['Provider', data.provider || 'wema'],
    ['Payer', data.payerName || '—'],
    ['Email', data.payerEmail || '—'],
  ];
  if (data.description) rows.push(['Description', data.description]);
  if (data.walletBalanceAfter != null)
    rows.push(['Wallet balance after', fmtNaira(data.walletBalanceAfter)]);

  doc.setFontSize(10);
  rows.forEach(([label, value]) => {
    doc.setTextColor(...SLATE);
    doc.setFont('helvetica', 'normal');
    doc.text(label, margin, y);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    const wrapped = doc.splitTextToSize(String(value), w - margin * 2 - 180);
    doc.text(wrapped, margin + 180, y);
    y += 16 * Math.max(1, wrapped.length) + 4;
  });

  // Footer
  const fy = h - 60;
  doc.setDrawColor(...LINE);
  doc.line(margin, fy, w - margin, fy);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text('This receipt was generated automatically. Keep it for your records.', margin, fy + 18);
  doc.text(`Generated ${new Date().toLocaleString('en-NG')}`, margin, fy + 32);

  return doc;
}

export function downloadReceipt(data: ReceiptData) {
  const doc = generateReceiptPdf(data);
  const safe = (data.providerReference || data.reference).replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`receipt-${safe}.pdf`);
}
