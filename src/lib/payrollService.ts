/**
 * ROVA Nigerian Payroll & Accounting Service
 * Implements full 5-stage payroll:
 * 1. Employee salary breakdown (Basic, Housing, Transport, Other)
 * 2. Gross pay calculation & variable earnings
 * 3. Nigerian deductions (PAYE, Pension 8%, NHF, Advances)
 * 4. Net salary computation
 * 5. Automated double-entry accounting records (Gross Expense, Statutory Liabilities, Bank Payout)
 */

import { formatCurrency } from './format';
import type { Employee, PayrollRun, Payslip } from './supabase';

export interface SalaryBreakdown {
  basic: number;
  housing: number;
  transport: number;
  other: number;
  gross: number;
}

export interface EmployeePayrollCalc {
  emp: Employee;
  breakdown: SalaryBreakdown;
  gross: number;
  paye: number;
  pension: number;
  nhf: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
}

export interface PayrollRunTotals {
  gross: number;
  basic: number;
  housing: number;
  transport: number;
  otherAllowances: number;
  paye: number;
  pension: number;
  nhf: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
  employeeCount: number;
}

export interface AccountingJournalEntry {
  accountCode: string;
  accountName: string;
  type: 'debit' | 'credit';
  amount: number;
  description: string;
}

/**
 * Parses salary components from notes string or applies Nigerian standard default split (60% Basic, 25% Housing, 15% Transport).
 */
export function parseSalaryBreakdown(notes: string | undefined | null, gross: number): SalaryBreakdown {
  if (notes && notes.includes('[SalaryBreakdown:')) {
    try {
      const match = notes.match(/\[SalaryBreakdown:([^\]]+)\]/);
      if (match && match[1]) {
        const parts = match[1].split(';').reduce((acc: any, curr: string) => {
          const [k, v] = curr.split('=');
          if (k && v) acc[k.trim()] = Number(v.trim());
          return acc;
        }, {});

        const basic = parts.basic ?? Math.round(gross * 0.6);
        const housing = parts.housing ?? Math.round(gross * 0.25);
        const transport = parts.transport ?? Math.round(gross * 0.15);
        const other = parts.other ?? Math.max(0, gross - (basic + housing + transport));
        return {
          basic,
          housing,
          transport,
          other,
          gross: basic + housing + transport + other,
        };
      }
    } catch {
      // fallback to standard split
    }
  }

  // Standard Nigerian SME statutory split: 60% Basic, 25% Housing, 15% Transport
  const basic = Math.round(gross * 0.6);
  const housing = Math.round(gross * 0.25);
  const transport = Math.round(gross * 0.15);
  const other = Math.max(0, gross - (basic + housing + transport));
  return { basic, housing, transport, other, gross };
}

/**
 * Encodes custom salary breakdown into notes string
 */
export function encodeSalaryBreakdown(breakdown: { basic: number; housing: number; transport: number; other?: number; nhf?: number }, existingNotes: string = ''): string {
  const cleanNotes = existingNotes.replace(/\[SalaryBreakdown:[^\]]+\]\s*/g, '').trim();
  const tag = `[SalaryBreakdown: basic=${breakdown.basic}; housing=${breakdown.housing}; transport=${breakdown.transport}; other=${breakdown.other || 0}; nhf=${breakdown.nhf || 0}]`;
  return cleanNotes ? `${tag} ${cleanNotes}` : tag;
}

/**
 * Calculates complete Nigerian payroll line for an employee
 */
export function calculateEmployeePayroll(emp: Employee): EmployeePayrollCalc {
  const breakdown = parseSalaryBreakdown(emp.notes, emp.gross_salary);
  const gross = emp.gross_salary || breakdown.gross;

  // PAYE Tax (Personal Income Tax)
  const payeRate = emp.paye_rate ?? 7.5;
  const paye = Math.round(gross * (payeRate / 100));

  // Employee Pension Contribution (8% of Basic + Housing + Transport per Pension Reform Act 2014)
  const pensionBase = breakdown.basic + breakdown.housing + breakdown.transport;
  const pensionRate = emp.pension_rate ?? 8.0;
  const pension = Math.round(pensionBase * (pensionRate / 100));

  // NHF (National Housing Fund 2.5% of basic salary, if applicable)
  let nhf = 0;
  if (emp.notes && emp.notes.includes('nhf=1')) {
    nhf = Math.round(breakdown.basic * 0.025);
  }

  const otherDeductions = 0;
  const totalDeductions = paye + pension + nhf + otherDeductions;
  const netPay = Math.max(0, gross - totalDeductions);

  return {
    emp,
    breakdown,
    gross,
    paye,
    pension,
    nhf,
    otherDeductions,
    totalDeductions,
    netPay,
  };
}

/**
 * Summarizes payroll totals for an entire payroll run
 */
