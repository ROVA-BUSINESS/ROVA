-- Add reminder schedule and delivery tracking columns to push_subscriptions
ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reminder_time TEXT DEFAULT '20:00',
ADD COLUMN IF NOT EXISTS only_if_missing_today BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS check_uncategorized BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sound BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_pushed_date TEXT,
ADD COLUMN IF NOT EXISTS last_pushed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_push_subs_schedule 
ON public.push_subscriptions(reminder_enabled, reminder_time, last_pushed_date);
