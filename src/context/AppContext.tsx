import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

// Types
interface Franchise {
  id: string;
  auth_user_id: string;
  franchise_name: string;
  owner_name: string;
  email: string;
  phone: string;
  site_location: string;
  full_address: string;
  city: string;
  state: string;
  pincode: string;
  omc_partner: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejection_reason?: string;
  created_at: string;
}

interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string;
  sku: string;
  price: number;
  unit: string;
  min_order_qty: number;
  image_url: string;
  stock_quantity: number;
  reorder_threshold: number;
  gst_rate: number;
  hsn_code: string;
  is_active: boolean;
  categories?: { name: string };
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface AppContextType {
  user: User | null;
  franchise: Franchise | null;
  isAdmin: boolean;
  adminChecked: boolean;
  cart: CartItem[];
  cartTotal: number;
  cartCount: number;
  loading: boolean;
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  signOut: () => Promise<void>;
  refreshFranchise: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  console.log('[AppContext] mounted — fix v2 with prevUserIdRef');

  const [user, setUser] = useState<User | null>(null);
  const [franchise, setFranchise] = useState<Franchise | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const initialSessionFetchedRef = useRef(false);
  // Tracks the previously-seen authenticated user id so onAuthStateChange
  // can distinguish a real user transition (sign-in / user switch) from
  // events that fire for the SAME user (TOKEN_REFRESHED, USER_UPDATED, or
  // signInWithPassword while a persisted session is already in localStorage).
  const prevUserIdRef = useRef<string | null>(null);

  // Auth subscription. The onAuthStateChange callback MUST stay synchronous —
  // Supabase v2 holds an internal lock while dispatching SIGNED_IN/SIGNED_OUT,
  // and any awaited supabase call inside (including .from() table queries,
  // which read the JWT via getSession()) deadlocks signInWithPassword forever.
  // We only update React state here; a separate effect on user.id does the fetching.
  useEffect(() => {
    let mounted = true;

    if (!initialSessionFetchedRef.current) {
      initialSessionFetchedRef.current = true;
      supabase.auth.getSession()
        .then(({ data: { session }, error }) => {
          if (!mounted) return;
          if (error) {
            console.error('getSession error:', error);
            setLoading(false);
            setAdminChecked(true);
            return;
          }
          if (session?.user) {
            console.log('[getSession] restored session for', session.user.id);
            setUser(session.user);
            // user-effect below picks this up and fetches franchise + admin
          } else {
            console.log('[getSession] no session');
            setLoading(false);
            setAdminChecked(true);
          }
        })
        .catch((err) => {
          if (!mounted) return;
          console.error('Auth initialization failed:', err);
          setLoading(false);
          setAdminChecked(true);
        });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      const prevUserId = prevUserIdRef.current;
      console.log('[AUTH EVENT]', _event, 'nextUserId:', nextUserId, 'prevUserId:', prevUserId, 'transition:', prevUserId !== nextUserId);

      setUser(nextUser);

      if (!nextUser) {
        // Sign-out: reset everything.
        prevUserIdRef.current = null;
        setFranchise(null);
        setIsAdmin(false);
        setAdminChecked(true);
        setLoading(false);
      } else if (prevUserId !== nextUserId) {
        // Real user transition (first sign-in or user switch). Mark the
        // post-login fetch as in-flight SYNCHRONOUSLY so AdminLoginPage /
        // LoginPage / ProtectedRoute don't read a stale (loading=false,
        // adminChecked=true) state in the gap before the [user?.id]
        // effect starts the fetch. Pure state updates — no Supabase
        // calls, no deadlock risk.
        prevUserIdRef.current = nextUserId;
        setLoading(true);
        setAdminChecked(false);
      }
      // else: SAME user (TOKEN_REFRESHED, USER_UPDATED, or signInWithPassword
      // while a session for this user is already in localStorage). The
      // [user?.id] effect won't refire, so flipping loading/adminChecked
      // here would strand the UI in a permanent loading state. Do nothing.
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch franchise + admin status whenever the signed-in user changes.
  // Runs OUTSIDE the auth lock, so awaiting supabase queries here is safe.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const authUserId = user.id;
    console.log('[user-effect] fired for', authUserId);

    setLoading(true);
    setAdminChecked(false);

    // Re-armed safety net: if any post-login fetch hangs, force loading off after 8s.
    // The original code only ran this on initial mount, so a hung post-login fetch
    // would leave loading=true forever.
    const safetyTimeout = setTimeout(() => {
      if (cancelled) return;
      console.warn('[AppContext] auth fetch safety timeout — releasing loading state');
      setLoading(false);
      setAdminChecked(true);
    }, 8000);

    const fetchFranchiseInline = async () => {
      try {
        const { data, error } = await supabase
          .from('franchises')
          .select('*')
          .eq('auth_user_id', authUserId)
          .maybeSingle();
        if (error) console.error('fetchFranchise error:', error);
        if (!cancelled) setFranchise(data ?? null);
      } catch (err) {
        console.error('fetchFranchise failed:', err);
        if (!cancelled) setFranchise(null);
      }
    };

    const checkAdminInline = async () => {
      try {
        const { data } = await supabase
          .from('admin_users')
          .select('id')
          .eq('auth_user_id', authUserId)
          .maybeSingle();
        if (!cancelled) setIsAdmin(!!data);
      } catch (err) {
        console.error('checkAdmin error:', err);
        if (!cancelled) setIsAdmin(false);
      }
    };

    Promise.all([fetchFranchiseInline(), checkAdminInline()])
      .finally(() => {
        clearTimeout(safetyTimeout);
        if (cancelled) return;
        console.log('[user-effect] fetch complete — franchise + admin checks done');
        setLoading(false);
        setAdminChecked(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimeout);
    };
  }, [user?.id]);

  const refreshFranchise = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('franchises')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (error) console.error('refreshFranchise error:', error);
      setFranchise(data ?? null);
    } catch (err) {
      console.error('refreshFranchise failed:', err);
    }
  };

  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const signOut = async () => {
    await supabase.auth.signOut();
    prevUserIdRef.current = null;
    setUser(null);
    setFranchise(null);
    setCart([]);
    setIsAdmin(false);
    setAdminChecked(true);
  };

  return (
    <AppContext.Provider value={{
      user,
      franchise,
      isAdmin,
      adminChecked,
      cart,
      cartTotal,
      cartCount,
      loading,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      signOut,
      refreshFranchise
    }}>
      {children}
    </AppContext.Provider>
  );
};
