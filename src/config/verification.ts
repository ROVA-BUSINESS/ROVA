/**
 * Verification System Configuration & Integration Service
 * Manages Test vs Production verification modes for NIN, BVN, and RC/BN checks.
 */

export type VerificationMode = 'test' | 'production';

export const VERIFICATION_MODE: VerificationMode = 
  (import.meta.env.VITE_VERIFICATION_MODE as VerificationMode) || 'test';

export function isTestVerificationMode(): boolean {
  return VERIFICATION_MODE === 'test';
}

export function isProductionVerificationMode(): boolean {
  return VERIFICATION_MODE === 'production';
}

export interface VerificationResult {
  success: boolean;
  message: string;
  verifiedData?: {
    business_name?: string;
    registration_number?: string;
    registration_date?: string;
    full_name?: string;
    id_number?: string;
  };
}

/**
 * Verifies CAC RC / BN registration number.
 * In TEST mode (or when API is not connected), returns a success response with mock prefilled data.
 */
export async function verifyRcBnNumber(
  rcBn: string,
  registrationType: 'registered' | 'unregistered'
): Promise<VerificationResult> {
  if (registrationType === 'unregistered') {
    return {
      success: true,
      message: 'Unregistered business does not require RC/BN.',
    };
  }

  const cleanRc = rcBn.trim().toUpperCase();
  if (!cleanRc) {
    return {
      success: false,
      message: 'Please provide a valid RC or BN number.',
    };
  }

  if (isTestVerificationMode()) {
    // Simulate short network delay for realism
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
      success: true,
      message: 'Business verified successfully (Test Mode)',
      verifiedData: {
        registration_number: cleanRc,
        registration_date: '2022-04-15',
      },
    };
  }

  // PRODUCTION MODE Verification Integration
  try {
    const response = await fetch('/api/verify-rc-bn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rc_bn_number: cleanRc }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        message: err.message || 'RC/BN verification failed. Please check the number and try again.',
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: 'Business verified with CAC database ✓',
      verifiedData: data,
    };
  } catch (err: any) {
    console.error('RC/BN verification error:', err);
    return {
      success: false,
      message: 'Unable to connect to verification provider. Please try again or contact support.',
    };
  }
}

/**
 * Verifies Identity using NIN or BVN.
 * In TEST mode, bypasses verification while preserving UI components.
 */
export async function verifyIdentity(
  idType: 'NIN' | 'BVN',
  idNumber: string
): Promise<VerificationResult> {
  const cleanId = idNumber.trim();

  if (isTestVerificationMode()) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return {
      success: true,
      message: 'Identity verification completed (Test Mode)',
      verifiedData: {
        id_number: cleanId ? `***${cleanId.slice(-4)}` : '****',
      },
    };
  }

  if (!cleanId || cleanId.length < 11) {
    return {
      success: false,
      message: `Please enter a valid 11-digit ${idType}.`,
    };
  }

  try {
    const response = await fetch('/api/verify-identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_type: idType, id_number: cleanId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        message: err.message || `${idType} verification failed. Please check your details.`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: 'Identity verified successfully ✓',
      verifiedData: data,
    };
  } catch (err: any) {
    console.error('Identity verification error:', err);
    return {
      success: false,
      message: 'Verification service temporarily unavailable.',
    };
  }
}
