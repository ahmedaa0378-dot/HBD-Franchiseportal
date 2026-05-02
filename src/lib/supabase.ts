import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// DIAGNOSTIC: trace every signOut caller so we can find the auto-bounce loop.
// Remove this block once the bug is fixed.
const _originalSignOut = supabase.auth.signOut.bind(supabase.auth);
(supabase.auth as any).signOut = async (...args: any[]) => {
  console.log('[SIGNOUT CALLED]', new Error().stack);
  return (_originalSignOut as any)(...args);
};

// DIAGNOSTIC: same for signInWithPassword — to confirm whether the second
// SIGNED_IN is from code calling signIn again, or from session resurrection.
const _originalSignIn = supabase.auth.signInWithPassword.bind(supabase.auth);
(supabase.auth as any).signInWithPassword = async (...args: any[]) => {
  console.log('[SIGNIN CALLED]', new Error().stack);
  return (_originalSignIn as any)(...args);
};
