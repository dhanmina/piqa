-- Update cron to fire before 6 AM Manila (5:55 AM Manila = 21:55 UTC).
select cron.unschedule('piqa-drop-prompt');
select cron.schedule('piqa-drop-prompt', '55 21 * * *', $$ select public.drop_prompt('PH'); $$);
