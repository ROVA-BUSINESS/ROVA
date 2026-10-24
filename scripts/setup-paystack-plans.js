/**
 * Paystack Plan Setup Script for ROVA
 *
 * Configures the two daily recurring plans on Paystack:
 * 1. ROVA Basic Daily: ₦100/day (10,000 kobo, interval: "daily")
 * 2. ROVA Business Daily: ₦500/day (50,000 kobo, interval: "daily")
 *
 * (Note: Monthly plans are one-time payments and do not require Paystack plans)
 *
 * Usage:
 *   node scripts/setup-paystack-plans.js
 */

import dotenv from 'dotenv';
dotenv.config();

const secretKey = process.env.PAYSTACK_SECRET_KEY;

if (!secretKey) {
  console.log('⚠️ PAYSTACK_SECRET_KEY is not defined in .env');
  console.log('To create or inspect live plans, add PAYSTACK_SECRET_KEY=sk_test_... to your .env file.');
  process.exit(0);
}

const PLANS_TO_ENSURE = [
  {
    name: 'ROVA Basic Daily',
    interval: 'daily',
    amount: 10000, // ₦100 in kobo
    description: 'ROVA Basic Daily recurring subscription (₦100/day)',
  },
  {
    name: 'ROVA Business Daily',
    interval: 'daily',
    amount: 50000, // ₦500 in kobo
    description: 'ROVA Business Daily recurring subscription (₦500/day)',
  },
];

async function run() {
  console.log('🔍 Checking existing Paystack plans...');
  try {
    const listRes = await fetch('https://api.paystack.co/plan', {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const listJson = await listRes.json();
    const existingPlans = listJson.data || [];

    for (const plan of PLANS_TO_ENSURE) {
      const match = existingPlans.find(
        (p) => p.name === plan.name || (p.amount === plan.amount && p.interval === plan.interval)
      );

      if (match) {
        console.log(`✅ Plan already exists: "${match.name}" -> Plan Code: ${match.plan_code} (interval: ${match.interval})`);
      } else {
        console.log(`⚙️ Creating plan "${plan.name}" (interval: daily, amount: ₦${plan.amount / 100})...`);
        const createRes = await fetch('https://api.paystack.co/plan', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(plan),
        });

        const createJson = await createRes.json();
        if (createJson.status) {
          console.log(`🎉 Plan created successfully! Plan Code: ${createJson.data.plan_code}`);
        } else {
          console.error(`❌ Failed to create plan "${plan.name}":`, createJson.message);
        }
      }
    }
  } catch (err) {
    console.error('Error connecting to Paystack API:', err.message);
  }
}

run();
