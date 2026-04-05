import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

interface DeliverySettings {
  id: string;
  free_delivery_threshold: number;
  fixed_delivery_charge: number;
  is_free_delivery_enabled: boolean;
}

const DeliverySettingsPage = () => {
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    free_delivery_threshold: 5000,
    fixed_delivery_charge: 200,
    is_free_delivery_enabled: false
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('delivery_settings')
      .select('*')
      .single();

    if (data) {
      setSettings(data);
      setFormData({
        free_delivery_threshold: data.free_delivery_threshold,
        fixed_delivery_charge: data.fixed_delivery_charge,
        is_free_delivery_enabled: data.is_free_delivery_enabled
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    const { error } = await supabase
      .from('delivery_settings')
      .update({
        ...formData,
        updated_at: new Date().toISOString()
      })
      .eq('id', settings?.id);

    if (!error) {
      await fetchSettings();
      alert('✅ Delivery settings updated successfully');
    } else {
      alert('❌ Failed to update settings');
    }

    setSaving(false);
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
        <h1 className="text-3xl font-bold text-gray-900">Delivery Settings</h1>
        <p className="text-gray-600 mt-1">Configure delivery charges and free shipping threshold</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 max-w-2xl">
        <div className="space-y-6">
          {/* Free Delivery Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Enable Free Delivery</h3>
              <p className="text-sm text-gray-500">
                Free delivery for orders above threshold
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_free_delivery_enabled}
                onChange={(e) => setFormData({
                  ...formData,
                  is_free_delivery_enabled: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-gold/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-gold"></div>
            </label>
          </div>

          {/* Free Delivery Threshold */}
          {formData.is_free_delivery_enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Free Delivery Threshold (₹)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={formData.free_delivery_threshold}
                onChange={(e) => setFormData({
                  ...formData,
                  free_delivery_threshold: parseFloat(e.target.value) || 0
                })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                placeholder="5000"
              />
              <p className="text-sm text-gray-500 mt-1">
                Orders above ₹{formData.free_delivery_threshold.toLocaleString()} will have free delivery
              </p>
            </div>
          )}

          {/* Fixed Delivery Charge */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fixed Delivery Charge (₹)
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={formData.fixed_delivery_charge}
              onChange={(e) => setFormData({
                ...formData,
                fixed_delivery_charge: parseFloat(e.target.value) || 0
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
              placeholder="200"
            />
            <p className="text-sm text-gray-500 mt-1">
              {formData.is_free_delivery_enabled
                ? `Applies when order is below ₹${formData.free_delivery_threshold.toLocaleString()}`
                : 'Applies to all orders'}
            </p>
          </div>

          {/* Current Settings Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Current Configuration</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                • Free Delivery: {formData.is_free_delivery_enabled ? (
                  <span className="font-medium">Enabled (above ₹{formData.free_delivery_threshold.toLocaleString()})</span>
                ) : (
                  <span className="font-medium">Disabled</span>
                )}
              </li>
              <li>
                • Delivery Charge: <span className="font-medium">₹{formData.fixed_delivery_charge}</span>
              </li>
            </ul>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-brand-gold text-brand-black py-3 rounded-lg font-semibold hover:bg-yellow-500 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default DeliverySettingsPage;