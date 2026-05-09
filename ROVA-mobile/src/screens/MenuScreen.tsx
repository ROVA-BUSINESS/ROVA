import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, font, radius, shadow } from '../lib/theme';
import { useAuth } from '../context/AuthContext';

type MenuItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
  isLast?: boolean;
};

const MenuItem = ({ icon, title, onPress, isLast }: MenuItemProps) => (
  <TouchableOpacity 
    style={[styles.menuItem, !isLast && styles.menuItemBorder]} 
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.menuItemLeft}>
      <Ionicons name={icon} size={22} color={colors.textSecondary} style={styles.menuIcon} />
      <Text style={styles.menuItemText}>{title}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
  </TouchableOpacity>
);

export default function MenuScreen() {
  const navigation = useNavigation<any>();
  const { profile } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Profile Card Summary */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.full_name?.charAt(0) || 'U'}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{profile?.full_name}</Text>
            <Text style={styles.profileBusiness}>{profile?.business_name}</Text>
          </View>
        </View>

        {/* FINANCIAL RECORDS */}
        <Text style={styles.sectionTitle}>FINANCIAL RECORDS</Text>
        <View style={styles.sectionContainer}>
          <MenuItem 
            icon="book-outline" 
            title="General Ledger" 
            onPress={() => navigation.navigate('GeneralLedger')} 
          />
          <MenuItem 
            icon="layers-outline" 
            title="Chart of Accounts" 
            onPress={() => navigation.navigate('ChartOfAccounts')} 
          />
          <MenuItem 
            icon="journal-outline" 
            title="Journal Entries" 
            onPress={() => navigation.navigate('JournalEntries')} 
          />
          <MenuItem 
            icon="scale-outline" 
            title="Trial Balance" 
            onPress={() => navigation.navigate('TrialBalance')} 
            isLast 
          />
        </View>

        {/* FINANCIAL STATEMENTS */}
        <Text style={styles.sectionTitle}>FINANCIAL STATEMENTS</Text>
        <View style={styles.sectionContainer}>
          <MenuItem 
            icon="trending-up-outline" 
            title="Profit & Loss" 
            onPress={() => navigation.navigate('ProfitAndLoss')} 
          />
          <MenuItem 
            icon="list-outline" 
            title="Balance Sheet" 
            onPress={() => navigation.navigate('BalanceSheet')} 
          />
          <MenuItem 
            icon="cash-outline" 
            title="Cash Flow" 
            onPress={() => navigation.navigate('CashFlow')} 
            isLast 
          />
        </View>

        {/* PEOPLE & OPERATIONS */}
        <Text style={styles.sectionTitle}>PEOPLE & OPERATIONS</Text>
        <View style={styles.sectionContainer}>
          <MenuItem 
            icon="people-outline" 
            title="Team Members" 
            onPress={() => navigation.navigate('Team')} 
          />
          <MenuItem 
            icon="wallet-outline" 
            title="Payroll" 
            onPress={() => navigation.navigate('Payroll')} 
            isLast 
          />
        </View>

        {/* MORE */}
        <Text style={styles.sectionTitle}>MORE</Text>
        <View style={styles.sectionContainer}>
          <MenuItem 
            icon="bar-chart-outline" 
            title="Reports" 
            onPress={() => navigation.navigate('Reports')} 
          />
          <MenuItem 
            icon="document-text-outline" 
            title="Invoices" 
            onPress={() => navigation.navigate('InvoicesTab')} 
          />
          <MenuItem 
            icon="document-outline" 
            title="Tax & Compliance" 
            onPress={() => navigation.navigate('Tax')} 
          />
          <MenuItem 
            icon="settings-outline" 
            title="Settings" 
            onPress={() => navigation.navigate('SettingsStack')} 
            isLast 
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: font.xxxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.primaryDark,
    fontSize: font.xl,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: font.lg,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  profileBusiness: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: font.xs,
    fontWeight: 'bold',
    color: colors.textMuted,
    marginLeft: spacing.sm,
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  sectionContainer: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 28,
  },
  menuItemText: {
    fontSize: font.md,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
