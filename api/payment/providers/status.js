export default function handler(req, res) {
  try {
    const paystackConfigured = Boolean(
      process.env.PAYSTACK_SECRET_KEY ||
      process.env.VITE_PAYSTACK_PUBLIC_KEY
    );

    const kudaConfigured = Boolean(
      process.env.KUDA_API_KEY &&
      process.env.KUDA_CLIENT_EMAIL
    );

    const opayConfigured = Boolean(
      process.env.OPAY_MERCHANT_ID &&
      process.env.OPAY_PRIVATE_KEY
    );

    const moniepointConfigured = Boolean(
      process.env.MONIEPOINT_CLIENT_ID &&
      process.env.MONIEPOINT_CLIENT_SECRET
    );

    return res.status(200).json({
      success: true,
      providers: {
        paystack: {
          configured: paystackConfigured,
          envVarsNeeded: ['PAYSTACK_SECRET_KEY', 'VITE_PAYSTACK_PUBLIC_KEY'],
          status: paystackConfigured ? 'connected' : 'not_connected',
        },
        kuda: {
          configured: kudaConfigured,
          envVarsNeeded: ['KUDA_API_KEY', 'KUDA_CLIENT_EMAIL'],
          status: kudaConfigured ? 'connected' : 'not_connected',
        },
        opay: {
          configured: opayConfigured,
          envVarsNeeded: ['OPAY_MERCHANT_ID', 'OPAY_PRIVATE_KEY'],
          status: opayConfigured ? 'connected' : 'not_connected',
        },
        moniepoint: {
          configured: moniepointConfigured,
          envVarsNeeded: ['MONIEPOINT_CLIENT_ID', 'MONIEPOINT_CLIENT_SECRET'],
          status: moniepointConfigured ? 'connected' : 'not_connected',
        },
      },
    });
  } catch (err) {
    console.error('Provider status check error:', err);
    return res.status(500).json({ success: false, error: 'Failed to check provider status.' });
  }
}
