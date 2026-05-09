import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qlwqktnziuqeosbnhnls.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsd3FrdG56aXVxZW9zYm5obmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMjY3NDksImV4cCI6MjA5MjcwMjc0OX0.gLG469T4onUm4sTvXdDlz_gy1eOhJ2AMWcwOD23yqjA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Shared Types (mirrors web app) ──────────────────────────────────────────

export type Profile = {
  id: string;
  full_name: string;
  business_name: string;
  mode: 'personal' | 'business';
  currency: string;
  phone: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: 'bank' | 'wallet' | 'cash' | 'investment' | 'credit';
  institution: string;
  balance: number;
  currency: string;
  color: string;
  is_active: boolean;
  source?: 'mono' | 'sms' | 'manual';
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  notes: string;
  date: string;
  reference: string;
  source?: 'mono' | 'sms' | 'manual';
  raw_sms?: string;
  ai_category: string;
  ai_confidence: number;
  is_verified: boolean;
  is_recurring: boolean;
  tags: string[];
  created_at: string;
  account?: Account;
};

export type SmsRule = {
  id: string;
  institution: string;
  sender_pattern: string;
  amount_regex: string;
  type_regex: string;
  balance_regex: string;
  narration_regex: string;
  is_active: boolean;
};
