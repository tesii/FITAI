import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ojzeaqememaevlxcyabn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qemVhcWVtZW1hZXZseGN5YWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTQxODIsImV4cCI6MjA4OTMzMDE4Mn0.4Dg17eTLAK0AlHXmrCCvxEIa2RngJIu0kr1v5rX439Y'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)