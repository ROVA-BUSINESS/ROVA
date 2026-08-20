import { type Transaction, type Account } from './supabase';
import { supabase } from './supabase';
import { formatCurrency } from './format';

export type Insight = {
  id: string;
  type: 'overspend' | 'drop' | 'opportunity' | 'summary' | 'warning' | 'positive';
  severity: 'info' | 'warning' | 'critical' | 'positive';
  title: string;
  body: string;
  icon: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};



export function generateInsights(transactions: Transaction[], accounts: Account[]): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const thisMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const lastMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
  });

  const thisIncome = thisMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const thisExpense = thisMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const lastIncome = lastMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const lastExpense = lastMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  if (thisIncome === 0 && thisExpense === 0) {
    insights.push({
      id: 'no-data',
      type: 'summary', severity: 'info',
      title: 'Add your first transaction',
      body: 'Start adding income and expense transactions to unlock AI-powered insights about your finances.',
      icon: '💡',
    });
    return insights;
  }

  if (lastIncome > 0 && thisIncome < lastIncome) {
    const drop = ((lastIncome - thisIncome) / lastIncome) * 100;
    insights.push({
      id: 'income-drop',
      type: 'drop', severity: drop > 30 ? 'critical' : 'warning',
      title: `Revenue dropped ${drop.toFixed(0)}% this month`,
      body: `Your income this month is ${formatCurrency(thisIncome)} vs ${formatCurrency(lastIncome)} last month. That's a drop of ${formatCurrency(lastIncome - thisIncome)}. Review your income sources.`,
      icon: '📉',
    });
  } else if (lastIncome > 0 && thisIncome > lastIncome) {
    const growth = ((thisIncome - lastIncome) / lastIncome) * 100;
    insights.push({
      id: 'income-growth',
      type: 'positive', severity: 'positive',
      title: `Revenue up ${growth.toFixed(0)}% this month`,
      body: `Great progress! You've earned ${formatCurrency(thisIncome)} this month, ${formatCurrency(thisIncome - lastIncome)} more than last month.`,
      icon: '📈',
    });
  }

  const catExpenses = new Map<string, { thisMonth: number; lastMonth: number }>();
  thisMonthTx.filter(t => t.type === 'expense').forEach(t => {
    const cat = (t.category as any)?.name || 'Uncategorized';
    const cur = catExpenses.get(cat) || { thisMonth: 0, lastMonth: 0 };
    cur.thisMonth += t.amount;
    catExpenses.set(cat, cur);
  });
  lastMonthTx.filter(t => t.type === 'expense').forEach(t => {
    const cat = (t.category as any)?.name || 'Uncategorized';
    const cur = catExpenses.get(cat) || { thisMonth: 0, lastMonth: 0 };
    cur.lastMonth += t.amount;
    catExpenses.set(cat, cur);
  });

  let biggestOverspend: { cat: string; pct: number; amount: number } | null = null;
  catExpenses.forEach(({ thisMonth: tm, lastMonth: lm }, cat) => {
    if (lm > 0 && tm > lm * 1.25) {
      const pct = ((tm - lm) / lm) * 100;
      if (!biggestOverspend || pct > biggestOverspend.pct) {
        biggestOverspend = { cat, pct, amount: tm };
      }
    }
  });

  if (biggestOverspend) {
    insights.push({
      id: 'overspend',
      type: 'overspend', severity: 'warning',
      title: `You're overspending on ${(biggestOverspend as any).cat}`,
      body: `Your ${(biggestOverspend as any).cat} spend is up ${(biggestOverspend as any).pct.toFixed(0)}% compared to last month, totalling ${formatCurrency((biggestOverspend as any).amount)}. Consider reviewing this category.`,
      icon: '⚠️',
    });
  }

  if (thisExpense > thisIncome && thisIncome > 0) {
    insights.push({
      id: 'negative-flow',
      type: 'warning', severity: 'critical',
      title: 'Spending exceeds income this month',
      body: `You're spending ${formatCurrency(thisExpense)} against ${formatCurrency(thisIncome)} in income. Your net is ${formatCurrency(thisIncome - thisExpense)}. Review non-essential expenses.`,
      icon: '🔴',
    });
  } else if (thisIncome > 0) {
    const net = thisIncome - thisExpense;
    const margin = (net / thisIncome) * 100;
    insights.push({
      id: 'net-flow',
      type: margin > 30 ? 'positive' : 'summary',
      severity: margin > 30 ? 'positive' : 'info',
      title: `Net profit margin: ${margin.toFixed(1)}%`,
      body: `This month you've kept ${formatCurrency(net)} after expenses — a ${margin.toFixed(1)}% profit margin. ${margin > 30 ? 'Excellent work!' : 'Aim for 30%+ for a healthy business.'}`,
      icon: margin > 30 ? '✅' : '📊',
    });
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const avgMonthlyExpense = lastExpense > 0 ? (thisExpense + lastExpense) / 2 : thisExpense;
  if (avgMonthlyExpense > 0 && totalBalance < avgMonthlyExpense * 2) {
    insights.push({
      id: 'low-runway',
      type: 'warning', severity: 'warning',
      title: 'Low cash runway — under 2 months',
      body: `Your current balance of ${formatCurrency(totalBalance)} covers less than 2 months of expenses at your current burn rate of ${formatCurrency(avgMonthlyExpense)}/month.`,
      icon: '🔋',
    });
  }

  const allExpenses = transactions.filter(t => t.type === 'expense');
  const totalCatMap = new Map<string, number>();
  allExpenses.forEach(t => {
    const cat = (t.category as any)?.name || 'Uncategorized';
    totalCatMap.set(cat, (totalCatMap.get(cat) || 0) + t.amount);
  });
  const sortedCats = Array.from(totalCatMap.entries()).sort((a, b) => b[1] - a[1]);
  if (sortedCats.length > 0) {
    const [topCat, topAmount] = sortedCats[0];
    const total = allExpenses.reduce((s, t) => s + t.amount, 0);
    const pct = total > 0 ? (topAmount / total) * 100 : 0;
    if (pct > 40) {
      insights.push({
        id: 'top-category',
        type: 'opportunity', severity: 'info',
        title: `${topCat} is your biggest cost`,
        body: `${topCat} accounts for ${pct.toFixed(0)}% of all your expenses (${formatCurrency(topAmount)}). Explore ways to optimise this category.`,
        icon: '🔍',
      });
    }
  }

  return insights;
}

