-- Backfill for the 3-frame test set (one per tier), per the TODO left in
-- 20260820000007_revenuecat_product_id_todo.sql. RevenueCat internal ids
-- sourced from the Test Store product detail pages, not guessed. The
-- remaining 6 frames (flash, grain, reflection, silhouette, doubleexposure,
-- seasons) stay null until the pipeline is validated against this 3-frame
-- set and the rest are actually needed.
update public.frames set revenuecat_product_id = 'prod2dd1c97f93' where id = 'focus';
update public.frames set revenuecat_product_id = 'prodb1407fff5f' where id = 'bokeh';
update public.frames set revenuecat_product_id = 'prodadfdabecb6' where id = 'aurora';
