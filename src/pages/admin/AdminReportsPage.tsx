import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import * as XLSX from 'xlsx';
import {
  Download,
  Calendar,
  FileSpreadsheet,
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  Receipt,
  Loader2,
  RefreshCw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
type ReportType = 'sales' | 'orders' | 'gst' | 'franchise' | 'products';

interface DateRange {
  from: string;
  to: string;
}

// ─── Constants ───────────────────────────────────────────────
const REPORT_TYPES: { key: ReportType; label: string; icon: typeof TrendingUp; description: string }[] = [
  { key: 'sales', label: 'Sales Summary', icon: TrendingUp, description: 'Revenue, orders & average order value by period' },
  { key: 'orders', label: 'Orders Report', icon: ShoppingCart, description: 'Detailed order list with GST & payment info' },
  { key: 'gst', label: 'GST Report', icon: Receipt, description: 'Tax breakdown for GST filing (CGST/SGST/IGST)' },
  { key: 'franchise', label: 'Franchise Report', icon: Users, description: 'Performance by franchise — revenue, orders, activity' },
  { key: 'products', label: 'Product Report', icon: Package, description: 'Best sellers, quantities sold & revenue by product' },
];

// ─── Helpers ─────────────────────────────────────────────────
const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getPresetRange = (preset: string): DateRange => {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  let from = '';

  switch (preset) {
    case 'this_week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      from = d.toISOString().split('T')[0];
      break;
    }
    case 'this_month': {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      break;
    }
    case 'last_month': {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      from = d.toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from, to: end.toISOString().split('T')[0] };
    }
    case 'last_quarter': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      from = d.toISOString().split('T')[0];
      break;
    }
    case 'this_year': {
      from = `${now.getFullYear()}-01-01`;
      break;
    }
    default:
      from = `${now.getFullYear()}-01-01`;
  }

  return { from, to };
};

