import { supabase } from '../config/supabase';

export interface ROVAUser {
  id: string;
  phone: string;
}

/**
 * Authenticates a WhatsApp sender by looking up their phone number
 * in the ROVA database. Rejects any unknown numbers.
 */
export class AuthService {
  /**
   * Phone numbers from WhatsApp arrive in E.164 format without '+' (e.g., "2348123456789").
   * We match against stored formats: "+234...", "234...", or "0...".
   */
  async getUserByPhone(rawPhone: string): Promise<ROVAUser | null> {
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const withPlus = `+${cleanPhone}`;
    const localPhone = cleanPhone.startsWith('234') ? `0${cleanPhone.slice(3)}` : cleanPhone;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, phone')
      .or(`phone.eq.${withPlus},phone.eq.${cleanPhone},phone.eq.${localPhone}`)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.warn(`🔒 Unknown phone number attempted access: ${rawPhone}`);
      return null;
    }

    return data as ROVAUser;
  }

  /**
   * Registers a new ROVA user directly from WhatsApp.
   */
  async registerUserByWhatsApp(rawPhone: string, businessName: string): Promise<ROVAUser | null> {
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phone = `+${cleanPhone}`;
    const userId = crypto.randomUUID();

    const { error } = await supabase.from('profiles').insert({
      id: userId,
      full_name: businessName,
      business_name: businessName,
      phone: phone,
      mode: 'business',
      currency: 'NGN',
    });

    if (error) {
      console.error('Failed to register WhatsApp user:', error);
      return null;
    }

    return { id: userId, phone };
  }
}
