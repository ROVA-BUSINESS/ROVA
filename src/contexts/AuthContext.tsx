import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type User, type Session } from '@supabase/supabase-js';
import { supabase, type Profile, type TeamMember } from '../lib/supabase';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  staffData: TeamMember | null;
  isAdmin: boolean;
  isStaff: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [staffData, setStaffData] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = !!user && !staffData;
  const isStaff = !!staffData;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.email) loadProfile(session.user.id, session.user.email);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        (async () => {
          await loadProfile(session.user.id, session.user.email!);
        })();
      } else {
        setProfile(null);
        setStaffData(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string, email: string) {
    const [profileRes, staffRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('team_members').select('*').eq('invite_email', email).maybeSingle()
    ]);

    if (staffRes.data && !staffRes.data.member_id) {
      await supabase.from('team_members').update({ member_id: userId }).eq('id', staffRes.data.id);
      staffRes.data.member_id = userId;
    }

    setProfile(profileRes.data);
    setStaffData(staffRes.data);
    setLoading(false);
  }

  async function refreshAuth() {
    if (user?.email) {
      await loadProfile(user.id, user.email);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`,
      },
    });
    return { error };
  }

  async function signUp(email: string, password: string, fullName: string, phone?: string) {
    const cleanEmail = email.trim().toLowerCase();

    // Check if email has been onboarded by an Admin as staff
    const { data: existingStaff } = await supabase
      .from('team_members')
      .select('id, owner_id')
      .ilike('invite_email', cleanEmail)
      .maybeSingle();

    if (existingStaff) {
      return {
        error: new Error('This email address has been onboarded as a Staff member by an Administrator. Staff members cannot create standalone accounts. Please check your email for the invitation link sent by your Admin, or sign in at the Login page.'),
        needsEmailConfirmation: false,
      };
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        phone: phone || '',
        mode: 'business',
        business_profile_completed: false,
        onboarding_step: 1,
      });
    }
    return { error, needsEmailConfirmation: !data.session };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return { error: new Error('Not authenticated') };
    // Filter out staff_visibility_limit since it's not a database column in the profiles table
    const { staff_visibility_limit, ...dbUpdates } = updates as any;

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...dbUpdates,
        updated_at: new Date().toISOString()
      });
    if (!error) setProfile(prev => prev ? { ...prev, ...updates } : { id: user.id, ...updates } as any);
    return { error };
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, staffData, isAdmin, isStaff, loading, signIn, signInWithGoogle, signUp, signOut, updateProfile, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
