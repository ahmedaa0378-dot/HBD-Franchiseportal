import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';

interface CompanySettings {
  company_name: string;
  tagline: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
  gstin: string;
  invoice_prefix: string;
  invoice_notes: string;
  bank_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_branch: string;
}

interface InvoiceOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  hsn_code?: string;
  gst_rate?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
}

interface InvoiceOrder {
  id: string;
  order_number: string;
  po_number?: string;
  subtotal: number;
  delivery_charges?: number;
  total_amount: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  status: string;
  payment_method: string;
  payment_verified?: boolean;
  delivery_date: string;
  delivery_address?: string;
  delivery_notes?: string;
  created_at: string;
  order_items: InvoiceOrderItem[];
}

interface InvoiceFranchise {
  franchise_name: string;
  owner_name: string;
  full_address?: string;
  city: string;
  state: string;
  pincode?: string;
  phone: string;
  email: string;
  gst_number?: string;
}

const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getCompanySettings = async (): Promise<CompanySettings> => {
  const { data } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
  return data || {
    company_name: 'Half Billion Dollar', tagline: 'Premium Coffee Franchise',
    address: '', city: '', state: '', pincode: '', phone: '', email: '', website: '', gstin: '',
    invoice_prefix: 'INV', invoice_notes: 'Thank you for your order!',
    bank_name: '', bank_account_number: '', bank_ifsc: '', bank_branch: '',
  };
};

