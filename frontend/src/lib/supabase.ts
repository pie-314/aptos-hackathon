import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;


export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Brand {
  id: string;
  brandName: string;
  brandEmail: string;
  contactNumber: string;
  brandAddress: string;
  registrarName: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      Brand: {
        Row: Brand;
        Insert: Omit<Brand, 'id' | 'created_at'>;
        Update: Partial<Omit<Brand, 'id' | 'created_at'>>;
      };
    };
  };
}
