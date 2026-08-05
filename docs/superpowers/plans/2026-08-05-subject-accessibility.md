# Subject Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every daily Subject a guaranteed accessible way in (bounded angle-hints) and add a periodic fully-open Subject (Open Frame), so a Photographer is never blocked from submitting by not owning a specific object or having specific weather/light that day.

**Architecture:** Two additive, independent slices on top of the existing Subject-drop pipeline (`prompts` table → `drop_prompt()` → `get_home_state()` → Today screen). Slice 1 adds an `angles text[]` column to `prompts`, an admin RPC/UI to set it, and renders it on the live Shot card. Slice 2 adds an `'open'` category value and a cadence check inside `drop_prompt()` that pulls from that pool every Nth drop. Neither slice touches `close_day`, Bradley-Terry ranking, `get_matchup`, or the `votes` table — angles are presentation-only and Open Frame Subjects flow through the exact same pipeline as every other Subject.

**Tech Stack:** Supabase Postgres (plpgsql RPCs, SQL migrations), Expo/React Native (TypeScript), existing `lib/services/admin.ts` RPC-wrapper pattern, existing `lib/homeState.ts` cached-RPC-hook pattern.

## Global Constraints

- Brand name always lowercase "piqa" in any UI copy this plan touches — never "Piqa".
- No dashes (em, en, or joining hyphens) in any user-facing copy or content strings.
- Banned UI words: "prompt" (use "Subject"/"Shot"), "vote"/"judge" for Curators. Angle-hint copy must read as photography guidance, not AI-prompt language.
- No schema redesign — additive columns/values only, matching the project's standing "retention before revenue, additive only" rule.
- Every RPC follows the existing `SECURITY DEFINER`, `set search_path = public`, explicit `revoke`/`grant` pattern used throughout `supabase/migrations/`.
- `subjects`/`subject_drops` are BOTH the product-facing names AND the current physical Postgres table names — `20260721000002_rename_subjects.sql` renamed the tables (`prompts`→`subjects`, `prompt_drops`→`subject_drops`). Only some *columns* were left unrenamed (e.g. `subject_drops.prompt_id`, `votes.voter_id`) — see project vocabulary decision. **Correction (found during Task 1 implementation, 2026-08-05): earlier drafts of this plan incorrectly referenced `public.prompts`/`public.prompt_drops` as current physical table names. All SQL in this plan uses `public.subjects`/`public.subject_drops`.**
- Client-side admin RPC calls are cast `as never` until `supabase gen types` re-runs (existing pattern in `lib/services/admin.ts` — do not change this).

---

## File Structure

**New files:**
- `supabase/migrations/20260805000002_subject_angles.sql` — `angles` column + `admin_set_subject_angles` RPC + `get_home_state()`/`get_today_hint`-adjacent read path update
- `supabase/migrations/20260805000003_open_frame_subjects.sql` — `'open'` category value + seed batch + `drop_prompt()` cadence update

**Modified files:**
- `lib/services/admin.ts` — add `angles` to the `Subject`/`AdminDrop` types, add `setAngles()` wrapper
- `lib/homeState.ts` — add `angles` to `HomeDrop` type
- `src/components/molecules/ShotCard.tsx` — render angle chips under the prompt text
- `src/app/(tabs)/today.tsx` — pass `drop.angles` into `ShotCard`
- `src/app/admin-library.tsx` — add up to 3 angle-hint inputs to the subject edit row

---

## Task 1: `angles` column + admin RPC

**Files:**
- Create: `supabase/migrations/20260805000002_subject_angles.sql`
- Test: manual SQL verification (this repo has no automated migration test harness — verified `psql`/Supabase CLI commands below)

**Interfaces:**
- Produces: `public.prompts.angles text[]` column (nullable, max 3 entries enforced by CHECK); `public.admin_set_subject_angles(p_subject uuid, p_angles text[]) returns void` RPC, `authenticated`-grantable, admin-gated like `admin_set_subject_hint`.

- [ ] **Step 1: Write the migration**

