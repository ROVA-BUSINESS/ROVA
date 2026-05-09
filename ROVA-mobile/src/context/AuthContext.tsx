import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile, TeamMember } from '../lib/supabase';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  staffData: TeamMember | null;
  isAdmin: boolean;
  isStaff: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
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
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user?.email) loadProfile(session.user.id, session.user.email);
        else setLoading(false);
      })
      .catch((err) => {
        console.error("Auth init error:", err);
        setLoading(false);
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

    setProfile(profileRes.data as Profile);
    setStaffData(staffRes.data as TeamMember);
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

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        mode: 'business',
      });
    }
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setStaffData(null);
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (!error) setProfile(prev => prev ? { ...prev, ...updates } : prev);
    return { error };
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, staffData, isAdmin, isStaff, loading, signIn, signUp, signOut, updateProfile, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