export const generateInvoice = async (order: InvoiceOrder, franchise: InvoiceFranchise): Promise<void> => {
  const company = await getCompanySettings();
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(201, 169, 98);
  doc.text(company.company_name, margin, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(company.tagline, margin, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(201, 169, 98);
  doc.text('TAX INVOICE', pageWidth - margin, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(`#${order.order_number}`, pageWidth - margin, 20, { align: 'right' });
  y = 40;

  const metaItems = [
    { label: 'Invoice Date', value: formatDate(order.created_at) },
    { label: 'Order Number', value: order.order_number },
    ...(order.po_number ? [{ label: 'PO Number', value: order.po_number }] : []),
    { label: 'Delivery Date', value: formatDate(order.delivery_date) },
    { label: 'Payment', value: (order.payment_method || 'COD').toUpperCase() },
    { label: 'Status', value: order.status.charAt(0).toUpperCase() + order.status.slice(1) },
  ];
  const metaColWidth = contentWidth / metaItems.length;
  metaItems.forEach((item, i) => {
    const x = margin + i * metaColWidth;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(156, 163, 175);
    doc.text(item.label, x, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 26, 26);
    doc.text(item.value, x, y + 5);
  });
  y += 16;
  doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const halfWidth = contentWidth / 2 - 5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(156, 163, 175);
  doc.text('FROM', margin, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 26);
  doc.text(company.company_name, margin, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(75, 85, 99);
  const fromLines = [company.address, `${company.city}, ${company.state} - ${company.pincode}`, company.phone ? `Phone: ${company.phone}` : '', company.gstin ? `GSTIN: ${company.gstin}` : ''].filter(Boolean);
  fromLines.forEach((line, i) => { doc.text(line, margin, y + 12 + i * 4.5); });

  const rightX = margin + halfWidth + 10;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(156, 163, 175);
  doc.text('BILL TO', rightX, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 26);
  doc.text(franchise.franchise_name, rightX, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(75, 85, 99);
  const toLines = [franchise.owner_name, franchise.full_address || `${franchise.city}, ${franchise.state}`, franchise.pincode ? `${franchise.city}, ${franchise.state} - ${franchise.pincode}` : '', `Phone: ${franchise.phone}`, franchise.gst_number ? `GSTIN: ${franchise.gst_number}` : ''].filter(Boolean);
  toLines.forEach((line, i) => { doc.text(line, rightX, y + 12 + i * 4.5); });
  y += 12 + Math.max(fromLines.length, toLines.length) * 4.5 + 10;

  const hasHSN = order.order_items.some(item => item.hsn_code);
  const hasGST = order.order_items.some(item => item.gst_rate);
  const isInterState = (order.igst_amount || 0) > 0;
  const tableColumns: any[] = [{ header: '#', dataKey: 'sno' }, { header: 'Item', dataKey: 'item' }];
  if (hasHSN) tableColumns.push({ header: 'HSN', dataKey: 'hsn' });
  tableColumns.push({ header: 'Qty', dataKey: 'qty' }, { header: 'Rate', dataKey: 'rate' }, { header: 'Amount', dataKey: 'amount' });
  if (hasGST) {
    tableColumns.push({ header: 'GST %', dataKey: 'gst_rate' });
    if (isInterState) { tableColumns.push({ header: 'IGST', dataKey: 'igst' }); }
    else { tableColumns.push({ header: 'CGST', dataKey: 'cgst' }, { header: 'SGST', dataKey: 'sgst' }); }
  }
  tableColumns.push({ header: 'Total', dataKey: 'total' });

  const tableRows = order.order_items.map((item, index) => {
    const row: any = { sno: (index + 1).toString(), item: item.product_name, qty: item.quantity.toString(), rate: formatCurrency(item.unit_price), amount: formatCurrency(item.unit_price * item.quantity) };
    if (hasHSN) row.hsn = item.hsn_code || '-';
    if (hasGST) {
      row.gst_rate = item.gst_rate ? `${item.gst_rate}%` : '-';
      if (isInterState) { row.igst = item.igst_amount ? formatCurrency(item.igst_amount) : '-'; }
      else { row.cgst = item.cgst_amount ? formatCurrency(item.cgst_amount) : '-'; row.sgst = item.sgst_amount ? formatCurrency(item.sgst_amount) : '-'; }
    }
    row.total = formatCurrency(item.total_price);
    return row;
  });

  autoTable(doc, {
    startY: y, columns: tableColumns, body: tableRows, theme: 'plain',
    styles: { fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, textColor: [26, 26, 26], lineColor: [229, 231, 235], lineWidth: 0.2 },
    headStyles: { fillColor: [249, 250, 251], textColor: [107, 114, 128], fontStyle: 'bold', fontSize: 7 },
    columnStyles: { sno: { halign: 'center', cellWidth: 8 }, item: { cellWidth: 'auto' }, qty: { halign: 'center', cellWidth: 14 }, rate: { halign: 'right', cellWidth: 22 }, amount: { halign: 'right', cellWidth: 24 }, gst_rate: { halign: 'center', cellWidth: 16 }, cgst: { halign: 'right', cellWidth: 20 }, sgst: { halign: 'right', cellWidth: 20 }, igst: { halign: 'right', cellWidth: 22 }, hsn: { halign: 'center', cellWidth: 18 }, total: { halign: 'right', cellWidth: 26, fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  const summaryX = pageWidth - margin - 80;
  const summaryWidth = 80;
  const lines: { label: string; value: string; bold?: boolean }[] = [];
  const subtotal = order.subtotal || order.order_items.reduce((sum, item) => sum + item.total_price, 0);
  lines.push({ label: 'Subtotal', value: formatCurrency(subtotal) });
  if ((order.cgst_amount || 0) > 0) lines.push({ label: 'CGST', value: formatCurrency(order.cgst_amount || 0) });
  if ((order.sgst_amount || 0) > 0) lines.push({ label: 'SGST', value: formatCurrency(order.sgst_amount || 0) });
  if ((order.igst_amount || 0) > 0) lines.push({ label: 'IGST', value: formatCurrency(order.igst_amount || 0) });
  if ((order.delivery_charges || 0) > 0) { lines.push({ label: 'Delivery', value: formatCurrency(order.delivery_charges || 0) }); }
  else { lines.push({ label: 'Delivery', value: 'FREE' }); }
  lines.push({ label: 'TOTAL', value: formatCurrency(order.total_amount), bold: true });

  const ssy = y;
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(summaryX - 5, ssy - 3, summaryWidth + 10, lines.length * 8 + 6, 2, 2, 'F');
  lines.forEach((line, i) => {
    const ly = ssy + 4 + i * 8;
    if (line.bold) { doc.setDrawColor(201, 169, 98); doc.setLineWidth(0.5); doc.line(summaryX - 3, ly - 4, summaryX + summaryWidth + 3, ly - 4); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 26); }
    else { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(75, 85, 99); }
    doc.text(line.label, summaryX, ly);
    doc.text(line.value, summaryX + summaryWidth, ly, { align: 'right' });
  });
  y = ssy + lines.length * 8 + 12;

  if (company.bank_name && company.bank_account_number) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(156, 163, 175);
    doc.text('BANK DETAILS', margin, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(75, 85, 99);
    const bl = [`Bank: ${company.bank_name}`, `A/C: ${company.bank_account_number}`, `IFSC: ${company.bank_ifsc}`, company.bank_branch ? `Branch: ${company.bank_branch}` : ''].filter(Boolean);
    bl.forEach((l, i) => { doc.text(l, margin, y + 5 + i * 4.5); });
    y += 5 + bl.length * 4.5 + 6;
  }

  if (order.delivery_notes) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(156, 163, 175);
    doc.text('DELIVERY NOTES', margin, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(75, 85, 99);
    const nl = doc.splitTextToSize(order.delivery_notes, contentWidth * 0.6);
    doc.text(nl, margin, y + 5);
  }

  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.3);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(201, 169, 98);
  doc.text(company.invoice_notes || 'Thank you for your order!', margin, footerY);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(156, 163, 175);
  doc.text(company.website, pageWidth / 2, footerY, { align: 'center' });
  doc.text(company.email, pageWidth - margin, footerY, { align: 'right' });
  doc.setFontSize(6);
  doc.text('This is a computer-generated invoice and does not require a signature.', pageWidth / 2, footerY + 5, { align: 'center' });

  const fileName = `Invoice_${order.order_number}_${formatDate(order.created_at).replace(/\s/g, '')}.pdf`;
  doc.save(fileName);
};

export default generateInvoice;
