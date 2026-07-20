-- Migrate existing BETA users to Philippines region.
update public.profiles set region = 'PH' where region = 'BETA';
