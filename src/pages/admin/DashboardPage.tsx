import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

interface DashboardStats {
  total_franchises: number;
  pending_approvals: number;
  pending_orders: number;
  orders_this_week: number;
  revenue_this_month: number;
  low_stock_products: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  franchises: { franchise_name: string; city: string };
}

const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    // Fetch stats
    const { data: statsData } = await supabase
      .from('dashboard_summary')
      .select('*')
      .single();

    if (statsData) setStats(statsData);

    // Fetch recent orders
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, status, created_at, franchises(franchise_name, city)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordersData) setRecentOrders(ordersData as any);

    setLoading(false);
  };

  const statCards = [
    { label: 'Total Franchises', value: stats?.total_franchises || 0, icon: '🏪', color: 'bg-blue-500' },
    { label: 'Pending Approvals', value: stats?.pending_approvals || 0, icon: '⏳', color: 'bg-yellow-500', link: '/admin/franchises' },
    { label: 'Pending Orders', value: stats?.pending_orders || 0, icon: '🛒', color: 'bg-purple-500', link: '/admin/orders' },
    { label: 'Orders This Week', value: stats?.orders_this_week || 0, icon: '📈', color: 'bg-green-500' },
    { label: 'Revenue (30 days)', value: `₹${(stats?.revenue_this_month || 0).toLocaleString()}`, icon: '💰', color: 'bg-brand-gold' },
    { label: 'Low Stock Items', value: stats?.low_stock_products || 0, icon: '⚠️', color: 'bg-red-500', link: '/admin/inventory' },
  ];

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    processing: 'bg-purple-100 text-purple-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-gold border-t-transparent"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to Half Billion Dollar Admin Portal</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-md p-6">
            {stat.link ? (
              <Link to={stat.link} className="block hover:opacity-80 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center text-2xl`}>
                    {stat.icon}
                  </div>
                </div>
              </Link>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center text-2xl`}>
                  {stat.icon}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Recent Orders</h2>
          <Link to="/admin/orders" className="text-brand-gold hover:underline text-sm font-medium">
            View All →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No orders yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Order</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Franchise</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{order.order_number}</td>
                    <td className="py-3 px-4">
                      <p className="text-gray-900">{order.franchises?.franchise_name}</p>
                      <p className="text-xs text-gray-500">{order.franchises?.city}</p>
                    </td>
                    <td className="py-3 px-4 font-medium">₹{order.total_amount}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short'
                      })}
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

export default DashboardPage;