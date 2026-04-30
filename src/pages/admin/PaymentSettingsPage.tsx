import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

interface PaymentSettings {
  id: string;
  upi_id: string;
  qr_code_image_url: string;
  is_prepaid_enabled: boolean;
  instructions: string;
}

const PaymentSettingsPage = () => {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    upi_id: '',
    qr_code_image_url: '',
    is_prepaid_enabled: true,
    instructions: 'Scan QR code or pay to UPI ID. Enter transaction details after payment.'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('payment_settings')
      .select('*')
      .single();

    if (data) {
      setSettings(data);
      setFormData({
        upi_id: data.upi_id || '',
        qr_code_image_url: data.qr_code_image_url || '',
        is_prepaid_enabled: data.is_prepaid_enabled,
        instructions: data.instructions || 'Scan QR code or pay to UPI ID. Enter transaction details after payment.'
      });
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `qr-code-${Date.now()}.${fileExt}`;
      const filePath = `payment/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setFormData({ ...formData, qr_code_image_url: publicUrl });
    } catch (error: any) {
      alert('Failed to upload image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.upi_id) {
      alert('Please enter UPI ID');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('payment_settings')
      .update({
        ...formData,
        updated_at: new Date().toISOString()
      })
      .eq('id', settings?.id);

    if (!error) {
      await fetchSettings();
      alert('✅ Payment settings updated successfully');
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
        <h1 className="text-3xl font-bold text-gray-900">Payment Settings</h1>
        <p className="text-gray-600 mt-1">Configure UPI payment options for prepaid orders</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 max-w-2xl">
        <div className="space-y-6">
          {/* Enable Prepaid Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Enable Prepaid Orders</h3>
              <p className="text-sm text-gray-500">
                Allow franchises to pay via UPI before order confirmation
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_prepaid_enabled}
                onChange={(e) => setFormData({
                  ...formData,
                  is_prepaid_enabled: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-gold/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-gold"></div>
            </label>
          </div>

          {/* UPI ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              UPI ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.upi_id}
              onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
              placeholder="yourbusiness@upi"
            />
            <p className="text-sm text-gray-500 mt-1">
              Your UPI ID for receiving payments
            </p>
          </div>

          {/* QR Code Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              UPI QR Code
            </label>
            
            {formData.qr_code_image_url ? (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center">
                  <img 
                    src={formData.qr_code_image_url} 
                    alt="UPI QR Code" 
                    className="max-w-xs max-h-64 rounded-lg"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition"
                >
                  Change QR Code
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-brand-gold transition"
              >
                {uploading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-gold border-t-transparent"></div>
                    <span className="ml-2 text-gray-600">Uploading...</span>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl mb-2">📱</div>
                    <p className="text-gray-600">Click to upload QR code</p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
                  </div>
                )}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Payment Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Instructions
            </label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
              rows={3}
              placeholder="Instructions shown to franchises during checkout"
            />
          </div>

          {/* Current Settings Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Current Configuration</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                • Prepaid Orders: {formData.is_prepaid_enabled ? (
                  <span className="font-medium text-green-700">Enabled</span>
                ) : (
                  <span className="font-medium text-red-700">Disabled</span>
                )}
              </li>
              <li>
                • UPI ID: <span className="font-medium">{formData.upi_id || 'Not set'}</span>
              </li>
              <li>
                • QR Code: {formData.qr_code_image_url ? (
                  <span className="font-medium text-green-700">Uploaded</span>
                ) : (
                  <span className="font-medium text-gray-600">Not uploaded</span>
                )}
              </li>
            </ul>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !formData.upi_id}
            className="w-full bg-brand-gold text-brand-black py-3 rounded-lg font-semibold hover:bg-yellow-500 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default PaymentSettingsPage;
