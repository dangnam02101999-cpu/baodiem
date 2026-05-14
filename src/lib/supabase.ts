import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in Environment Variables.');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};

export const uploadAudioToSupabase = async (audioUrl: string, fileName: string): Promise<string | null> => {
  try {
    const supabase = getSupabase();
    
    // 1. Fetch the audio as a blob
    console.log("Đang tải audio từ FPT AI:", audioUrl);
    const response = await fetch(audioUrl, {
      method: 'GET',
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`Không thể tải file từ FPT: ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log("Đã chuyển đổi thành Blob, kích thước:", blob.size);

    // 2. Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('audio')
      .upload(`turns/${fileName}`, blob, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (error) {
      console.error('Lỗi Supabase Storage:', error.message);
      if (error.message.includes('bucket not found')) {
        throw new Error('Chưa tạo bucket "audio" trên Supabase!');
      }
      throw error;
    }

    // 3. Get the public URL
    const { data: publicData } = supabase.storage
      .from('audio')
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  } catch (error: any) {
    console.error('Chi tiết lỗi đồng bộ:', error);
    if (error.message === 'Failed to fetch') {
      throw new Error('Lỗi CORS: Trình duyệt chặn việc tải file. Bạn hãy thử dùng trình duyệt ở tab mới hoặc kiểm tra lại quyền truy cập URL.');
    }
    throw error;
  }
};
