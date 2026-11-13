import assert from 'node:assert/strict';
import {
  VAPID_PUBLIC_KEY,
  urlBase64ToUint8Array,
  isPushSupported,
  getNotificationPermission,
} from '../src/lib/webPush.ts';

console.log('Testing Web Push & Service Worker logic...');

// 1. Verify VAPID Public Key format and conversion
assert.ok(VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length > 50, 'VAPID public key must exist');
const uint8Key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
assert.equal(uint8Key.length, 65, 'Uncompressed P-256 public key must be exactly 65 bytes');
assert.equal(uint8Key[0], 0x04, 'Uncompressed EC public key must begin with byte 0x04');
console.log('✓ VAPID P-256 public key properly validated and converted (65 bytes, prefix 0x04)');

// 2. Headless / Server-side safety checks
assert.equal(isPushSupported(), false, 'isPushSupported should safely return false in Node/headless context');
assert.equal(getNotificationPermission(), 'unsupported', 'getNotificationPermission should safely return unsupported in Node/headless context');
console.log('✓ Server-side and Node environment safety checks pass');

console.log('ALL WEB PUSH UNIT TESTS PASSED!');
