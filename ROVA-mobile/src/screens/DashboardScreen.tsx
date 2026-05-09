import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';

import { useAuth } from '../context/AuthContext';
import { supabase, Transaction, Account } from '../lib/supabase';
import { useAppTheme } from '../context/ThemeContext';
import { font, spacing, radius, shadow } from '../lib/theme';

const screenWidth = Dimensions.get('window').width;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#9333ea', '#a855f7', '#c084fc', '#7e22ce', '#6b21a8'];

export default function DashboardScreen() {
  const { profile, user, isStaff, staffData } = useAuth();
  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation<any>();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [arBalance, setArBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // For staff, we query data belonging to the owner
  const targetUserId = isStaff ? staffData?.owner_id : user?.id;

  useFocusEffect(
    useCallback(() => {
      if (targetUserId) {
        loadData();
      } else {
        setLoading(false);
      }
    }, [targetUserId])
  );

  const loadData = async () => {
    if (!targetUserId) return;
    setLoading(true);

    try {
      let txQuery = supabase
        .from('transactions')
        .select('*, category:categories(*), account:accounts(*)')
        .eq('user_id', targetUserId)
        .order('date', { ascending: false })
        .limit(50);
        
      let invQuery = supabase
        .from('invoices')
        .select('total, amount_paid')
        .eq('user_id', targetUserId)
        .in('status', ['sent', 'overdue']);

      if (isStaff) {
        const limit = profile?.staff_visibility_limit || 500000;
        txQuery = txQuery.lt('amount', limit);
        invQuery = invQuery.lt('total', limit);
      }

      const [txRes, accRes, invRes] = await Promise.all([
        txQuery,
        supabase.from('accounts').select('*').eq('user_id', targetUserId).eq('is_active', true),
        invQuery
      ]);

      setTransactions((txRes.data as Transaction[]) || []);
      setAccounts(accRes.data || []);
      
      const arTotal = (invRes.data || []).reduce((s, inv) => s + (inv.total - (inv.amount_paid || 0)), 0);
      setArBalance(arTotal);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Derived Metrics
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0) + arBalance;
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const netFlow = income - expenses;

  // Chart Data Calculations
  const currentMonthIndex = new Date().getMonth();
  const pastMonths = MONTHS.slice(Math.max(0, currentMonthIndex - 5), currentMonthIndex + 1);
  
  const chartLabels = pastMonths.length > 0 ? pastMonths : ['N/A'];
  const chartIncomeData = pastMonths.map((month, i) => {
    const monthTx = transactions.filter(t => new Date(t.date).getMonth() === MONTHS.indexOf(month));
    return monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  });
  const chartExpenseData = pastMonths.map((month, i) => {
    const monthTx = transactions.filter(t => new Date(t.date).getMonth() === MONTHS.indexOf(month));
    return monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  });

  // Safe chart datasets to prevent render crash if all 0
  const safeIncomeData = chartIncomeData.some(v => v > 0) ? chartIncomeData : [0,0,0,0,0,1];
  const safeExpenseData = chartExpenseData.some(v => v > 0) ? chartExpenseData : [0,0,0,0,0,1];

  // Pie Chart Calculation
  const categoryMap = new Map<string, number>();
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const cat = (t.category as any)?.name || 'Other';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(t.amount));
  });
  
  const pieData = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value], index) => ({
      name,
      value,
      color: PIE_COLORS[index % PIE_COLORS.length],
      legendFontColor: colors.textSecondary,
      legendFontSize: 11
    }));

  const recentTx = transactions.slice(0, 5);
  const displayName = profile?.full_name?.split(' ')[0] || profile?.business_name || 'there';

  const chartConfig = {
    backgroundGradientFrom: colors.bgCard,
    backgroundGradientTo: colors.bgCard,
    color: (opacity = 1) => `rgba(147, 51, 234, ${opacity})`,
    labelColor: (opacity = 1) => colors.textMuted,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
  };

  const MetricCard = ({ title, amount, icon, iconColor, iconBg, trend }: any) => (
    <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.metricIconRow}>
        <View style={[styles.metricIconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        {trend && (
          <Ionicons 
            name={trend === 'up' ? 'arrow-up-right' : 'arrow-down-right'} 
            size={14} 
            color={trend === 'up' ? colors.success : colors.danger} 
          />
        )}
      </View>
      <Text style={[styles.metricTitle, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[styles.metricValue, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
        ₦{amount.toLocaleString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Header Hero */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.textPrimary }]}>Good day, {displayName} 👋</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Here's your financial overview</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} size="large" />
        ) : (
          <>
            {/* Hero Net Worth Card */}
            <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
              <Text style={styles.heroLabel}>Total Net Worth</Text>
              <Text style={styles.heroAmount}>₦{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              <View style={styles.heroFooter}>
                <View style={styles.heroPill}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.white} />
                  <Text style={styles.heroPillText}>Synced</Text>
                </View>
              </View>
            </View>

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <MetricCard 
                title="Total Income" 
                amount={income} 
                icon="trending-up" 
                iconColor={colors.success} 
                iconBg={colors.successBg} 
                trend="up" 
              />
              <MetricCard 
                title="Total Expenses" 
                amount={expenses} 
                icon="trending-down" 
                iconColor={colors.danger} 
                iconBg={colors.dangerBg} 
                trend="down" 
              />
              <MetricCard 
                title="Net Cash Flow" 
                amount={Math.abs(netFlow)} 
                icon="cash" 
                iconColor={netFlow >= 0 ? colors.success : colors.danger} 
                iconBg={netFlow >= 0 ? colors.successBg : colors.dangerBg} 
                trend={netFlow >= 0 ? 'up' : 'down'} 
              />
              <MetricCard 
                title="A/R Balance" 
                amount={arBalance} 
                icon="document-text" 
                iconColor={colors.warning} 
                iconBg={colors.warningBg} 
              />
            </View>

            {/* Cash Flow Chart */}
            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Cash Flow Overview</Text>
              {transactions.length > 0 ? (
                <View style={{ alignItems: 'center', marginLeft: -20 }}>
                  <LineChart
                    data={{
                      labels: chartLabels,
                      datasets: [
                        { data: safeIncomeData, color: () => colors.success, strokeWidth: 2 },
                        { data: safeExpenseData, color: () => colors.primary, strokeWidth: 2 }
                      ],
                      legend: ["Income", "Expenses"]
                    }}
                    width={screenWidth - 40}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={{ marginVertical: 8, borderRadius: 16 }}
                    withDots={false}
                  />
                </View>
              ) : (
                <Text style={{ textAlign: 'center', color: colors.textMuted, paddingVertical: 30 }}>No data for chart</Text>
              )}
            </View>

            {/* Expense Breakdown Pie Chart */}
            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Expense Breakdown</Text>
              {pieData.length > 0 ? (
                <PieChart
                  data={pieData}
                  width={screenWidth - 60}
                  height={180}
                  chartConfig={chartConfig}
                  accessor={"value"}
                  backgroundColor={"transparent"}
                  paddingLeft={"0"}
                  center={[10, 0]}
                  absolute
                />
              ) : (
                <Text style={{ textAlign: 'center', color: colors.textMuted, paddingVertical: 30 }}>No expense data</Text>
              )}
            </View>

            {/* Recent Transactions */}
            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Recent Transactions</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                  <Text style={{ color: colors.primary, fontSize: font.sm, fontWeight: '600' }}>See all</Text>
                </TouchableOpacity>
              </View>
              
              {recentTx.length > 0 ? (
                recentTx.map(tx => {
                  const isIncome = tx.type === 'income';
                  return (
                    <View key={tx.id} style={[styles.txRow, { borderBottomColor: colors.borderLight }]}>
                      <View style={[styles.txIconBox, { backgroundColor: isIncome ? colors.successBg : colors.dangerBg }]}>
                        <Ionicons name={isIncome ? 'arrow-down' : 'arrow-up'} size={14} color={isIncome ? colors.success : colors.danger} />
                      </View>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={[styles.txName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {tx.description || (tx.category as any)?.name || 'Transaction'}
                        </Text>
                        <Text style={[styles.txDate, { color: colors.textMuted }]}>
                          {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                      <Text style={[styles.txAmount, { color: isIncome ? colors.success : colors.textPrimary }]}>
                        {isIncome ? '+' : '-'}₦{Number(tx.amount).toLocaleString()}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={{ textAlign: 'center', color: colors.textMuted, paddingVertical: 20 }}>No transactions yet</Text>
              )}
            </View>

          </>
        )}
      </ScrollView>
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
    paddingBottom: spacing.md,
  },
  greeting: {
    fontSize: font.xxl,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: font.md,
    marginTop: 2,
  },
  heroCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: font.sm,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  heroFooter: {
    flexDirection: 'row',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  heroPillText: {
    color: '#FFFFFF',
    fontSize: font.xs,
    marginLeft: 4,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  metricCard: {
    width: '48%',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    ...shadow.soft,
  },
  metricIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  metricIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: font.lg,
    fontWeight: 'bold',
  },
  sectionCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
    ...shadow.soft,
  },
  sectionTitle: {
    fontSize: font.md,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txName: {
    fontSize: font.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  txDate: {
    fontSize: font.xs,
  },
  txAmount: {
    fontSize: font.md,
    fontWeight: 'bold',
  },
});
