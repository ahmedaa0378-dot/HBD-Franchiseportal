import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  IndianRupee,
  Users,
  AlertTriangle,
  BarChart3,
  Clock,
  MapPin,
  RefreshCw,
  Calendar,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
interface FranchisePerformance {
  franchise_id: string;
  franchise_name: string;
  city: string;
  state: string;
  omc_partner: string;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  last_order_date: string | null;
}

interface InactiveFranchise {
  id: string;
  franchise_name: string;
  owner_name: string;
  city: string;
  state: string;
  phone: string;
  last_order_date: string | null;
  days_inactive: number;
}

interface StateRevenue {
  state: string;
  revenue: number;
  orders: number;
}

interface MonthlyTrend {
  month: string;
  label: string;
  revenue: number;
  orders: number;
}

type PeriodFilter = '7d' | '30d' | '90d' | 'all';

// ─── Helpers ─────────────────────────────────────────────────
const getPeriodDate = (period: PeriodFilter): Date | null => {
  if (period === 'all') return null;
  const d = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d;
};

const formatCurrency = (amount: number): string => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

const daysSince = (dateStr: string | null): number => {
  if (!dateStr) return 999;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

// ─── Component ───────────────────────────────────────────────
const PerformancePage = () => {
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // KPIs
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [activeFranchises, setActiveFranchises] = useState(0);
  const [totalFranchises, setTotalFranchises] = useState(0);

  // Comparison KPIs (previous period)
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [prevOrders, setPrevOrders] = useState(0);

  // Tables & Charts
  const [topPerformers, setTopPerformers] = useState<FranchisePerformance[]>([]);
  const [inactiveFranchises, setInactiveFranchises] = useState<InactiveFranchise[]>([]);
  const [stateRevenue, setStateRevenue] = useState<StateRevenue[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);

  useEffect(() => {
    fetchAllData();
  }, [period]);

  const fetchAllData = async () => {
    if (!loading) setRefreshing(true);
    
    await Promise.all([
      fetchKPIs(),
      fetchTopPerformers(),
      fetchInactiveFranchises(),
      fetchStateRevenue(),
      fetchMonthlyTrend(),
    ]);

    setLoading(false);
    setRefreshing(false);
  };

  // ─── KPI Fetch ──────────────────────────────────────────────
  const fetchKPIs = async () => {
    const periodDate = getPeriodDate(period);

    // Current period orders
    let query = supabase
      .from('orders')
      .select('id, total_amount, franchise_id, created_at')
      .neq('status', 'cancelled');

    if (periodDate) {
      query = query.gte('created_at', periodDate.toISOString());
    }

    const { data: orders } = await query;

    if (orders) {
      const revenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const uniqueFranchises = new Set(orders.map(o => o.franchise_id)).size;

      setTotalRevenue(revenue);
      setTotalOrders(orders.length);
      setAvgOrderValue(orders.length > 0 ? revenue / orders.length : 0);
      setActiveFranchises(uniqueFranchises);
    }

    // Previous period for comparison (only if not 'all')
    if (periodDate && period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const prevStart = new Date(periodDate);
      prevStart.setDate(prevStart.getDate() - days);

      const { data: prevOrders } = await supabase
        .from('orders')
        .select('id, total_amount')
        .neq('status', 'cancelled')
        .gte('created_at', prevStart.toISOString())
        .lt('created_at', periodDate.toISOString());

      if (prevOrders) {
        setPrevRevenue(prevOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0));
        setPrevOrders(prevOrders.length);
      }
    } else {
      setPrevRevenue(0);
      setPrevOrders(0);
    }

    // Total franchises (approved)
    const { count } = await supabase
      .from('franchises')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved');

    setTotalFranchises(count || 0);
  };

  // ─── Top Performers ────────────────────────────────────────
  const fetchTopPerformers = async () => {
    const periodDate = getPeriodDate(period);

    let query = supabase
      .from('orders')
      .select('franchise_id, total_amount, created_at, franchises(franchise_name, city, state, omc_partner)')
      .neq('status', 'cancelled');

    if (periodDate) {
      query = query.gte('created_at', periodDate.toISOString());
    }

    const { data: orders } = await query;

    if (orders) {
      const franchiseMap = new Map<string, FranchisePerformance>();

      orders.forEach((order: any) => {
        const fid = order.franchise_id;
        const existing = franchiseMap.get(fid);

        if (existing) {
          existing.total_orders += 1;
          existing.total_revenue += order.total_amount || 0;
          if (!existing.last_order_date || order.created_at > existing.last_order_date) {
            existing.last_order_date = order.created_at;
          }
        } else {
          franchiseMap.set(fid, {
            franchise_id: fid,
            franchise_name: order.franchises?.franchise_name || 'Unknown',
            city: order.franchises?.city || '',
            state: order.franchises?.state || '',
            omc_partner: order.franchises?.omc_partner || '',
            total_orders: 1,
            total_revenue: order.total_amount || 0,
            avg_order_value: 0,
            last_order_date: order.created_at,
          });
        }
      });

      const performers = Array.from(franchiseMap.values())
        .map(f => ({ ...f, avg_order_value: f.total_revenue / f.total_orders }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);

      setTopPerformers(performers);
    }
  };

  // ─── Inactive Franchises ───────────────────────────────────
  const fetchInactiveFranchises = async () => {
    // Get all approved franchises
    const { data: franchises } = await supabase
      .from('franchises')
      .select('id, franchise_name, owner_name, city, state, phone')
      .eq('status', 'approved');

    if (!franchises) return;

    // Get last order date per franchise
    const { data: orders } = await supabase
      .from('orders')
      .select('franchise_id, created_at')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    const lastOrderMap = new Map<string, string>();
    orders?.forEach(o => {
      if (!lastOrderMap.has(o.franchise_id)) {
        lastOrderMap.set(o.franchise_id, o.created_at);
      }
    });

    const inactive: InactiveFranchise[] = franchises
      .map(f => ({
        ...f,
        last_order_date: lastOrderMap.get(f.id) || null,
        days_inactive: daysSince(lastOrderMap.get(f.id) || null),
      }))
      .filter(f => f.days_inactive >= 7)
      .sort((a, b) => b.days_inactive - a.days_inactive);

    setInactiveFranchises(inactive);
  };

  // ─── Revenue by State ──────────────────────────────────────
  const fetchStateRevenue = async () => {
    const periodDate = getPeriodDate(period);

    let query = supabase
      .from('orders')
      .select('total_amount, franchises(state)')
      .neq('status', 'cancelled');

    if (periodDate) {
      query = query.gte('created_at', periodDate.toISOString());
    }

    const { data: orders } = await query;

    if (orders) {
      const stateMap = new Map<string, { revenue: number; orders: number }>();

      orders.forEach((order: any) => {
        const state = order.franchises?.state || 'Unknown';
        const existing = stateMap.get(state) || { revenue: 0, orders: 0 };
        existing.revenue += order.total_amount || 0;
        existing.orders += 1;
        stateMap.set(state, existing);
      });

      const stateData = Array.from(stateMap.entries())
        .map(([state, data]) => ({ state, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);

      setStateRevenue(stateData);
    }
  };

  // ─── Monthly Trend ─────────────────────────────────────────
  const fetchMonthlyTrend = async () => {
    // Always fetch last 6 months for trend regardless of period filter
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount, created_at')
      .neq('status', 'cancelled')
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: true });

    if (orders) {
      const monthMap = new Map<string, { revenue: number; orders: number }>();

      // Pre-fill last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(key, { revenue: 0, orders: 0 });
      }

      orders.forEach(order => {
        const d = new Date(order.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const existing = monthMap.get(key) || { revenue: 0, orders: 0 };
        existing.revenue += order.total_amount || 0;
        existing.orders += 1;
        monthMap.set(key, existing);
      });

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const trend = Array.from(monthMap.entries()).map(([key, data]) => ({
        month: key,
        label: months[parseInt(key.split('-')[1]) - 1],
        ...data,
      }));

      setMonthlyTrend(trend);
    }
  };

  // ─── Change Calculation ────────────────────────────────────
  const getChangePercent = (current: number, previous: number): number | null => {
    if (period === 'all' || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const revenueChange = getChangePercent(totalRevenue, prevRevenue);
  const ordersChange = getChangePercent(totalOrders, prevOrders);

  // ─── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-gold border-t-transparent"></div>
        </div>
      </AdminLayout>
    );
  }

  const maxStateRevenue = Math.max(...stateRevenue.map(s => s.revenue), 1);
  const maxMonthlyRevenue = Math.max(...monthlyTrend.map(m => m.revenue), 1);

  const periodLabels: Record<PeriodFilter, string> = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    'all': 'All Time',
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Franchise Performance</h1>
          <p className="text-gray-600 mt-1">Monitor franchise activity, revenue & engagement</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAllData()}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-brand-gold rounded-lg hover:bg-white transition disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>

          <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            {(['7d', '30d', '90d', 'all'] as PeriodFilter[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  period === p
                    ? 'bg-brand-black text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p === 'all' ? 'All' : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <KPICard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={<IndianRupee size={20} />}
          change={revenueChange}
          period={periodLabels[period]}
          color="bg-amber-50 text-amber-600"
        />
        <KPICard
          label="Total Orders"
          value={totalOrders.toLocaleString()}
          icon={<ShoppingCart size={20} />}
          change={ordersChange}
          period={periodLabels[period]}
          color="bg-blue-50 text-blue-600"
        />
        <KPICard
          label="Avg Order Value"
          value={formatCurrency(avgOrderValue)}
          icon={<BarChart3 size={20} />}
          change={null}
          period={periodLabels[period]}
          color="bg-purple-50 text-purple-600"
        />
        <KPICard
          label="Active Franchises"
          value={`${activeFranchises} / ${totalFranchises}`}
          icon={<Users size={20} />}
          change={null}
          period={`ordered in ${periodLabels[period].toLowerCase()}`}
          color="bg-green-50 text-green-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Revenue Trend */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Revenue Trend</h2>
              <p className="text-sm text-gray-500 mt-0.5">Last 6 months</p>
            </div>
            <Calendar size={18} className="text-gray-400" />
          </div>

          {monthlyTrend.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No data available</p>
          ) : (
            <div className="space-y-3">
              {monthlyTrend.map(m => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-8 shrink-0">{m.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-gold to-amber-400 transition-all duration-700 ease-out flex items-center"
                      style={{ width: `${Math.max((m.revenue / maxMonthlyRevenue) * 100, 2)}%` }}
                    >
                      {m.revenue > 0 && (
                        <span className="text-xs font-medium text-brand-black px-2 whitespace-nowrap">
                          {formatCurrency(m.revenue)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-12 text-right shrink-0">{m.orders} ord</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue by State */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Revenue by State</h2>
              <p className="text-sm text-gray-500 mt-0.5">{periodLabels[period]}</p>
            </div>
            <MapPin size={18} className="text-gray-400" />
          </div>

          {stateRevenue.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No data available</p>
          ) : (
            <div className="space-y-3">
              {stateRevenue.map((s, i) => (
                <div key={s.state} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-24 truncate shrink-0" title={s.state}>
                    {s.state}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out flex items-center"
                      style={{
                        width: `${Math.max((s.revenue / maxStateRevenue) * 100, 2)}%`,
                        backgroundColor: `hsl(${35 + i * 8}, ${75 - i * 5}%, ${55 + i * 3}%)`,
                      }}
                    >
                      {s.revenue > 0 && (
                        <span className="text-xs font-medium text-white px-2 whitespace-nowrap drop-shadow-sm">
                          {formatCurrency(s.revenue)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-12 text-right shrink-0">{s.orders} ord</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inactive Franchises Alert */}
      {inactiveFranchises.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-8 border-l-4 border-amber-400">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={20} className="text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900">
              Inactive Franchises
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({inactiveFranchises.length} franchise{inactiveFranchises.length !== 1 ? 's' : ''} with no orders in 7+ days)
              </span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Franchise</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Owner</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Location</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Last Order</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Days Inactive</th>
                </tr>
              </thead>
              <tbody>
                {inactiveFranchises.slice(0, 10).map(f => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{f.franchise_name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-gray-700">{f.owner_name}</p>
                      <p className="text-xs text-gray-400">{f.phone}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-gray-700">{f.city}</p>
                      <p className="text-xs text-gray-400">{f.state}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {f.last_order_date
                        ? new Date(f.last_order_date).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : 'Never ordered'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          f.days_inactive >= 30
                            ? 'bg-red-100 text-red-700'
                            : f.days_inactive >= 14
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        <Clock size={12} />
                        {f.days_inactive >= 999 ? 'Never' : `${f.days_inactive}d`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {inactiveFranchises.length > 10 && (
            <p className="text-sm text-gray-500 mt-3 text-center">
              + {inactiveFranchises.length - 10} more inactive franchises
            </p>
          )}
        </div>
      )}

      {/* Top Performers Table */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Top Performing Franchises</h2>
            <p className="text-sm text-gray-500 mt-0.5">{periodLabels[period]} — ranked by revenue</p>
          </div>
          <TrendingUp size={18} className="text-gray-400" />
        </div>

        {topPerformers.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No orders in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 w-10">#</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Franchise</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">OMC</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Orders</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Revenue</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Avg Order</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Last Order</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((f, i) => (
                  <tr key={f.franchise_id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          i === 0
                            ? 'bg-brand-gold text-brand-black'
                            : i === 1
                            ? 'bg-gray-300 text-gray-700'
                            : i === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{f.franchise_name}</p>
                      <p className="text-xs text-gray-500">{f.city}, {f.state}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{f.omc_partner || '-'}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">{f.total_orders}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-semibold text-gray-900">{formatCurrency(f.total_revenue)}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-600">
                      {formatCurrency(f.avg_order_value)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-500">
                      {f.last_order_date
                        ? new Date(f.last_order_date).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short',
                          })
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

// ─── KPI Card Sub-component ──────────────────────────────────
const KPICard = ({
  label,
  value,
  icon,
  change,
  period,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  change: number | null;
  period: string;
  color: string;
}) => (
  <div className="bg-white rounded-xl shadow-md p-5">
    <div className="flex items-start justify-between mb-3">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
    </div>
    <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
    <div className="flex items-center gap-1">
      {change !== null ? (
        <>
          {change >= 0 ? (
            <TrendingUp size={14} className="text-green-500" />
          ) : (
            <TrendingDown size={14} className="text-red-500" />
          )}
          <span className={`text-xs font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
          <span className="text-xs text-gray-400 ml-1">vs prev period</span>
        </>
      ) : (
        <span className="text-xs text-gray-400">{period}</span>
      )}
    </div>
  </div>
);

export default PerformancePage;
