import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { ChevronDown, ChevronRight, LogOut, Menu, X } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [adminUserId, setAdminUserId] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setAdminUserId(user.id);
    };
    getUser();
  }, []);

  // Auto-expand settings if current page is a settings sub-item
  useEffect(() => {
    const settingsPaths = settingsGroup.items.map(i => i.path);
    if (settingsPaths.some(p => location.pathname === p)) {
      setSettingsOpen(true);
    }
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  // ─── Main Nav Items ────────────────────────────────────────
  const mainNavItems: NavItem[] = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/admin/franchises', label: 'Franchises', icon: '🏪' },
    { path: '/admin/orders', label: 'Orders', icon: '🛒' },
    { path: '/admin/products', label: 'Products', icon: '📦' },
    { path: '/admin/performance', label: 'Performance', icon: '📈' },
    { path: '/admin/reports', label: 'Reports', icon: '📋' },
    { path: '/admin/resources', label: 'Resources', icon: '📚' },
  ];

  // ─── Settings Group ────────────────────────────────────────
  const settingsGroup: NavGroup = {
    label: 'Settings',
    icon: '⚙️',
    items: [
      { path: '/admin/bundles', label: 'Bundles', icon: '🎁' },
      { path: '/admin/inventory', label: 'Inventory', icon: '📋' },
      { path: '/admin/delivery-settings', label: 'Delivery', icon: '🚚' },
      { path: '/admin/payment-settings', label: 'Payment', icon: '💳' },
      { path: '/admin/abandoned-carts', label: 'Abandoned Carts', icon: '⚠️' },
    ],
  };

  const isSettingsActive = settingsGroup.items.some(i => isActive(i.path));

  // ─── Nav Link Component ────────────────────────────────────
  const NavLink = ({ item, compact = false }: { item: NavItem; compact?: boolean }) => (
    <Link
      to={item.path}
      onClick={() => setMobileMenuOpen(false)}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-sm ${
        isActive(item.path)
          ? 'bg-brand-gold text-brand-black font-medium'
          : 'text-gray-300 hover:bg-gray-800'
      } ${compact ? 'pl-10' : ''}`}
    >
      <span className="text-base">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );

  // ─── Sidebar Content (shared between desktop & mobile) ─────
  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <div>
            <h1 className="font-display text-lg font-semibold text-brand-gold">½B Admin</h1>
            <p className="text-xs text-gray-400">Management Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {adminUserId && (
            <NotificationBell recipientType="admin" recipientId={adminUserId} align="left" />
          )}
          {/* Mobile close button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Main Items */}
        {mainNavItems.map(item => (
          <NavLink key={item.path} item={item} />
        ))}

        {/* Settings Group */}
        <div className="mt-3 pt-3 border-t border-gray-800">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition text-sm ${
              isSettingsActive
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-base">{settingsGroup.icon}</span>
              <span>{settingsGroup.label}</span>
            </div>
            {settingsOpen
              ? <ChevronDown size={16} className="text-gray-500" />
              : <ChevronRight size={16} className="text-gray-500" />
            }
          </button>

          {settingsOpen && (
            <div className="mt-1 space-y-0.5">
              {settingsGroup.items.map(item => (
                <NavLink key={item.path} item={item} compact />
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Sign Out - always pinned at bottom */}
      <div className="p-3 border-t border-gray-800 shrink-0">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition text-sm"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-brand-black text-white flex-col fixed h-full z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-brand-black z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <h1 className="font-display text-lg font-semibold text-brand-gold">½B Admin</h1>
        </div>
        <div className="flex items-center gap-2">
          {adminUserId && (
            <NotificationBell recipientType="admin" recipientId={adminUserId} />
          )}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-gray-400 hover:text-white"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-brand-black text-white flex flex-col z-50">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-60 p-6 pt-20 lg:pt-6">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
