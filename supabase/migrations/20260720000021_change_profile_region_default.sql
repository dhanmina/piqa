-- Change default region for profiles from BETA to PH.
alter table public.profiles alter column region set default 'PH';
update public.profiles set region = 'PH' where region = 'BETA';
