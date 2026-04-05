import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    franchise_name: '',
    owner_name: '',
    email: '',
    phone: '',
    site_location: '',
    full_address: '',
    city: '',
    state: 'Telangana',
    pincode: '',
    omc_partner: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      // 2. Create franchise record
      const { error: franchiseError } = await supabase
        .from('franchises')
        .insert({
          auth_user_id: authData.user?.id,
          franchise_name: formData.franchise_name,
          owner_name: formData.owner_name,
          email: formData.email,
          phone: formData.phone,
          site_location: formData.site_location,
          full_address: formData.full_address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          omc_partner: formData.omc_partner,
          status: 'pending'
        });

      if (franchiseError) throw franchiseError;
// ADD THIS - Notify admins of new franchise registration
      await supabase.rpc('create_notification', {
        p_recipient_type: 'admin',
        p_recipient_id: null,
        p_notification_type: 'new_franchise',
        p_title: `🏪 New Franchise Registration`,
        p_message: `${formData.franchise_name} (${formData.city}) registered and needs approval`,
        p_link: '/admin/franchises',
        p_metadata: { franchise_name: formData.franchise_name, city: formData.city }
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-brand-cream">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-semibold text-brand-black mb-2">Registration Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your franchise registration is pending approval. You'll receive an email once approved.
          </p>
          <Link to="/login" className="text-brand-gold hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-brand-cream">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-brand-black mt-4">Franchise Registration</h1>
          <p className="text-gray-600 mt-2">Join the Half Billion Dollar family</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Franchise Name *</label>
              <input
                type="text"
                name="franchise_name"
                required
                value={formData.franchise_name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                placeholder="e.g., ½B Coffee - Gachibowli"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Owner Name *</label>
              <input
                type="text"
                name="owner_name"
                required
                value={formData.owner_name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Site Location *</label>
              <input
                type="text"
                name="site_location"
                required
                value={formData.site_location}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                placeholder="e.g., HPCL Gachibowli Main Road"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">OMC Partner</label>
              <select
                name="omc_partner"
                value={formData.omc_partner}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
              >
                <option value="">Select Partner</option>
                <option value="HPCL">HPCL</option>
                <option value="BPCL">BPCL</option>
                <option value="IOCL">IOCL</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Address *</label>
              <textarea
                name="full_address"
                required
                value={formData.full_address}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                rows={2}
                placeholder="Complete address including landmarks"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
              <input
                type="text"
                name="city"
                required
                value={formData.city}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                placeholder="e.g., Hyderabad"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                placeholder="500032"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                placeholder="Min 6 characters"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-8 bg-brand-black text-white py-4 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Registration'}
          </button>

          <p className="text-center mt-6 text-gray-600">
            Already registered?{' '}
            <Link to="/login" className="text-brand-gold hover:underline font-medium">
              Login here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;