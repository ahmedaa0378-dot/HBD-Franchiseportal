import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  gst_rate: number;
  hsn_code: string;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_with_gst: number;
}

interface Order {
  id: string;
  order_number: string;
  subtotal: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  delivery_charges: number;
  total_amount: number;
  status: string;
  payment_method: string;
  payment_type: string;
  payment_status: string;
  payment_phone: string;
  payment_transaction_id: string;
  payment_verified: boolean;
  payment_verified_at: string;
  delivery_date: string;
  delivery_notes: string;
  created_at: string;
  franchises: {
    franchise_name: string;
    owner_name: string;
    phone: string;
    city: string;
    full_address: string;
    state: string;
  };
  order_items: OrderItem[];
}

const OrdersPage = () => {
  const { franchise } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('franchise_id', franchise?.id)
      .order('created_at', { ascending: false });

    if (data) setOrders(data);
    setLoading(false);
  };

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
      <div className="min-h-screen bg-brand-cream">
        <Header />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-gold border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-semibold text-brand-black mb-8">My Orders</h1>

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <span className="text-6xl mb-4 block">📋</span>
            <h2 className="font-display text-2xl font-semibold text-brand-black mb-2">No orders yet</h2>
            <p className="text-gray-600">Your order history will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-brand-black">{order.order_number}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('en-IN', { 
                          day: 'numeric', month: 'short', year: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      <p className="font-bold text-brand-black mt-1">₹{order.total_amount}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <p className="text-sm text-gray-600">
                      📅 Delivery: {new Date(order.delivery_date).toLocaleDateString('en-IN', { 
                        day: 'numeric', month: 'short', year: 'numeric' 
                      })}
                    </p>
                    <p className="text-sm text-gray-600">
                      {order.order_items?.length} items
                    </p>
                  </div>
                </div>

                {/* Order Details */}
                {selectedOrder === order.id && (
                  <div className="border-t bg-gray-50 p-4">
                    <p className="font-medium text-brand-black mb-3">Order Items</p>
                    <div className="space-y-2">
                      {order.order_items?.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {item.product_name} × {item.quantity}
                          </span>
                          <span className="text-brand-black">₹{item.total_price}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Payment Method</span>
                        <span className="text-brand-black">{order.payment_method?.toUpperCase()}</span>
                      </div>
                      {order.delivery_notes && (
                        <div className="mt-2">
                          <span className="text-sm text-gray-600">Notes: {order.delivery_notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;