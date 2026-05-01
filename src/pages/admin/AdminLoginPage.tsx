import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import Logo from '../../components/Logo';

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, adminChecked, loading: appLoading } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // If AppContext finishes its post-login check and the signed-in user
  // is not an admin, sign them out and surface a clear error.
useEffect(() => {
    if (!submitting) return;
    if (appLoading || !adminChecked) return;
    if (user && isAdmin) {
      navigate('/admin/dashboard');
    } else if (user && !isAdmin) {
      setError('You are not authorized as an admin');
      setSubmitting(false);
      void supabase.auth.signOut();
    }
  }, [submitting, appLoading, adminChecked, user, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      // Single source of truth: AppContext checks admin_users on SIGNED_IN.
      // AdminProtectedRoute holds a LoadingScreen until that completes,
      // then either renders the dashboard or bounces non-admins back here.
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const buttonLoading = submitting || (!!user && (appLoading || !adminChecked));

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-black">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-white mt-4">Admin Portal</h1>
          <p className="text-gray-400 mt-2">Half Billion Dollar Management</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                placeholder="admin@halfbilliondollar.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={buttonLoading}
            className="w-full mt-8 bg-brand-black text-white py-4 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {buttonLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
