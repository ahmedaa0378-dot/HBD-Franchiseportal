import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import Logo from '../components/Logo';

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, franchise, loading: appLoading } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // If AppContext finishes its post-login fetch and we have a session
  // but no franchise record, the user signed in with non-franchise credentials
  // (e.g. admin). Sign out and surface a clear error instead of silently
  // bouncing them back to the login form.
  useEffect(() => {
    if (appLoading) return;
    if (user && !franchise) {
      setError('No franchise account found for this email. If you are an admin, please use the admin login.');
      setSubmitting(false);
      void supabase.auth.signOut();
    }
  }, [appLoading, user, franchise]);

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

      // Single source of truth: AppContext fetches the franchise record on
      // the SIGNED_IN event. ProtectedRoute will hold a LoadingScreen until
      // that finishes, then route based on franchise.status.
      navigate('/catalog');
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const buttonLoading = submitting || (!!user && appLoading);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-cream">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-brand-black mt-4">Welcome Back</h1>
          <p className="text-gray-600 mt-2">Login to your franchise portal</p>
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
                placeholder="your@email.com"
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
            {buttonLoading ? 'Logging in...' : 'Login'}
          </button>

          <p className="text-center mt-6 text-gray-600">
            New franchise?{' '}
            <Link to="/register" className="text-brand-gold hover:underline font-medium">
              Register here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
