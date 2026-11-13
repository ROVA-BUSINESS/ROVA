import assert from 'node:assert/strict';
import {
  DEFAULT_REMINDER_CONFIG,
  formatTimeDisplay,
  getReminderConfig,
} from '../src/lib/transactionReminder.ts';

console.log('Testing Daily Transaction Reminder logic...');

// 1. Time formatting
assert.equal(formatTimeDisplay('20:00'), '8:00 PM');
assert.equal(formatTimeDisplay('18:30'), '6:30 PM');
assert.equal(formatTimeDisplay('09:05'), '9:05 AM');
assert.equal(formatTimeDisplay('00:00'), '12:00 AM');
assert.equal(formatTimeDisplay('12:00'), '12:00 PM');
assert.equal(formatTimeDisplay('23:59'), '11:59 PM');

// 2. Default configuration
assert.equal(DEFAULT_REMINDER_CONFIG.enabled, true);
assert.equal(DEFAULT_REMINDER_CONFIG.time, '20:00');
assert.equal(DEFAULT_REMINDER_CONFIG.onlyIfMissingToday, true);
assert.equal(DEFAULT_REMINDER_CONFIG.checkUncategorized, true);
assert.equal(DEFAULT_REMINDER_CONFIG.sound, true);

// 3. Fallback when user id is empty
const fallback = getReminderConfig('');
assert.equal(fallback.time, '20:00');

console.log('ALL TRANSACTION REMINDER TESTS PASSED!');
