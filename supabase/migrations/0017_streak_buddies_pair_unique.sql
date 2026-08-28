-- send_buddy_request's application-level duplicate check is a TOCTOU
-- under concurrent calls (confirmed reproducible: two overlapping
-- requests between the same pair both pass the exists() check and both
-- insert). This unique index is the real backstop; the exists() check
-- and advisory locks in send_buddy_request stay in place as a
-- friendlier first line of defense (they produce a clean error message
-- in the common case), this index guarantees correctness in the race
-- case even if the message that surfaces there is a raw Postgres
-- unique-violation rather than the friendly custom one.
create unique index streak_buddies_pair_idx on public.streak_buddies
  (least(requester_id, recipient_id), greatest(requester_id, recipient_id))
  where status in ('pending', 'accepted');
