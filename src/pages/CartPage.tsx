import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

interface DeliverySettings {
  free_delivery_threshold: number;
  fixed_delivery_charge: number;
  is_free_delivery_enabled: boolean;
}

interface PaymentSettings {
  upi_id: string;
  qr_code_image_url: string;
  is_prepaid_enabled: boolean;
  instructions: string;
}

const CartPage = () => {
  const navigate = useNavigate();
  const { cart, cartTotal, updateCartQuantity, removeFromCart, clearCart, franchise } = useApp();
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentType, setPaymentType] = useState<'cod' | 'prepaid'>('cod');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentTransactionId, setPaymentTransactionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>({
    free_delivery_threshold: 5000,
    fixed_delivery_charge: 200,
    is_free_delivery_enabled: false
  });

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    // Fetch delivery settings
    const { data: deliveryData } = await supabase
      .from('delivery_settings')
      .select('*')
      .single();
    
    if (deliveryData) {
      setDeliverySettings({
        free_delivery_threshold: deliveryData.free_delivery_threshold,
        fixed_delivery_charge: deliveryData.fixed_delivery_charge,
        is_free_delivery_enabled: deliveryData.is_free_delivery_enabled
      });
    }

    // Fetch payment settings
    const { data: paymentData } = await supabase
      .from('payment_settings')
      .select('*')
      .single();
    
    if (paymentData) {
      setPaymentSettings(paymentData);
    }
  };

  // Calculate minimum delivery date (48 hours from now)
  const getMinDeliveryDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date.toISOString().split('T')[0];
  };

  // Calculate subtotal (before GST)
  const subtotal = cart.reduce((sum, item) => 
    sum + (item.product.price * item.quantity), 0
  );

  // Calculate GST breakdown
  const franchiseState = franchise?.state || 'Telangana';
  const businessState = 'Telangana'; // Your business state

  const gstCalculation = cart.reduce((acc, item) => {
    const itemTotal = item.product.price * item.quantity;
    const gstRate = item.product.gst_rate || 0;
    const gstAmount = (itemTotal * gstRate) / 100;

    if (franchiseState === businessState) {
      // Intra-state: CGST + SGST
      acc.cgst += gstAmount / 2;
      acc.sgst += gstAmount / 2;
    } else {
      // Inter-state: IGST
      acc.igst += gstAmount;
    }
    acc.total += gstAmount;
    return acc;
  }, { cgst: 0, sgst: 0, igst: 0, total: 0 });

  // Calculate delivery charges
  const deliveryCharges = (() => {
    if (deliverySettings.is_free_delivery_enabled && 
        subtotal >= deliverySettings.free_delivery_threshold) {
      return 0;
    }
    return deliverySettings.fixed_delivery_charge;
  })();

  // Grand total
  const grandTotal = subtotal + gstCalculation.total + deliveryCharges;

  // MOQ validation
  const meetsMinimumOrder = grandTotal >= 2000;

  const handleCheckout = async () => {
    if (!deliveryDate) {
      setError('Please select a delivery date');
      return;
    }

    if (!meetsMinimumOrder) {
      setError('Minimum order value is ₹2,000');
      return;
    }

    if (paymentType === 'prepaid' && !paymentPhone && !paymentTransactionId) {
      setError('Please enter payment phone number or transaction ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Generate order number and PO number
      const orderNumber = `HBD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Date.now()).slice(-4)}`;
      const poNumber = `PO-${orderNumber}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          franchise_id: franchise?.id,
          order_number: orderNumber,
          po_number: poNumber,
          po_generated_at: new Date().toISOString(),
          subtotal: subtotal,
          gst_amount: gstCalculation.total,
          cgst_amount: gstCalculation.cgst,
          sgst_amount: gstCalculation.sgst,
          igst_amount: gstCalculation.igst,
          delivery_charges: deliveryCharges,
          total_amount: grandTotal,
          status: 'pending',
          payment_method: 'cod',
          payment_type: paymentType,
          payment_phone: paymentType === 'prepaid' ? paymentPhone : null,
          payment_transaction_id: paymentType === 'prepaid' ? paymentTransactionId : null,
          payment_status: paymentType === 'prepaid' ? 'pending' : 'pending',
          payment_verified: false,
          delivery_date: deliveryDate,
          delivery_address: franchise?.full_address,
          delivery_notes: deliveryNotes
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items with GST details
      const orderItems = cart.map(item => {
        const itemTotal = item.product.price * item.quantity;
        const gstRate = item.product.gst_rate || 0;
        const gstAmount = (itemTotal * gstRate) / 100;
        
        let cgst = 0, sgst = 0, igst = 0;
        if (franchiseState === businessState) {
          cgst = gstAmount / 2;
          sgst = gstAmount / 2;
        } else {
          igst = gstAmount;
        }

        return {
          order_id: order.id,
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.price,
          total_price: itemTotal,
          gst_rate: gstRate,
          hsn_code: item.product.hsn_code,
          cgst_amount: cgst,
          sgst_amount: sgst,
          igst_amount: igst,
          total_with_gst: itemTotal + gstAmount
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      clearCart();
      setSuccess(true);
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
            <h2 className="font-display text-2xl font-semibold text-brand-black mb-2">Order Placed Successfully!</h2>
            <p className="text-gray-600 mb-6">
              {paymentType === 'prepaid' 
                ? 'Your payment details have been received. We will verify and confirm your order soon.'
                : 'Your order has been confirmed. We\'ll deliver it on your selected date.'}
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
                className="bg-brand-gold text-brand-black px-6 py-3 rounded-lg font-medium hover:bg-yellow-500"
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
              className="inline-block bg-brand-gold text-brand-black px-6 py-3 rounded-lg font-medium hover:bg-yellow-500"
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
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-semibold text-brand-black mb-8">Your Cart</h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {!meetsMinimumOrder && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg mb-6">
            ⚠️ Minimum order value is ₹2,000. Add ₹{(2000 - grandTotal).toFixed(2)} more to proceed.
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map(item => (
              <div key={item.product.id} className="bg-white rounded-xl p-4 shadow-md flex gap-4">
                <div className="w-20 h-20 bg-brand-cream rounded-lg flex items-center justify-center flex-shrink-0">
                  {item.product.image_url ? (
                    <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span className="text-3xl opacity-30">📦</span>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-brand-black">{item.product.name}</h3>
                  <p className="text-sm text-gray-500">
                    ₹{item.product.price}/{item.product.unit}
                    {item.product.gst_rate > 0 && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        {item.product.gst_rate}% GST
                      </span>
                    )}
                  </p>

                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center border rounded-lg">
                      <button 
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="px-4 py-1 border-x">{item.quantity}</span>
                      <button 
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>

                    <span className="font-medium">₹{(item.product.price * item.quantity).toFixed(2)}</span>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="ml-auto text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary & Checkout */}
          <div className="space-y-4">
            {/* Order Summary */}
            <div className="bg-white rounded-xl p-6 shadow-md sticky top-24">
              <h2 className="font-display text-xl font-semibold text-brand-black mb-4">
                Order Summary
              </h2>
              
              <div className="space-y-3 text-sm mb-4 pb-4 border-b">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                </div>
                
                {franchiseState === businessState ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">CGST</span>
                      <span className="font-medium">₹{gstCalculation.cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">SGST</span>
                      <span className="font-medium">₹{gstCalculation.sgst.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-gray-600">IGST</span>
                    <span className="font-medium">₹{gstCalculation.igst.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery Charges</span>
                  <span className="font-medium">
                    {deliveryCharges === 0 ? (
                      <span className="text-green-600">FREE</span>
                    ) : (
                      `₹${deliveryCharges.toFixed(2)}`
                    )}
                  </span>
                </div>
                
                {deliverySettings.is_free_delivery_enabled && 
                 subtotal < deliverySettings.free_delivery_threshold && (
                  <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                    Add ₹{(deliverySettings.free_delivery_threshold - subtotal).toFixed(2)} more for FREE delivery!
                  </p>
                )}
              </div>
              
              <div className="flex justify-between text-lg font-semibold mb-6">
                <span>Total</span>
                <span className="text-brand-gold">₹{grandTotal.toFixed(2)}</span>
              </div>

              {/* Delivery Date */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Delivery Date *
                </label>
                <input
                  type="date"
                  required
                  min={getMinDeliveryDate()}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                />
              </div>

              {/* Delivery Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Notes
                </label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                  rows={2}
                  placeholder="Any special instructions..."
                />
              </div>

              {/* Payment Method */}
              {paymentSettings?.is_prepaid_enabled && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="payment"
                        value="cod"
                        checked={paymentType === 'cod'}
                        onChange={() => setPaymentType('cod')}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium">Cash on Delivery</div>
                        <div className="text-xs text-gray-500">Pay when you receive</div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="payment"
                        value="prepaid"
                        checked={paymentType === 'prepaid'}
                        onChange={() => setPaymentType('prepaid')}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium">Prepaid (UPI)</div>
                        <div className="text-xs text-gray-500">Pay now via UPI</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Prepaid Payment Details */}
              {paymentType === 'prepaid' && paymentSettings && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3">
                  <p className="text-sm text-blue-800">{paymentSettings.instructions}</p>
                  
                  {paymentSettings.qr_code_image_url && (
                    <div className="flex justify-center">
                      <img 
                        src={paymentSettings.qr_code_image_url} 
                        alt="UPI QR Code" 
                        className="w-40 h-40 border-2 border-blue-200 rounded-lg"
                      />
                    </div>
                  )}

                  {paymentSettings.upi_id && (
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">UPI ID</p>
                      <p className="font-mono text-sm font-medium">{paymentSettings.upi_id}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Payment Phone Number
                    </label>
                    <input
                      type="tel"
                      value={paymentPhone}
                      onChange={(e) => setPaymentPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold outline-none"
                      placeholder="Phone used for payment"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Transaction ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={paymentTransactionId}
                      onChange={(e) => setPaymentTransactionId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold outline-none"
                      placeholder="UPI Transaction ID"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={loading || !deliveryDate || !meetsMinimumOrder}
                className="w-full bg-brand-gold text-brand-black py-3 rounded-lg font-semibold hover:bg-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;