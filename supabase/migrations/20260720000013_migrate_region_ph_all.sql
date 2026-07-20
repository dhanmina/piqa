-- Migrate existing BETA drops to Philippines region (profiles already migrated).
update public.prompt_drops set region = 'PH' where region = 'BETA';
