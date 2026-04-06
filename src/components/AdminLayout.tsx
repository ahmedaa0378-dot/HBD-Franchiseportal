import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from './Logo';
import NotificationBell from './NotificationBell';


interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [adminUserId, setAdminUserId] = useState<string>('');

  useEffect(() => {
    // Get current admin user ID
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setAdminUserId(user.id);
    };
    getUser();
  }, []);
  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/admin/franchises', label: 'Franchises', icon: '🏪' },
    { path: '/admin/products', label: 'Products', icon: '📦' },
    { path: '/admin/bundles', label: 'Bundles', icon: '🎁' }, // ADD THIS
    { path: '/admin/orders', label: 'Orders', icon: '🛒' },
    { path: '/admin/abandoned-carts', label: 'Abandoned Carts', icon: '⚠️' }, // ADD THIS
    { path: '/admin/inventory', label: 'Inventory', icon: '📋' },
    { path: '/admin/delivery-settings', label: 'Delivery', icon: '🚚' }, // ADD THIS
    { path: '/admin/payment-settings', label: 'Payment', icon: '💳' }, // ADD THIS
    { path: '/admin/performance', label: 'Performance', icon: '📈' },
    { path: '/admin/reports', label: 'Reports', icon: '📊' },


  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-black text-white flex flex-col fixed h-full">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div>
              <h1 className="font-display text-lg font-semibold text-brand-gold">½B Admin</h1>
              <p className="text-xs text-gray-400">Management Portal</p>
            </div>
                        {/* ADD NOTIFICATION BELL HERE */}
            {adminUserId && (
              <NotificationBell 
                recipientType="admin" 
                recipientId={adminUserId} 
              />
            )}
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map(item => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive(item.path)
                      ? 'bg-brand-gold text-brand-black font-medium'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;