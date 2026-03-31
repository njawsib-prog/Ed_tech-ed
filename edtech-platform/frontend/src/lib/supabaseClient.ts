import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase Client for Frontend - Uses Anon Key
// This client respects Row Level Security

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables');
}

export const supabaseClient: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// Storage bucket names
export const STORAGE_BUCKETS = {
  MATERIALS: 'study-materials',
  STUDENT_DOCS: 'student-documents',
  BRAND: 'brand-assets',
  RECEIPTS: 'receipts',
} as const;

// Helper function to get a public URL for a file
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Helper function to get a signed URL for a private file
export async function getSignedUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string | null> {
  const { data, error } = await supabaseClient.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
  return data.signedUrl;
}

export default supabaseClient;