export function calculatePayrollRunTotals(employees: Employee[]): PayrollRunTotals {
  const active = employees.filter(e => e.status === 'active');
  const calcs = active.map(calculateEmployeePayroll);

  return calcs.reduce((acc, c) => ({
    gross: acc.gross + c.gross,
    basic: acc.basic + c.breakdown.basic,
    housing: acc.housing + c.breakdown.housing,
    transport: acc.transport + c.breakdown.transport,
    otherAllowances: acc.otherAllowances + c.breakdown.other,
    paye: acc.paye + c.paye,
    pension: acc.pension + c.pension,
    nhf: acc.nhf + c.nhf,
    otherDeductions: acc.otherDeductions + c.otherDeductions,
    totalDeductions: acc.totalDeductions + c.totalDeductions,
    net: acc.net + c.netPay,
    employeeCount: acc.employeeCount + 1,
  }), {
    gross: 0,
    basic: 0,
    housing: 0,
    transport: 0,
    otherAllowances: 0,
    paye: 0,
    pension: 0,
    nhf: 0,
    otherDeductions: 0,
    totalDeductions: 0,
    net: 0,
    employeeCount: 0,
  });
}

/**
 * Generates Balanced Double-Entry Accounting Journal for Payroll Run (Section 5)
 */
export function generatePayrollJournalEntries(runTotals: PayrollRunTotals, periodLabel: string): AccountingJournalEntry[] {
  return [
    {
      accountCode: '5100',
      accountName: 'Salaries & Wages Expense',
      type: 'debit',
      amount: runTotals.gross,
      description: `Gross salary expense for ${periodLabel}`,
    },
    {
      accountCode: '2200',
      accountName: 'PAYE Tax Withholding Payable',
      type: 'credit',
      amount: runTotals.paye,
      description: `PAYE deducted awaiting remittance for ${periodLabel}`,
    },
    {
      accountCode: '2210',
      accountName: 'Pension Contributions Payable',
      type: 'credit',
      amount: runTotals.pension,
      description: `Employee pension 8% awaiting remittance for ${periodLabel}`,
    },
    ...(runTotals.nhf > 0 ? [{
      accountCode: '2220',
      accountName: 'National Housing Fund (NHF) Payable',
      type: 'credit' as const,
      amount: runTotals.nhf,
      description: `NHF contributions for ${periodLabel}`,
    }] : []),
    ...(runTotals.otherDeductions > 0 ? [{
      accountCode: '2230',
      accountName: 'Other Deductions Payable',
      type: 'credit' as const,
      amount: runTotals.otherDeductions,
      description: `Other deductions for ${periodLabel}`,
    }] : []),
    {
      accountCode: '2100',
      accountName: 'Salaries Payable (Net Salary)',
      type: 'credit',
      amount: runTotals.net,
      description: `Net salary liability owed to staff for ${periodLabel}`,
    },
  ];
}

/**
 * Generates payment settlement journal entries when salaries are disbursed
 */
export function generateSalaryPayoutEntries(netAmount: number, periodLabel: string, bankName: string = 'Business Bank Account'): AccountingJournalEntry[] {
  return [
    {
      accountCode: '2100',
      accountName: 'Salaries Payable',
      type: 'debit',
      amount: netAmount,
      description: `Clear net salary liability for ${periodLabel}`,
    },
    {
      accountCode: '1010',
      accountName: bankName,
      type: 'credit',
      amount: netAmount,
      description: `Bank transfer salary payout for ${periodLabel}`,
    },
  ];
}

/**
 * Formats WhatsApp text message for an employee payslip
 */
export function formatPayslipWhatsApp(run: PayrollRun, slip: Payslip, companyName: string): string {
  const emp = slip.employee;
  const empName = emp?.full_name || 'Employee';
  const role = emp?.role || 'Staff';
  const breakdown = parseSalaryBreakdown(emp?.notes, slip.gross_salary);

  return `*${companyName.toUpperCase()} — PAYSLIP*
📅 *Period:* ${run.period_label}
👤 *Employee:* ${empName} (${role})

*EARNINGS (GROSS)*
• Basic Salary: ${formatCurrency(breakdown.basic)}
• Housing Allowance: ${formatCurrency(breakdown.housing)}
• Transport Allowance: ${formatCurrency(breakdown.transport)}
${breakdown.other > 0 ? `• Other Allowances: ${formatCurrency(breakdown.other)}\n` : ''}*Total Gross:* ${formatCurrency(slip.gross_salary)}

*DEDUCTIONS*
• PAYE Income Tax: -${formatCurrency(slip.paye_deduction)}
• Pension Contribution (8%): -${formatCurrency(slip.pension_deduction)}
${slip.other_deductions > 0 ? `• Other Deductions: -${formatCurrency(slip.other_deductions)}\n` : ''}*Total Deductions:* -${formatCurrency(slip.paye_deduction + slip.pension_deduction + slip.other_deductions)}

💰 *NET SALARY PAID:* *${formatCurrency(slip.net_pay)}*
🏦 *Account:* ${emp?.bank_name || 'Bank'} · ${emp?.bank_account || 'N/A'}
_Generated securely via ROVA Financial Operating System_`;
}