```sql
-- Bounded angle-hints: up to 3 alternate framings of the same Subject,
-- shown to everyone at drop time so no single literal interpretation
-- blocks a Photographer who doesn't have that exact object/weather/light
-- today. Same table, same pool, same blind vote — presentation only.
alter table public.prompts
  add column if not exists angles text[]
  constraint prompts_angles_max_three check (angles is null or array_length(angles, 1) <= 3);

create or replace function public.admin_set_subject_angles(p_subject uuid, p_angles text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text[];
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  -- Drop blanks, cap at 3 (belt and suspenders alongside the CHECK).
  select array_agg(a) into cleaned
  from (
    select nullif(btrim(x), '') as a
    from unnest(coalesce(p_angles, '{}'::text[])) as x
  ) t
  where a is not null
  limit 3;

  update public.prompts set angles = cleaned where id = p_subject;
end;
$$;
revoke execute on function public.admin_set_subject_angles(uuid, text[]) from public, anon;
grant  execute on function public.admin_set_subject_angles(uuid, text[]) to authenticated;
```

- [ ] **Step 2: Extend `get_home_state()` to return `angles`**

In the same migration file, re-create `get_home_state()` (copy of the current body from `supabase/migrations/20260720000005_fix_potd_before_reveal.sql`, changed only where marked). This keeps every other field byte-identical so nothing else regresses:

```sql
create or replace function public.get_home_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  cur record;
  nxt timestamptz;
  s record;
  potd record;
  st public.streaks%rowtype;
  latest_rev record;
  res record;
  drop_json jsonb := null;
  sub_json jsonb := null;
  potd_json jsonb := null;
  top_10_json jsonb := null;
  streak_json jsonb := null;
  result_json jsonb := null;
  top_drop uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  -- Current live drop (between drop and voting close)
  select pd.id, pd.drops_at, pd.submit_closes_at, pd.voting_closes_at, pd.day_number,
         p.text as prompt, p.category as category, p.angles as angles
    into cur
  from public.prompt_drops pd
  join public.prompts p on p.id = pd.prompt_id
  where pd.region = prof.region
    and now() >= pd.drops_at
    and now() < pd.voting_closes_at
  order by pd.drops_at desc
  limit 1;

  -- Next scheduled drop
  select pd.drops_at into nxt
  from public.prompt_drops pd
  where pd.region = prof.region and pd.drops_at > now()
  order by pd.drops_at asc
  limit 1;

  if cur.id is not null then
    drop_json := jsonb_build_object(
      'id', cur.id,
      'prompt', cur.prompt,
      'category', cur.category,
      'angles', to_jsonb(cur.angles),
      'drops_at', cur.drops_at,
      'submit_closes_at', cur.submit_closes_at,
      'voting_closes_at', cur.voting_closes_at,
      'day_number', cur.day_number,
      'is_live', (now() < cur.submit_closes_at)
    );

    select sub.id, sub.captured_at, sub.image_path, sub.thumb_path,
           sub.vote_count, sub.reaction_count, sub.quick_draw, sub.in_gallery,
           sub.is_potd, sub.gallery_rank
      into s
    from public.submissions sub
    where sub.drop_id = cur.id and sub.user_id = uid;

    if s.id is not null then
      sub_json := jsonb_build_object(
        'id', s.id,
        'captured_at', s.captured_at,
        'image_path', s.image_path,
        'thumb_path', s.thumb_path,
        'vote_count', s.vote_count,
        'reaction_count', s.reaction_count,
        'quick_draw', s.quick_draw,
        'in_gallery', s.in_gallery,
        'is_potd', s.is_potd,
        'status', public.photo_status(s.is_potd, s.gallery_rank),
        'day_number', cur.day_number
      );
    end if;
  end if;

  -- Yesterday's POTD: only from revealed drops where a POTD was crowned
  -- (< 3 submissions = no voting = no crown = null here).
  select s2.id, s2.drop_id, s2.thumb_path, s2.is_potd, s2.gallery_rank,
         pd2.day_number,
         (s2.vote_count + s2.reaction_count) as hearts,
         pr.username as shooter, pr.equipped_frame as frame
    into potd
  from public.submissions s2
  join public.prompt_drops pd2 on pd2.id = s2.drop_id
  join public.profiles pr on pr.id = s2.user_id
  where pd2.region = prof.region
    and pd2.status = 'revealed'
    and s2.is_potd = true
  order by pd2.drop_date desc
  limit 1;

  if potd.id is not null then
    potd_json := jsonb_build_object(
      'submission_id', potd.id,
      'drop_id', potd.drop_id,
      'thumb_path', potd.thumb_path,
      'hearts', potd.hearts,
      'shooter', potd.shooter,
      'equipped_frame', potd.frame,
      'day_number', potd.day_number,
      'status', public.photo_status(potd.is_potd, potd.gallery_rank)
    );
  end if;

  select * into st from public.streaks where user_id = uid;
  if st.user_id is not null then
    streak_json := jsonb_build_object(
      'current_weeks', st.current_weeks,
      'days_this_week', st.days_this_week,
      'shields', st.shields,
      'is_alive', st.is_alive
    );
  end if;

  select s3.drop_id, pd3.drop_date, pd3.day_number, s3.thumb_path,
         (s3.vote_count + s3.reaction_count) as hearts, s3.vote_count as votes,
         s3.in_gallery, s3.is_potd, s3.gallery_rank, s3.xp_awarded
    into res
  from public.submissions s3
  join public.prompt_drops pd3 on pd3.id = s3.drop_id
  where s3.user_id = uid and pd3.status = 'revealed'
  order by pd3.drop_date desc
  limit 1;

  if res.drop_id is not null then
    result_json := jsonb_build_object(
      'drop_id', res.drop_id,
      'drop_date', res.drop_date,
      'day_number', res.day_number,
      'thumb_path', res.thumb_path,
      'hearts', res.hearts,
      'votes', res.votes,
      'in_gallery', res.in_gallery,
      'is_potd', res.is_potd,
      'status', public.photo_status(res.is_potd, res.gallery_rank),
      'xp_awarded', res.xp_awarded
    );
  end if;

  return jsonb_build_object(
    'drop', drop_json,
    'next_drop_at', nxt,
    'submission', sub_json,
    'yesterday_potd', potd_json,
    'streak', streak_json,
    'last_result', result_json
  );
end;
$$;
```

