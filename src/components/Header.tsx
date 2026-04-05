import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Logo from './Logo';
import NotificationBell from './NotificationBell';

const Header = () => {
  const { franchise, cartCount, signOut } = useApp();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-brand-black text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <div>
              <h1 className="font-display text-xl font-semibold text-brand-gold">Half Billion Dollar</h1>
              <p className="text-xs text-gray-400">Franchise Portal</p>
            </div>
          </div>

          {franchise && franchise.status === 'approved' && (
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                to="/catalog"
                className={`text-sm hover:text-brand-gold transition ${isActive('/catalog') ? 'text-brand-gold' : ''}`}
              >
                Products
              </Link>
              <Link 
                to="/orders"
                className={`text-sm hover:text-brand-gold transition ${isActive('/orders') ? 'text-brand-gold' : ''}`}
              >
                My Orders
              </Link>
              {/* Notification Bell - ADD THIS */}
              <NotificationBell 
                recipientType="franchise" 
                recipientId={franchise.id} 
              />
              <Link 
                to="/cart"
                className={`relative text-sm hover:text-brand-gold transition flex items-center gap-2 ${isActive('/cart') ? 'text-brand-gold' : ''}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Cart
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-brand-gold text-brand-black text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </Link>
            </nav>
          )}

          <div className="flex items-center gap-4">
            {franchise && (
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{franchise.franchise_name}</p>
                <p className="text-xs text-gray-400">{franchise.city}</p>
              </div>
            )}
            {franchise && (
              <button 
                onClick={signOut}
                className="text-sm text-gray-400 hover:text-white transition"
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav */}
        {franchise && franchise.status === 'approved' && (
          <nav className="md:hidden flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-800">
            <Link 
              to="/catalog"
              className={`text-sm ${isActive('/catalog') ? 'text-brand-gold' : 'text-gray-400'}`}
            >
              Products
            </Link>
            <Link 
              to="/orders"
              className={`text-sm ${isActive('/orders') ? 'text-brand-gold' : 'text-gray-400'}`}
            >
              Orders
            </Link>
            <Link 
              to="/cart"
              className={`text-sm ${isActive('/cart') ? 'text-brand-gold' : 'text-gray-400'} flex items-center gap-1`}
            >
              Cart {cartCount > 0 && `(${cartCount})`}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;