/**
 * Delegates query handling to the unified central ROVA AI Agent Core.
 */
export async function askROVAAgent(
  question: string,
  userId: string,
  history: any[] = []
): Promise<{ reply: string; actions?: any[] }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        messages: [...history, { role: 'user', content: question }],
        context: { userId },
      },
    });

    if (error) throw new Error(error.message);
    return {
      reply: data.reply || 'ROVA AI Agent responded successfully.',
      actions: data.actions || [],
    };
  } catch (err: any) {
    console.warn('Central Edge Function call failed. Fallback to direct shared functions.', err);
    return { reply: answerQuestion(question, [], []) };
  }
}

/**
 * Standard rule-based answer fallback using direct financial queries
 */
export function answerQuestion(
  question: string,
  transactions: Transaction[],
  accounts: Account[],
  isStaff: boolean = false
): string {
  const q = question.toLowerCase();
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const thisMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const thisIncome = thisMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const thisExpense = thisMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  if ((q.includes('make') || q.includes('earn') || q.includes('income') || q.includes('revenue')) && q.includes('this month')) {
    return `This month you've earned ${formatCurrency(thisIncome)} in income. Your expenses are ${formatCurrency(thisExpense)}, giving you a net of ${formatCurrency(thisIncome - thisExpense)}.`;
  }

  if (q.includes('owe') || q.includes('who owes') || q.includes('receivable')) {
    return `To check outstanding payments owed to you, ask "How much do customers owe me?" or check your Invoices page.`;
  }

  if (q.includes('balance') || (q.includes('how much') && q.includes('account'))) {
    if (accounts.length === 0) return `No accounts found. Add your bank and wallet accounts in Settings.`;
    const lines = accounts.map(a => `• ${a.name}: ${formatCurrency(a.balance)}`).join('\n');
    return `Your total balance is ${formatCurrency(totalBalance)}.\n\n${lines}`;
  }

  if (q.includes('summary') || q.includes('overview')) {
    if (isStaff) return "I cannot provide overall financial summaries to staff members.";
    return `Here's your financial summary:\n\n• This month income: ${formatCurrency(thisIncome)}\n• This month expenses: ${formatCurrency(thisExpense)}\n• Net this month: ${formatCurrency(thisIncome - thisExpense)}\n• Total balance (all accounts): ${formatCurrency(totalBalance)}`;
  }

  return `Hello! I'm your unified ROVA AI Assistant. Ask me things like:\n• "I sold ₦50,000 today."\n• "Create an invoice for John for ₦200,000."\n• "I spent ₦25,000 on fuel."\n• "How much did I sell this month?"\n• "How much do customers owe me?"\n• "How much tax do I currently owe?"`;
}