**Note for the implementer:** before pasting the body above, run `grep -n "top_10_json\|latest_rev" supabase/migrations/20260720000005_fix_potd_before_reveal.sql` and diff against the reconstructed body above — those two variables are declared but this plan's excerpt only showed lines 1-115 of that file, so confirm whether `top_10_json`/`latest_rev` are dead declarations or used further down (past line 115) and preserve that logic exactly if present. Do not drop any field that the current Today screen reads.

- [ ] **Step 3: Apply locally and verify**

```bash
supabase db reset --local
```

Expected: migration applies with no errors, `\d public.prompts` (via `supabase db shell` or `psql`) shows the new `angles text[]` column.

- [ ] **Step 4: Manual RPC smoke test**

```sql
-- as a seeded admin user in the local DB:
select public.admin_set_subject_angles(
  (select id from public.prompts where used_at is null limit 1),
  array['a color, not just sand and water', 'a texture', 'a feeling of being somewhere else']
);
-- confirm it landed and capped at 3:
select id, text, angles from public.prompts where angles is not null;
```

Expected: one row, `angles` array has exactly the 3 values (or fewer if duplicates/blanks were passed).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260805000002_subject_angles.sql
git commit -m "feat(subjects): add bounded angle hints to Subject drops"
```

---

## Task 2: `angles` in client types + admin wrapper

**Files:**
- Modify: `lib/services/admin.ts:58-68` (the `Subject` type), `lib/services/admin.ts:43-46` (add `setAngles` next to `setHint`)
- Modify: `lib/homeState.ts:61-71` (the `HomeDrop` type)

**Interfaces:**
- Consumes: `admin_set_subject_angles(p_subject uuid, p_angles text[])` from Task 1
- Produces: `setAngles(subjectId: string, angles: string[]): Promise<void>` in `lib/services/admin.ts`; `Subject.angles: string[] | null`; `HomeDrop.angles: string[] | null`

- [ ] **Step 1: Add `angles` to the `Subject` type and `setAngles` wrapper**

In `lib/services/admin.ts`, change the `Subject` type (currently lines 58-68):

```typescript
export type Subject = {
  id: string;
  text: string;
  category: SubjectCategory;
  hint: string | null;
  angles: string[] | null;
  is_sponsored: boolean;
  seq: number | null;
  used_at: string | null;
  created_at: string;
  in_use: boolean;
};
```

Add next to `setHint` (currently lines 43-46):

```typescript
export async function setAngles(subjectId: string, angles: string[]): Promise<void> {
  const { error } = await supabase.rpc("admin_set_subject_angles" as never, { p_subject: subjectId, p_angles: angles } as never);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Add `angles` to `HomeDrop`**

In `lib/homeState.ts`, change the `HomeDrop` type (currently lines 61-71):

```typescript
export type HomeDrop = {
  id: string;
  prompt: string;
  category: string;
  /** Up to 3 alternate framings of the same Subject, shown at drop time so
   *  no single literal interpretation blocks a Photographer that day. */
  angles: string[] | null;
  drops_at: string;
  submit_closes_at: string;
  voting_closes_at: string;
  /** Global day counter, server-owned. Printed on the frame rail. */
  day_number: number;
  is_live: boolean;
};
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors introduced by these two type changes (existing unrelated errors, if any, are out of scope).

- [ ] **Step 4: Commit**

```bash
git add lib/services/admin.ts lib/homeState.ts
git commit -m "feat(subjects): thread angle hints through client types"
```

---

## Task 3: Render angle chips on `ShotCard`

**Files:**
- Modify: `src/components/molecules/ShotCard.tsx`
- Modify: `src/app/(tabs)/today.tsx:328-332` (pass the new prop)

**Interfaces:**
- Consumes: `HomeDrop.angles` from Task 2
- Produces: `ShotCardProps.angles?: string[] | null` — a new optional prop, additive to the existing prop list

- [ ] **Step 1: Add the `angles` prop and render it**

In `src/components/molecules/ShotCard.tsx`, add to `ShotCardProps` (currently lines 20-34):

```typescript
type ShotCardProps = {
  prompt: string;
  closesAt: Date | string;
  onShoot?: () => void;
  /** Quick Draw deadline (drop + config window). Shows a bonus chip until then. */
  quickDrawUntil?: Date | string;
  /** Offline is first-class: the shot is safe locally, the button says so. */
  offline?: boolean;
  submitted?: boolean;
  loading?: boolean;
  /** Optional photography tip for today's Subject (learning loop). */
  hint?: string | null;
  /** Up to 3 alternate ways to read today's Subject, shown from the moment
   *  it drops so nobody is blocked by one literal interpretation. */
  angles?: string[] | null;
  /** Weekly Golden Shot event — a gold treatment on the whole card. */
  golden?: boolean;
};
```

Destructure it in the function signature (currently lines 41-51):

```typescript
export function ShotCard({
  prompt,
  closesAt,
  onShoot,
  quickDrawUntil,
  offline = false,
  submitted = false,
  loading = false,
  hint,
  angles,
  golden = false,
}: ShotCardProps) {
```

Render it right after the `hint` block (currently lines 88-92):

```tsx
          {hint ? (
            <Text style={styles.hint} numberOfLines={2}>
              {hint}
            </Text>
          ) : null}
          {angles && angles.length > 0 ? (
            <View style={styles.anglesRow}>
              {angles.map((angle) => (
                <View key={angle} style={styles.angleChip}>
                  <Text style={styles.angleChipText} numberOfLines={2}>
                    {angle}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
```

Add matching styles to the `StyleSheet.create` block at the bottom of the file:

```typescript
  anglesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    maxWidth: 300,
  },
  angleChip: {
    borderWidth: 1,
    borderColor: colors.paper40,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  angleChipText: {
    fontFamily: fonts.sans,
    fontSize: typeScale.tabLabel,
    color: colors.paper60,
  },
```

- [ ] **Step 2: Pass the prop from Today**

In `src/app/(tabs)/today.tsx`, the `ShotCard` usage (currently lines 328-333) becomes:

```tsx
          <ShotCard
            prompt={drop.prompt}
            hint={hint}
            angles={drop.angles}
            golden={golden}
            closesAt={drop.submit_closes_at}
            quickDrawUntil={quickDrawUntil}
            onShoot={() => router.push('/camera')}
          />
```

- [ ] **Step 3: Manual UI verification**

Run the app locally (`npx expo start`), sign in as a user with a live drop whose `prompts.angles` was set in Task 1 Step 4, open Today. Expected: headline Subject renders as before, hint (if any) below it, then a wrapped row of up to 3 low-emphasis pill chips with the angle text, visible immediately (not behind a tap). Confirm a drop with no angles set renders identically to before this change (no empty row, no layout shift).

- [ ] **Step 4: Commit**

```bash
git add src/components/molecules/ShotCard.tsx src/app/\(tabs\)/today.tsx
git commit -m "feat(subjects): show angle hint chips on the live Shot card"
```

---

## Task 4: Admin UI for angle hints

**Files:**
- Modify: `src/app/admin-library.tsx` (the subject edit row component, around lines 53-158)

**Interfaces:**
- Consumes: `Subject.angles`, `setAngles()` from Task 2
- Produces: nothing consumed by later tasks — this is the terminal UI for the admin authoring workflow

- [ ] **Step 1: Read the current edit-row component in full**

```bash
sed -n '1,170p' src/app/admin-library.tsx
```

This file wasn't fully read during planning — before editing, the implementer must read the full component (state declarations, the `save()` function, and the JSX form block) to match its exact existing patterns (how `hint` state/save is wired at lines 55 and 64) rather than guessing structure.

- [ ] **Step 2: Add angle state, mirroring the existing `hint` pattern**

Next to the existing `const [hint, setHintText] = useState(s.hint ?? '');` (line 55), add:

```typescript
  const [angle1, setAngle1] = useState(s.angles?.[0] ?? '');
  const [angle2, setAngle2] = useState(s.angles?.[1] ?? '');
  const [angle3, setAngle3] = useState(s.angles?.[2] ?? '');
```

- [ ] **Step 3: Wire it into `save()`**

Next to the existing hint-save line (`if ((hint.trim() || null) !== (s.hint ?? null)) await setHint(s.id, hint);`, line 64), add:

```typescript
      const nextAngles = [angle1, angle2, angle3].map((a) => a.trim()).filter((a) => a !== '');
      const prevAngles = s.angles ?? [];
      if (JSON.stringify(nextAngles) !== JSON.stringify(prevAngles)) await setAngles(s.id, nextAngles);
```

Add `setAngles` to the import from `@lib/services/admin` at the top of the file (find the existing import line that includes `setHint`, `updateSubject`, add `setAngles` to it).

- [ ] **Step 4: Add the 3 inputs to the JSX form**

Directly after the existing hint `TextInput` (the block starting around line 137 that binds `value={hint}`), add three more single-line inputs, following the exact same `TextInput` props/style pattern already used for hint (font, border, padding — copy the hint input's style object, don't invent a new one):

```tsx
              <TextInput
                style={styles.input}
                value={angle1}
                onChangeText={setAngle1}
                placeholder="Angle 1 (optional)"
                placeholderTextColor={colors.paper40}
                accessibilityLabel="Angle hint 1"
              />
              <TextInput
                style={styles.input}
                value={angle2}
                onChangeText={setAngle2}
                placeholder="Angle 2 (optional)"
                placeholderTextColor={colors.paper40}
                accessibilityLabel="Angle hint 2"
              />
              <TextInput
                style={styles.input}
                value={angle3}
                onChangeText={setAngle3}
                placeholder="Angle 3 (optional)"
                placeholderTextColor={colors.paper40}
                accessibilityLabel="Angle hint 3"
              />
```

Match `styles.input` to whatever style constant the hint `TextInput` already uses — read it exactly rather than assuming the name; if the hint input uses a different style constant name, use that same name for these three.

- [ ] **Step 5: Manual verification**

Run the admin screen locally as an admin user, open a Subject's edit row, type into all 3 angle fields, save, reopen — confirm the 3 values persisted and reload as the same 3 strings. Leave one blank, save, confirm `admin_set_subject_angles` receives only the 2 non-blank values (check via Supabase local logs or a `select angles from public.prompts where id = ...`).

- [ ] **Step 6: Commit**

```bash
git add src/app/admin-library.tsx
git commit -m "feat(subjects): add angle hint fields to the admin Subject editor"
```

---

## Task 5: Open Frame category + seed batch

**Files:**
- Create: `supabase/migrations/20260805000003_open_frame_subjects.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks (independent of Tasks 1-4)
- Produces: `public.subjects.category` CHECK now allows `'open'`; ~12 new rows in `public.subjects` with `category = 'open'`

**Verified schema facts (do not re-derive, use as given):** the physical tables are `public.subjects` and `public.subject_drops` (renamed from `prompts`/`prompt_drops` by `20260721000002_rename_subjects.sql`; the `subject_drops.prompt_id` column itself keeps its old name — do not rename it). `public.config` has columns `key text primary key` and `value jsonb not null` (`supabase/migrations/20260711000001_init.sql:154-158`) — inserting a bare numeric string literal like `'5'` into `value` works because it casts as a JSON scalar, matching the existing seed rows (`('vote_cap', '50')` etc. at the same file's lines 160+). `public.cfg_int(p_key text, p_default int)` reads it back via `(value #>> '{}')::int` (`supabase/migrations/20260711000009_galleries.sql:30-38`).

The **true current** `drop_prompt()` body (verified as the last `CREATE OR REPLACE FUNCTION public.drop_prompt` across all migrations, in `supabase/migrations/20260721000002_rename_subjects.sql:772-813`) is reproduced below — this supersedes the plan's earlier draft, which pointed at a stale pre-rename version.

- [ ] **Step 1: Write the migration**

```sql
-- Open Frame: a fully open Subject ("anything, your eye") drawn from its own
-- pool on a fixed cadence (see drop_prompt() change in this same migration),
-- so accessibility isn't only ever a bet on how a literal Subject is worded.

alter table public.subjects drop constraint if exists subjects_category_check;
alter table public.subjects add constraint subjects_category_check
  check (category in ('object','color','light','pov','emotion','absurd','open'));

insert into public.subjects (text, category, seq)
select v.text, 'open', (select coalesce(max(seq), 0) from public.subjects) + v.ord
from (values
  ('Open Frame. Anything, your eye', 1),
  ('Open Frame. Whatever caught your eye today', 2),
  ('Open Frame. Shoot the thing you almost walked past', 3),
  ('Open Frame. No rules today, just your eye', 4),
  ('Open Frame. The photo you already wanted to take', 5),
  ('Open Frame. Show us how you see things', 6),
  ('Open Frame. One frame, total freedom', 7),
  ('Open Frame. Your day, one photo', 8),
  ('Open Frame. Whatever is in front of you right now', 9),
  ('Open Frame. Surprise the gallery', 10),
  ('Open Frame. Just shoot something you like', 11),
  ('Open Frame. A blank canvas kind of day', 12)
) as v(text, ord)
where not exists (select 1 from public.subjects s where s.text = v.text);
```

- [ ] **Step 2: Add cadence logic to `drop_prompt()`**

In the same migration file, re-create `drop_prompt()` starting from the verified true-current body (`20260721000002_rename_subjects.sql:772-813`, reproduced here with the cadence logic added — changes marked):

```sql
create or replace function public.drop_prompt(p_region text default 'PH')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_local date := (now() at time zone 'Asia/Manila')::date;
  chosen record;
  drops_at timestamptz;
  submit_close timestamptz;
  voting_close timestamptz;
  new_drop_id uuid;
  every_n int := public.cfg_int('open_frame_every_n_days', 5);  -- NEW
  drop_count int;  -- NEW
begin
  if exists (select 1 from public.subject_drops where region = p_region and drop_date = today_local) then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'exists');
  end if;

  select count(*) into drop_count from public.subject_drops where region = p_region;  -- NEW

  -- NEW: every Nth drop (1-indexed: drop #5, #10, ... land on Open Frame),
  -- pull from the 'open' pool first, same used_at cycling as the main pool.
  -- Falls through to the normal pick if the open pool is exhausted.
  if every_n > 0 and (drop_count + 1) % every_n = 0 then
    select id, text into chosen
    from public.subjects
    where category = 'open'
    order by used_at asc nulls first, seq asc nulls last, random()
    limit 1;
  end if;

  if chosen.id is null then
    select id, text into chosen
    from public.subjects
    where category != 'open'  -- CHANGED: was an unconditional select with no where
    order by used_at asc nulls first, seq asc nulls last, random()
    limit 1;
  end if;

  if chosen.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_prompts');
  end if;

  drops_at     := ((today_local + time '06:00') at time zone 'Asia/Manila')
                  + make_interval(mins => floor(random() * 60)::int);
  submit_close := ((today_local + time '18:00') at time zone 'Asia/Manila');
  voting_close := ((today_local + time '19:00') at time zone 'Asia/Manila');

  insert into public.subject_drops
    (prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
  values
    (chosen.id, p_region, today_local, drops_at, submit_close, voting_close, 'scheduled')
  on conflict (region, drop_date) do nothing
  returning id into new_drop_id;

  update public.subjects set used_at = today_local where id = chosen.id;

  return jsonb_build_object('ok', true, 'created', true, 'drop_id', new_drop_id, 'drops_at', drops_at);
end;
$$;
```

Note `subject_drops.prompt_id` in the insert column list above is correct as written — that column was deliberately left unrenamed (see Global Constraints).

Add the default config row so `cfg_int` has a documented value (mirrors the existing seed rows in `supabase/migrations/20260711000001_init.sql:160-164`, e.g. `('vote_cap', '50')` — match that exact `insert into public.config (key, value) values (...)` shape; add `on conflict (key) do nothing` since this migration runs after the initial seed):

```sql
insert into public.config (key, value)
values ('open_frame_every_n_days', '5')
on conflict (key) do nothing;
```

- [ ] **Step 3: Apply locally and verify**

```bash
supabase db reset --local
```

Expected: no errors. Then:

```sql
select category, count(*) from public.subjects group by category;
```

Expected: an `'open'` row with 12 (or however many survived the `where not exists` idempotency check).

- [ ] **Step 4: Verify cadence with the dev time machine**

Using `src/app/dev/time-machine` (or direct RPC calls in a local SQL console), call `public.drop_prompt('PH')` repeatedly across simulated days (advancing `prompt_drops` count for region PH to 4, then calling a 5th time) and confirm the 5th call's `chosen` Subject has `category = 'open'`. Confirm the 4 surrounding calls do not.

```sql
-- sanity check after simulating 5 drops:
select pd.day_number, p.category, p.text
from public.subject_drops pd join public.subjects p on p.id = pd.prompt_id
where pd.region = 'PH'
order by pd.drop_date;
```

Expected: exactly the 5th row (and 10th, if simulated further) has `category = 'open'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260805000003_open_frame_subjects.sql
git commit -m "feat(subjects): add Open Frame relief day every 5th drop"
```

---

## Task 6: Confirm blind vote never leaks angle/category data

**Files:**
- No modifications — verification-only task

**Interfaces:**
- Consumes: nothing new
- Produces: nothing — this is a guardrail check before calling the feature done

- [ ] **Step 1: Read the current `get_matchup` definition**

```bash
grep -n "create or replace function public.get_matchup" -A 60 supabase/migrations/20260716000007_matchup_theme.sql
```

- [ ] **Step 2: Confirm the returned JSON never includes `angles` or `category`**

Read the full `jsonb_build_object(...)` in that function's return path. Expected: only image/thumb paths and submission ids for the two blind entries, same as before this plan — this plan added no `angles` field to any matchup-related function, so this step should find nothing to fix. If it does find `category` or similar already leaking (pre-existing, unrelated to this plan), stop and flag it to the user rather than silently fixing an out-of-scope issue.

- [ ] **Step 3: Manual QA pass**

With a live Open Frame drop and a live angle-hint drop both simulated locally (via Task 5 Step 4's approach), open the Curate screen as a second test user and confirm the two photos shown for voting carry no visible text, category badge, or angle indicator — visually identical to a normal drop's curation screen.

- [ ] **Step 4: No commit** (verification-only task, nothing changed)

---

## Self-Review Notes

**Spec coverage:**
- Bounded-angle Subjects (spec §1) → Tasks 1-4.
- Open Frame relief day (spec §2) → Task 5.
- Shield tuning (spec §3) → explicitly out of scope for this plan per the spec's own framing ("worth a one-line config bump if alpha data shows..." — a future data-driven decision, not a build task today). Not included as a task.
- Fairness firewall guarantee (angles/category never reach blind vote) → Task 6.
- Content retrofit of the existing 66 Subjects → explicitly flagged in the spec as a non-code follow-up, correctly excluded from this plan.

**Type consistency check:** `angles: string[] | null` used consistently across `Subject` (admin.ts), `HomeDrop` (homeState.ts), and `ShotCardProps` (ShotCard.tsx). `setAngles(subjectId: string, angles: string[])` signature matches its one call site in Task 4. `admin_set_subject_angles(p_subject uuid, p_angles text[])` matches the `supabase.rpc()` call's parameter names exactly.

**Known gaps for the implementer to resolve while executing (flagged honestly rather than guessed):**
- Task 1 Step 2 depends on confirming `top_10_json`/`latest_rev` handling past line 115 of the reference migration — must be read in full before this migration is finalized, not assumed absent.
- Task 4 depends on reading `src/app/admin-library.tsx` in full first (Step 1 of that task exists specifically to force this) since only grep line numbers, not the full component, were available while planning.
- Task 5's config table column names (`key`/`value` assumed) must be confirmed against the actual `create table public.config` statement before the insert is finalized.
