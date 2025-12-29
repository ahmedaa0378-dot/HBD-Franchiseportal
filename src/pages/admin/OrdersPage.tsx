import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  subtotal: number;
  total_amount: number;
  status: string;
  payment_method: string;
  payment_status: string;
  delivery_date: string;
  delivery_notes: string;
  created_at: string;
  franchises: {
    franchise_name: string;
    owner_name: string;
    phone: string;
    city: string;
    full_address: string;
  };
  order_items: OrderItem[];
}

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, franchises(franchise_name, owner_name, phone, city, full_address), order_items(*)')
      .order('created_at', { ascending: false });

    if (data) setOrders(data as any);
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdating(true);

    const updateData: any = { status: newStatus };
    
    // Add timestamp based on status
    if (newStatus === 'confirmed') updateData.confirmed_at = new Date().toISOString();
    if (newStatus === 'shipped') updateData.shipped_at = new Date().toISOString();
    if (newStatus === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
      updateData.payment_status = 'paid'; // COD paid on delivery
    }
    if (newStatus === 'cancelled') updateData.cancelled_at = new Date().toISOString();

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (!error) {
      setOrders(prev =>
        prev.map(o => o.id === orderId ? { ...o, ...updateData } : o)
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, ...updateData });
      }
    }

    setUpdating(false);
  };

  const statusFlow = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  
  const getNextStatus = (currentStatus: string) => {
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex < statusFlow.length - 1) {
      return statusFlow[currentIndex + 1];
    }
    return null;
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    processing: 'bg-purple-100 text-purple-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
  };

  const filteredOrders = filter === 'all'
    ? orders
    : orders.filter(o => o.status === filter);

  const statusCounts = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
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
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-600 mt-1">Manage and track all franchise orders</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === status
                ? 'bg-brand-black text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status as keyof typeof statusCounts] || 0})
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {filteredOrders.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No orders found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Order</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Franchise</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Items</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Delivery</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <tr key={order.id} className="border-t hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <p className="font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-gray-900">{order.franchises?.franchise_name}</p>
                      <p className="text-xs text-gray-500">{order.franchises?.city}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-600">{order.order_items?.length} items</span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-medium">₹{order.total_amount}</p>
                      <p className="text-xs text-gray-500">{order.payment_method?.toUpperCase()}</p>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-gray-900">
                        {new Date(order.delivery_date).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short'
                        })}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => { setSelectedOrder(order); setShowModal(true); }}
                        className="text-brand-gold hover:underline text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedOrder.order_number}</h2>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedOrder.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${statusColors[selectedOrder.status]}`}>
                  {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                </span>
                <span className="text-sm text-gray-500">
                  Payment: {selectedOrder.payment_status?.toUpperCase()}
                </span>
              </div>

              {/* Franchise Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Franchise Details</h3>
                <p className="text-gray-700">{selectedOrder.franchises?.franchise_name}</p>
                <p className="text-sm text-gray-500">{selectedOrder.franchises?.owner_name} • {selectedOrder.franchises?.phone}</p>
                <p className="text-sm text-gray-500 mt-1">{selectedOrder.franchises?.full_address}</p>
              </div>

              {/* Delivery Info */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Delivery</h3>
                <p className="text-gray-700">
                  📅 {new Date(selectedOrder.delivery_date).toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </p>
                {selectedOrder.delivery_notes && (
                  <p className="text-sm text-gray-500 mt-1">Notes: {selectedOrder.delivery_notes}</p>
                )}
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.order_items?.map(item => (
                    <div key={item.id} className="flex justify-between py-2 border-b">
                      <div>
                        <p className="text-gray-900">{item.product_name}</p>
                        <p className="text-sm text-gray-500">₹{item.unit_price} × {item.quantity}</p>
                      </div>
                      <p className="font-medium">₹{item.total_price}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 pt-4 border-t">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-bold text-lg">₹{selectedOrder.total_amount}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
              <div className="p-6 border-t bg-gray-50 flex gap-3">
                {getNextStatus(selectedOrder.status) && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, getNextStatus(selectedOrder.status)!)}
                    disabled={updating}
                    className="flex-1 bg-brand-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    {updating ? 'Updating...' : `Mark as ${getNextStatus(selectedOrder.status)?.charAt(0).toUpperCase()}${getNextStatus(selectedOrder.status)?.slice(1)}`}
                  </button>
                )}
                {selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => {
                      if (confirm('Cancel this order?')) {
                        updateOrderStatus(selectedOrder.id, 'cancelled');
                      }
                    }}
                    disabled={updating}
                    className="px-6 py-3 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default OrdersPage;