// ─── Component ───────────────────────────────────────────────
const AdminReportsPage = () => {
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [dateRange, setDateRange] = useState<DateRange>(getPresetRange('this_month'));
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    generateReport();
  }, [reportType, dateRange]);

  // ─── Report Generators ─────────────────────────────────────
  const generateReport = async () => {
    setLoading(true);
    setReportData([]);
    setSummaryStats([]);

    switch (reportType) {
      case 'sales': await generateSalesReport(); break;
      case 'orders': await generateOrdersReport(); break;
      case 'gst': await generateGSTReport(); break;
      case 'franchise': await generateFranchiseReport(); break;
      case 'products': await generateProductReport(); break;
    }

    setLoading(false);
  };

  // ─── Sales Summary ─────────────────────────────────────────
  const generateSalesReport = async () => {
    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount, subtotal, cgst_amount, sgst_amount, igst_amount, delivery_charges, status, created_at, payment_method')
      .neq('status', 'cancelled')
      .gte('created_at', `${dateRange.from}T00:00:00`)
      .lte('created_at', `${dateRange.to}T23:59:59`)
      .order('created_at', { ascending: true });

    if (!orders) return;

    // Group by date
    const dateMap = new Map<string, { orders: number; revenue: number; subtotal: number; gst: number; delivery: number; cod: number; prepaid: number }>();
    
    orders.forEach(o => {
      const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const existing = dateMap.get(date) || { orders: 0, revenue: 0, subtotal: 0, gst: 0, delivery: 0, cod: 0, prepaid: 0 };
      existing.orders += 1;
      existing.revenue += o.total_amount || 0;
      existing.subtotal += o.subtotal || 0;
      existing.gst += (o.cgst_amount || 0) + (o.sgst_amount || 0) + (o.igst_amount || 0);
      existing.delivery += o.delivery_charges || 0;
      if (o.payment_method === 'cod') existing.cod += 1;
      else existing.prepaid += 1;
      dateMap.set(date, existing);
    });

    const rows = Array.from(dateMap.entries()).map(([date, data]) => ({
      Date: date,
      Orders: data.orders,
      Subtotal: data.subtotal,
      GST: data.gst,
      Delivery: data.delivery,
      Revenue: data.revenue,
      'Avg Order Value': data.orders > 0 ? Math.round(data.revenue / data.orders) : 0,
      'COD Orders': data.cod,
      'Prepaid Orders': data.prepaid,
    }));

    const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const totalGST = orders.reduce((s, o) => s + (o.cgst_amount || 0) + (o.sgst_amount || 0) + (o.igst_amount || 0), 0);

    setSummaryStats([
      { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
      { label: 'Total Orders', value: orders.length.toString() },
      { label: 'Avg Order Value', value: formatCurrency(orders.length > 0 ? totalRevenue / orders.length : 0) },
      { label: 'Total GST Collected', value: formatCurrency(totalGST) },
    ]);

    setReportData(rows);
  };

  // ─── Orders Report ─────────────────────────────────────────
  const generateOrdersReport = async () => {
    const { data: orders } = await supabase
      .from('orders')
      .select('order_number, po_number, total_amount, subtotal, cgst_amount, sgst_amount, igst_amount, delivery_charges, status, payment_method, payment_status, payment_verified, delivery_date, created_at, franchises(franchise_name, city, state)')
      .gte('created_at', `${dateRange.from}T00:00:00`)
      .lte('created_at', `${dateRange.to}T23:59:59`)
      .order('created_at', { ascending: false });

    if (!orders) return;

    const rows = orders.map((o: any) => ({
      'Order Number': o.order_number,
      'PO Number': o.po_number || '-',
      'Franchise': o.franchises?.franchise_name || '-',
      'City': o.franchises?.city || '-',
      'State': o.franchises?.state || '-',
      'Subtotal': o.subtotal || 0,
      'CGST': o.cgst_amount || 0,
      'SGST': o.sgst_amount || 0,
      'IGST': o.igst_amount || 0,
      'Delivery': o.delivery_charges || 0,
      'Total': o.total_amount || 0,
      'Payment': (o.payment_method || '').toUpperCase(),
      'Payment Status': o.payment_verified ? 'Verified' : (o.payment_status || 'Pending'),
      'Order Status': o.status,
      'Order Date': new Date(o.created_at).toLocaleDateString('en-IN'),
      'Delivery Date': o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('en-IN') : '-',
    }));

    const totalRevenue = orders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
    const delivered = orders.filter((o: any) => o.status === 'delivered').length;
    const pending = orders.filter((o: any) => o.status === 'pending').length;

    setSummaryStats([
      { label: 'Total Orders', value: orders.length.toString() },
      { label: 'Total Value', value: formatCurrency(totalRevenue) },
      { label: 'Delivered', value: delivered.toString() },
      { label: 'Pending', value: pending.toString() },
    ]);

    setReportData(rows);
  };

  // ─── GST Report ────────────────────────────────────────────
  const generateGSTReport = async () => {
    const { data: orders } = await supabase
      .from('orders')
      .select('order_number, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, created_at, franchises(franchise_name, state)')
      .neq('status', 'cancelled')
      .gte('created_at', `${dateRange.from}T00:00:00`)
      .lte('created_at', `${dateRange.to}T23:59:59`)
      .order('created_at', { ascending: true });

    if (!orders) return;

    const rows = orders.map((o: any) => ({
      'Invoice No': o.order_number,
      'Date': new Date(o.created_at).toLocaleDateString('en-IN'),
      'Franchise': o.franchises?.franchise_name || '-',
      'State': o.franchises?.state || '-',
      'Taxable Value': o.subtotal || 0,
      'CGST': o.cgst_amount || 0,
      'SGST': o.sgst_amount || 0,
      'IGST': o.igst_amount || 0,
      'Total Tax': (o.cgst_amount || 0) + (o.sgst_amount || 0) + (o.igst_amount || 0),
      'Invoice Total': o.total_amount || 0,
    }));

    const totalCGST = orders.reduce((s: number, o: any) => s + (o.cgst_amount || 0), 0);
    const totalSGST = orders.reduce((s: number, o: any) => s + (o.sgst_amount || 0), 0);
    const totalIGST = orders.reduce((s: number, o: any) => s + (o.igst_amount || 0), 0);
    const taxableValue = orders.reduce((s: number, o: any) => s + (o.subtotal || 0), 0);

    setSummaryStats([
      { label: 'Taxable Value', value: formatCurrency(taxableValue) },
      { label: 'Total CGST', value: formatCurrency(totalCGST) },
      { label: 'Total SGST', value: formatCurrency(totalSGST) },
      { label: 'Total IGST', value: formatCurrency(totalIGST) },
    ]);

    setReportData(rows);
  };

  // ─── Franchise Report ──────────────────────────────────────
  const generateFranchiseReport = async () => {
    const { data: orders } = await supabase
      .from('orders')
      .select('franchise_id, total_amount, created_at, status, franchises(franchise_name, owner_name, city, state, omc_partner, phone)')
      .neq('status', 'cancelled')
      .gte('created_at', `${dateRange.from}T00:00:00`)
      .lte('created_at', `${dateRange.to}T23:59:59`);

    if (!orders) return;

    const franchiseMap = new Map<string, any>();

    orders.forEach((o: any) => {
      const fid = o.franchise_id;
      const existing = franchiseMap.get(fid) || {
        name: o.franchises?.franchise_name || '-',
        owner: o.franchises?.owner_name || '-',
        city: o.franchises?.city || '-',
        state: o.franchises?.state || '-',
        omc: o.franchises?.omc_partner || '-',
        phone: o.franchises?.phone || '-',
        orders: 0,
        revenue: 0,
        lastOrder: '',
      };
      existing.orders += 1;
      existing.revenue += o.total_amount || 0;
      if (!existing.lastOrder || o.created_at > existing.lastOrder) {
        existing.lastOrder = o.created_at;
      }
      franchiseMap.set(fid, existing);
    });

    const rows = Array.from(franchiseMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((f, i) => ({
        'Rank': i + 1,
        'Franchise': f.name,
        'Owner': f.owner,
        'City': f.city,
        'State': f.state,
        'OMC Partner': f.omc,
        'Phone': f.phone,
        'Orders': f.orders,
        'Revenue': f.revenue,
        'Avg Order Value': f.orders > 0 ? Math.round(f.revenue / f.orders) : 0,
        'Last Order': f.lastOrder ? new Date(f.lastOrder).toLocaleDateString('en-IN') : '-',
      }));

    const totalRevenue = orders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

    setSummaryStats([
      { label: 'Active Franchises', value: franchiseMap.size.toString() },
      { label: 'Total Orders', value: orders.length.toString() },
      { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
      { label: 'Avg per Franchise', value: formatCurrency(franchiseMap.size > 0 ? totalRevenue / franchiseMap.size : 0) },
    ]);

    setReportData(rows);
  };

  // ─── Product Report ────────────────────────────────────────
  const generateProductReport = async () => {
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_id, product_name, quantity, unit_price, total_price, orders!inner(created_at, status)')
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', `${dateRange.from}T00:00:00`)
      .lte('orders.created_at', `${dateRange.to}T23:59:59`);

    if (!orderItems) return;

    const productMap = new Map<string, any>();

    orderItems.forEach((item: any) => {
      const pid = item.product_id;
      const existing = productMap.get(pid) || {
        name: item.product_name,
        totalQty: 0,
        totalRevenue: 0,
        orderCount: 0,
        unitPrice: item.unit_price,
      };
      existing.totalQty += item.quantity;
      existing.totalRevenue += item.total_price;
      existing.orderCount += 1;
      productMap.set(pid, existing);
    });

    const rows = Array.from(productMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map((p, i) => ({
        'Rank': i + 1,
        'Product': p.name,
        'Unit Price': p.unitPrice,
        'Qty Sold': p.totalQty,
        'Times Ordered': p.orderCount,
        'Revenue': p.totalRevenue,
        'Avg Qty/Order': p.orderCount > 0 ? Math.round(p.totalQty / p.orderCount * 10) / 10 : 0,
      }));

    const totalRevenue = Array.from(productMap.values()).reduce((s, p) => s + p.totalRevenue, 0);
    const totalQty = Array.from(productMap.values()).reduce((s, p) => s + p.totalQty, 0);

    setSummaryStats([
      { label: 'Products Sold', value: productMap.size.toString() },
      { label: 'Total Qty Sold', value: totalQty.toLocaleString() },
      { label: 'Product Revenue', value: formatCurrency(totalRevenue) },
      { label: 'Top Seller', value: rows.length > 0 ? rows[0].Product : '-' },
    ]);

    setReportData(rows);
  };

  // ─── Export to Excel ───────────────────────────────────────
  const exportToExcel = () => {
    if (reportData.length === 0) return;
    setExporting(true);

    try {
      const ws = XLSX.utils.json_to_sheet(reportData);

      // Auto-width columns
      const colWidths = Object.keys(reportData[0]).map(key => {
        const maxLen = Math.max(
          key.length,
          ...reportData.map(row => String(row[key] ?? '').length)
        );
        return { wch: Math.min(maxLen + 2, 30) };
      });
      ws['!cols'] = colWidths;

      // Format currency columns
      const currencyColumns = ['Revenue', 'Total', 'Subtotal', 'CGST', 'SGST', 'IGST', 'Delivery',
        'Total Tax', 'Invoice Total', 'Taxable Value', 'Unit Price', 'Avg Order Value', 'GST'];
      
      const headers = Object.keys(reportData[0]);
      headers.forEach((header, colIndex) => {
        if (currencyColumns.includes(header)) {
          for (let rowIndex = 0; rowIndex < reportData.length; rowIndex++) {
            const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
            if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
              ws[cellRef].z = '₹#,##0.00';
            }
          }
        }
      });

      const wb = XLSX.utils.book_new();
      const reportLabel = REPORT_TYPES.find(r => r.key === reportType)?.label || 'Report';
      XLSX.utils.book_append_sheet(wb, ws, reportLabel);

      // Add summary sheet
      if (summaryStats.length > 0) {
        const summaryData = summaryStats.map(s => ({ Metric: s.label, Value: s.value }));
        summaryData.push({ Metric: '', Value: '' });
        summaryData.push({ Metric: 'Date Range', Value: `${dateRange.from} to ${dateRange.to}` });
        summaryData.push({ Metric: 'Generated On', Value: new Date().toLocaleString('en-IN') });
        const summaryWs = XLSX.utils.json_to_sheet(summaryData);
        summaryWs['!cols'] = [{ wch: 20 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
      }

      const fileName = `HBD_${reportLabel.replace(/\s+/g, '_')}_${dateRange.from}_to_${dateRange.to}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Export error:', err);
    }

    setExporting(false);
  };

  // ─── Get table columns for display ─────────────────────────
  const tableColumns = reportData.length > 0 ? Object.keys(reportData[0]) : [];

  const isCurrencyCol = (col: string) => {
    return ['Revenue', 'Total', 'Subtotal', 'CGST', 'SGST', 'IGST', 'Delivery',
      'Total Tax', 'Invoice Total', 'Taxable Value', 'Unit Price', 'Avg Order Value',
      'GST', 'Avg per Franchise'].includes(col);
  };

  // ─── Render ────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Generate and export business reports</p>
        </div>
        <button
          onClick={exportToExcel}
          disabled={exporting || reportData.length === 0}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={18} />
          )}
          Export to Excel
        </button>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {REPORT_TYPES.map(r => {
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              onClick={() => setReportType(r.key)}
              className={`rounded-xl p-4 text-left transition border ${
                reportType === r.key
                  ? 'border-brand-gold bg-amber-50 shadow-md'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <Icon size={20} className={reportType === r.key ? 'text-brand-gold' : 'text-gray-400'} />
              <p className="font-semibold text-gray-900 mt-2 text-sm">{r.label}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>
            </button>
          );
        })}
      </div>

      {/* Date Range Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-gold"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-gold"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'this_week', label: 'This Week' },
              { key: 'this_month', label: 'This Month' },
              { key: 'last_month', label: 'Last Month' },
              { key: 'last_quarter', label: 'Last 90D' },
              { key: 'this_year', label: 'This Year' },
            ].map(preset => (
              <button
                key={preset.key}
                onClick={() => setDateRange(getPresetRange(preset.key))}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            onClick={generateReport}
            className="ml-auto p-2 text-gray-500 hover:text-brand-gold rounded-lg hover:bg-gray-50 transition"
            title="Refresh report"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {summaryStats.map((stat, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">
              {REPORT_TYPES.find(r => r.key === reportType)?.label}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {dateRange.from} to {dateRange.to} · {reportData.length} rows
            </p>
          </div>
          {reportData.length > 0 && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1 text-sm text-green-600 hover:underline font-medium"
            >
              <Download size={14} />
              Download .xlsx
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span>Generating report...</span>
          </div>
        ) : reportData.length === 0 ? (
          <div className="text-center py-16">
            <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No data found for this date range</p>
            <p className="text-xs text-gray-400 mt-1">Try selecting a different period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {tableColumns.map(col => (
                    <th
                      key={col}
                      className={`py-3 px-4 text-xs font-semibold text-gray-500 whitespace-nowrap ${
                        isCurrencyCol(col) || ['Orders', 'Rank', 'Qty Sold', 'Times Ordered', 'Avg Qty/Order', 'COD Orders', 'Prepaid Orders'].includes(col)
                          ? 'text-right'
                          : 'text-left'
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.slice(0, 100).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t hover:bg-gray-50">
                    {tableColumns.map(col => (
                      <td
                        key={col}
                        className={`py-3 px-4 text-sm whitespace-nowrap ${
                          isCurrencyCol(col)
                            ? 'text-right font-medium text-gray-900'
                            : ['Orders', 'Rank', 'Qty Sold', 'Times Ordered', 'Avg Qty/Order', 'COD Orders', 'Prepaid Orders'].includes(col)
                            ? 'text-right text-gray-700'
                            : col === 'Rank' && row[col] <= 3
                            ? 'font-bold text-brand-gold'
                            : 'text-gray-700'
                        }`}
                      >
                        {isCurrencyCol(col) && typeof row[col] === 'number'
                          ? formatCurrency(row[col])
                          : row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {reportData.length > 100 && (
              <div className="text-center py-3 text-sm text-gray-500 border-t bg-gray-50">
                Showing 100 of {reportData.length} rows. Export to Excel for full data.
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminReportsPage;
