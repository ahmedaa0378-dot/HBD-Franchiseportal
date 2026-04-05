import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

interface CartSnapshot {
  id: string;
  franchise_id: string;
  cart_data: any;
  cart_total: number;
  created_at: string;
  reminder_sent_at: string | null;
  converted_to_order: boolean;
  franchises: {
    franchise_name: string;
    owner_name: string;
    email: string;
    phone: string;
    city: string;
  };
}

const AbandonedCartsPage = () => {
  const [abandonedCarts, setAbandonedCarts] = useState<CartSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCart, setSelectedCart] = useState<CartSnapshot | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    fetchAbandonedCarts();
  }, []);

  const fetchAbandonedCarts = async () => {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data } = await supabase
      .from('cart_snapshots')
      .select(`
        *,
        franchises(franchise_name, owner_name, email, phone, city)
      `)
      .eq('converted_to_order', false)
      .lt('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false });

    if (data) setAbandonedCarts(data as any);
    setLoading(false);
  };

  const sendReminder = async (cart: CartSnapshot) => {
    setSendingReminder(true);

    try {
      const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
      
      if (!webhookUrl) {
        alert('❌ Webhook URL not configured');
        return;
      }

      // Send to n8n
      const payload = {
        type: 'cart_abandonment_reminder',
        franchise: {
          name: cart.franchises.franchise_name,
          owner: cart.franchises.owner_name,
          email: cart.franchises.email,
          phone: cart.franchises.phone
        },
        cart: {
          items: cart.cart_data.items,
          total: cart.cart_total,
          abandoned_at: cart.created_at
        }
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Mark reminder as sent
      await supabase
        .from('cart_snapshots')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', cart.id);

      await fetchAbandonedCarts();
      setShowModal(false);
      alert('✅ Reminder sent successfully');
    } catch (error) {
      alert('❌ Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  const deleteSnapshot = async (cartId: string) => {
    if (!confirm('Delete this abandoned cart?')) return;

    await supabase
      .from('cart_snapshots')
      .delete()
      .eq('id', cartId);

    await fetchAbandonedCarts();
  };

  const getHoursAbandoned = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
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
        <h1 className="text-3xl font-bold text-gray-900">Abandoned Carts</h1>
        <p className="text-gray-600 mt-1">Recover lost sales with reminders</p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Abandoned</p>
              <p className="text-2xl font-bold text-gray-900">{abandonedCarts.length}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🛒</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Reminders Sent</p>
              <p className="text-2xl font-bold text-gray-900">
                {abandonedCarts.filter(c => c.reminder_sent_at).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📧</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Potential Revenue</p>
              <p className="text-2xl font-bold text-brand-gold">
                ₹{abandonedCarts.reduce((sum, c) => sum + c.cart_total, 0).toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>
      </div>

      {/* Abandoned Carts Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {abandonedCarts.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">✅</span>
            <p className="text-gray-500">No abandoned carts! Great job!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Franchise</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Items</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Cart Value</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Abandoned</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Reminder</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {abandonedCarts.map(cart => {
                  const hoursAbandoned = getHoursAbandoned(cart.created_at);

                  return (
                    <tr key={cart.id} className="border-t hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <p className="font-medium text-gray-900">{cart.franchises?.franchise_name}</p>
                        <p className="text-xs text-gray-500">{cart.franchises?.city}</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-gray-900">{cart.cart_data?.items?.length || 0} items</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-medium text-gray-900">₹{cart.cart_total.toFixed(2)}</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className={`text-sm ${hoursAbandoned > 48 ? 'text-red-600' : 'text-orange-600'}`}>
                          {hoursAbandoned}h ago
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(cart.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        {cart.reminder_sent_at ? (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Sent
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedCart(cart);
                              setShowModal(true);
                            }}
                            className="text-blue-600 hover:underline text-sm font-medium"
                          >
                            View
                          </button>
                          {!cart.reminder_sent_at && (
                            <button
                              onClick={() => sendReminder(cart)}
                              className="text-green-600 hover:underline text-sm font-medium"
                            >
                              Send Reminder
                            </button>
                          )}
                          <button
                            onClick={() => deleteSnapshot(cart.id)}
                            className="text-red-600 hover:underline text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cart Details Modal */}
      {showModal && selectedCart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Abandoned Cart Details</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Franchise Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Franchise Details</h3>
                <p className="text-gray-700">{selectedCart.franchises?.franchise_name}</p>
                <p className="text-sm text-gray-500">{selectedCart.franchises?.owner_name}</p>
                <p className="text-sm text-gray-500">{selectedCart.franchises?.email}</p>
                <p className="text-sm text-gray-500">{selectedCart.franchises?.phone}</p>
              </div>

              {/* Cart Items */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Cart Items</h3>
                <div className="space-y-2">
                  {selectedCart.cart_data?.items?.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{item.product_name}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-medium text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Cart Total</span>
                  <span className="text-brand-gold">₹{selectedCart.cart_total.toFixed(2)}</span>
                </div>
              </div>

              {/* Time Info */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800">
                  <strong>Abandoned:</strong> {getHoursAbandoned(selectedCart.created_at)} hours ago
                </p>
                {selectedCart.reminder_sent_at && (
                  <p className="text-sm text-green-700 mt-1">
                    <strong>Reminder sent:</strong> {new Date(selectedCart.reminder_sent_at).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            {!selectedCart.reminder_sent_at && (
              <div className="border-t p-6 bg-gray-50">
                <button
                  onClick={() => sendReminder(selectedCart)}
                  disabled={sendingReminder}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                >
                  {sendingReminder ? 'Sending...' : '📧 Send Reminder Email'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AbandonedCartsPage;