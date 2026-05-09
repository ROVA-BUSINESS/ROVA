import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { supabase, Account } from '../lib/supabase';
import { useAppTheme } from '../context/ThemeContext';
import { font, spacing, radius, shadow } from '../lib/theme';
import { MonoConnectWidget } from '../components/MonoConnect';

export default function SettingsScreen() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useAppTheme();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile Form State
  const [form, setForm] = useState({
    full_name: '',
    business_name: '',
    phone: '',
    currency: 'NGN',
    staff_visibility_limit: '500000',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        business_name: profile.business_name || '',
        phone: profile.phone || '',
        currency: profile.currency || 'NGN',
        staff_visibility_limit: String(profile.staff_visibility_limit || '500000'),
      });
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user]);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user!.id).order('created_at');
    setAccounts(data || []);
    setLoadingAccounts(false);
  };

  const handleProfileSave = async () => {
    setSaving(true);
    const { error } = await updateProfile({
      full_name: form.full_name,
      business_name: form.business_name,
      phone: form.phone,
      currency: form.currency,
      staff_visibility_limit: Number(form.staff_visibility_limit) || 500000,
    } as any);
    setSaving(false);
    
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Profile updated successfully!');
    }
  };

  const deleteAccount = (id: string) => {
    Alert.alert('Delete Account', 'Delete this account? This will not delete associated transactions.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('accounts').delete().eq('id', id);
        setAccounts(prev => prev.filter(a => a.id !== id));
      }}
    ]);
  };

  const toggleAccountActive = async (account: Account) => {
    await supabase.from('accounts').update({ is_active: !account.is_active }).eq('id', account.id);
    setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, is_active: !a.is_active } : a));
  };

  // Reusable Component for iOS-style Setting Rows
  const SettingRow = ({ icon, iconBg, title, subtitle, value, rightComponent, onPress, isLast = false, isDestructive = false }: any) => (
    <TouchableOpacity 
      style={[styles.row, { backgroundColor: colors.bgCard }, !isLast && { borderBottomColor: colors.borderLight, borderBottomWidth: StyleSheet.hairlineWidth }]} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={colors.white} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: isDestructive ? colors.danger : colors.textPrimary }]}>{title}</Text>
        {subtitle && <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      <View style={styles.rowRight}>
        {value && <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>}
        {rightComponent}
        {onPress && !rightComponent && <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Settings</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* Profile Section */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PROFILE</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.inputRow}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Full Name</Text>
              <TextInput style={[styles.input, { color: colors.textSecondary }]} value={form.full_name} onChangeText={t => setForm({...form, full_name: t})} placeholder="John Doe" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Business</Text>
              <TextInput style={[styles.input, { color: colors.textSecondary }]} value={form.business_name} onChangeText={t => setForm({...form, business_name: t})} placeholder="Acme Ltd" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Phone</Text>
              <TextInput style={[styles.input, { color: colors.textSecondary }]} value={form.phone} onChangeText={t => setForm({...form, phone: t})} placeholder="+234..." keyboardType="phone-pad" placeholderTextColor={colors.textMuted} />
            </View>
            
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleProfileSave} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
            </TouchableOpacity>
          </View>

          {/* Preferences Section */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, padding: 0 }]}>
            <SettingRow 
              icon="color-palette" 
              iconBg={colors.info} 
              title="Dark Mode" 
              rightComponent={
                <Switch 
                  value={isDark} 
                  onValueChange={toggleTheme} 
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#f4f3f4')}
                />
              }
            />
            <SettingRow 
              icon="cash" 
              iconBg={colors.success} 
              title="Currency" 
              value={form.currency}
              isLast 
            />
          </View>

          {/* Connected Accounts Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 0 }]}>FINANCIAL ACCOUNTS</Text>
            <MonoConnectWidget onSuccess={loadAccounts} />
          </View>
          
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
            {loadingAccounts ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : accounts.length === 0 ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <Ionicons name="card-outline" size={40} color={colors.textMuted} style={{ marginBottom: 10 }} />
                <Text style={{ color: colors.textSecondary, fontSize: font.sm }}>No accounts connected yet</Text>
              </View>
            ) : (
              accounts.map((acc, index) => (
                <SettingRow 
                  key={acc.id}
                  icon="card" 
                  iconBg={acc.color || colors.primaryDark} 
                  title={acc.name} 
                  subtitle={`${acc.type} • ₦${Number(acc.balance).toLocaleString()}`}
                  rightComponent={
                    <View style={styles.accActions}>
                      <TouchableOpacity onPress={() => toggleAccountActive(acc)}>
                        <Ionicons name={acc.is_active ? "checkmark-circle" : "pause-circle"} size={22} color={acc.is_active ? colors.success : colors.warning} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteAccount(acc.id)} style={{ marginLeft: 16 }}>
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  }
                  isLast={index === accounts.length - 1}
                />
              ))
            )}
          </View>

          {/* Security Section */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SECURITY</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, padding: 0 }]}>
            <SettingRow 
              icon="mail" 
              iconBg={colors.textMuted} 
              title="Email Address" 
              value={user?.email} 
            />
            <SettingRow 
              icon="key" 
              iconBg={colors.warning} 
              title="Change Password" 
              onPress={() => {}} 
            />
            <SettingRow 
              icon="trash" 
              iconBg={colors.danger} 
              title="Delete Account" 
              isDestructive
              onPress={() => {}} 
              isLast
            />
          </View>

          {/* Logout */}
          <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={signOut}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  pageTitle: {
    fontSize: 32, // Large iOS style header
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: font.xs,
    fontWeight: '600',
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
    marginLeft: spacing.lg,
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  card: {
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 50,
  },
  inputLabel: {
    width: 100,
    fontSize: font.md,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    fontSize: font.md,
    height: '100%',
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
    marginLeft: spacing.md,
  },
  saveBtn: {
    margin: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: font.md,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  rowIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: font.md,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: font.xs,
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: font.md,
    marginRight: 6,
  },
  accActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.xl,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: font.md,
    fontWeight: '600',
    marginLeft: 8,
  },
});
