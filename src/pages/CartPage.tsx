import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

const CartPage = () => {
  const navigate = useNavigate();
  const { cart, cartTotal, updateCartQuantity, removeFromCart, clearCart, franchise } = useApp();
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Calculate minimum delivery date (48 hours from now)
  const getMinDeliveryDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date.toISOString().split('T')[0];
  };

  const handleCheckout = async () => {
    if (!deliveryDate) {
      setError('Please select a delivery date');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Generate order number
      const orderNumber = `HBD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Date.now()).slice(-4)}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          franchise_id: franchise?.id,
          order_number: orderNumber,
          subtotal: cartTotal,
          delivery_charges: 0,
          total_amount: cartTotal,
          status: 'pending',
          payment_method: 'cod',
          payment_status: 'pending',
          delivery_date: deliveryDate,
          delivery_address: franchise?.full_address,
          delivery_notes: deliveryNotes
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      setSuccess(true);
      clearCart();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-semibold text-brand-black mb-2">Order Placed!</h2>
            <p className="text-gray-600 mb-6">
              Your order has been submitted successfully. We'll deliver it on your selected date.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => navigate('/orders')}
                className="bg-brand-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800"
              >
                View Orders
              </button>
              <button
                onClick={() => { setSuccess(false); navigate('/catalog'); }}
                className="bg-brand-gold text-brand-black px-6 py-3 rounded-lg font-medium hover:bg-brand-gold-light"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <span className="text-6xl mb-4 block">🛒</span>
            <h2 className="font-display text-2xl font-semibold text-brand-black mb-2">Your cart is empty</h2>
            <p className="text-gray-600 mb-6">Browse our products and add items to your cart.</p>
            <Link
              to="/catalog"
              className="inline-block bg-brand-gold text-brand-black px-6 py-3 rounded-lg font-medium hover:bg-brand-gold-light"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-semibold text-brand-black mb-8">Your Cart</h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map(item => (
              <div key={item.product.id} className="bg-white rounded-xl p-4 shadow-md flex gap-4">
                <div className="w-20 h-20 bg-brand-cream rounded-lg flex items-center justify-center flex-shrink-0">
                  {item.product.image_url ? (
                    <img src={item.product.image_url} alt={item.product.name} className="h-full w-full object-cover rounded-lg" />
                  ) : (
                    <span className="text-3xl opacity-30">📦</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-brand-black">{item.product.name}</h3>
                  <p className="text-sm text-gray-500">₹{item.product.price} / {item.product.unit}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center border rounded-lg">
                      <button 
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="px-3 py-1">{item.quantity}</span>
                      <button 
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-red-500 text-sm hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-brand-black">₹{(item.product.price * item.quantity).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-24">
              <h2 className="font-display text-xl font-semibold text-brand-black mb-4">Order Summary</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery</span>
                  <span className="text-green-600">FREE</span>
                </div>
                <div className="border-t pt-3 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Date * <span className="text-gray-400 font-normal">(Min 48 hours)</span>
                </label>
                <input
                  type="date"
                  required
                  min={getMinDeliveryDate()}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Notes</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                  rows={2}
                  placeholder="Any special instructions..."
                />
              </div>

              <div className="bg-brand-cream rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-brand-black mb-1">Delivery Address</p>
                <p className="text-sm text-gray-600">{franchise?.full_address}</p>
              </div>

              <div className="bg-gray-100 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-brand-black mb-1">Payment Method</p>
                <p className="text-sm text-gray-600">💵 Cash on Delivery (COD)</p>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading || !deliveryDate}
                className="w-full bg-brand-black text-white py-4 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50"
              >
                {loading ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;