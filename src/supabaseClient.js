// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL or Anon Key is missing. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Professional login service
export const professionalAuthService = {
  async signIn(email, password) {
    console.log('🔐 Professional Login - Checking profiles table...');

    // Check profiles table for station admin credentials
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        *,
        stations (*)
      `)
      .eq('email', email.trim().toLowerCase())
      .eq('password', password)
      .in('role', ['admin', 'police_station', 'fire_station', 'ambulance_station'])
      .maybeSingle();

    if (error) {
      console.error('❌ Database Error:', error);
      throw new Error('Database error during verification.');
    }

    if (!profile) {
      throw new Error('Invalid email or password. Please ensure you have station admin access.');
    }

    return { profile };
  }
};