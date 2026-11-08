// Single storage layer. The app only talks to `store`; nothing else touches
// localStorage or Supabase. Local and cloud backends share the same methods.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const SB_ESM = "https://esm.sh/@supabase/supabase-js@2.45.4";
const K = { v1: "goals-dash-v1", goals: "goals-dash-v2:goals", checkins: "goals-checkins-v1", seeded: "goals-dash-v2:seeded", log: "goals-dash-v2:log" };
let sb = null, user = null;

const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v)); // throws on failure so the app can flag + retry
const ok = ({ error }) => { if (error) throw error; };

/* ---------- local backend (no account, this browser only) ---------- */
function localGoals() {
  const flat = lsGet(K.goals, null);
  if (flat) return flat;
  const v1 = lsGet(K.v1, null); // data saved by the first sample version
  if (!v1) return [];
  return Object.entries(v1).flatMap(([section, list]) => list.map((g, i) => ({ ...g, section, position: i })));
}
const local = {
  async loadGoals() { return localGoals().sort((a, b) => a.position - b.position); },
  async saveGoal(section, g, position) {
    const all = localGoals().filter((x) => x.id !== g.id);
    all.push({ ...g, section, position });
    lsSet(K.goals, all);
  },
  async deleteGoal(id) { lsSet(K.goals, localGoals().filter((g) => g.id !== id)); },
  async loadCheckins() { return lsGet(K.checkins, {}); },
  async saveCheckin(day, d) { const all = lsGet(K.checkins, {}); all[day] = d; lsSet(K.checkins, all); },
  async isSeeded() { return !!lsGet(K.seeded, false) || localGoals().length > 0; },
  async markSeeded() { lsSet(K.seeded, true); },
  async loadLog() { return lsGet(K.log, {}); },
  async saveCompletion(step, date, done) {
    const log = lsGet(K.log, {}), a = (log[step] || []).filter((d) => d !== date);
    if (done) a.push(date);
    log[step] = a; lsSet(K.log, log);
  },
};

/* ---------- cloud backend (Supabase; tables in supabase/schema.sql) ----------
   App shape -> tables:  goal -> goals row (section = category)
                         goal.tasks[] -> steps rows ({id,t,d,doneAt} = id,title,done_at)
                         check-in -> check_ins row (whole answer object in `answers` jsonb)
   Every write is an upsert keyed by a client-made UUID, so retrying is always safe. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = () => crypto.randomUUID();
const cloud = {
  async loadGoals() {
    const g = await sb.from("goals").select("*").is("archived_at", null).order("position"); ok(g);
    const s = await sb.from("steps").select("*").order("position"); ok(s);
    const by = {};
    for (const r of s.data) (by[r.goal_id] ??= []).push({ id: r.id, t: r.title, d: !!r.done_at, doneAt: r.done_at || undefined, skippedAt: r.skipped_at || undefined, freq: { p: r.freq_period || "once", n: r.freq_count || 1 } });
    return g.data.map((r) => ({ id: r.id, section: r.category, title: r.title, tag: r.tag || "", deadline: r.deadline || undefined, position: r.position, tasks: by[r.id] || [] }));
  },
  async saveGoal(section, g, position) {
    ok(await sb.from("goals").upsert({ id: g.id, user_id: user.id, category: section, title: g.title, tag: g.tag || null, deadline: g.deadline || null, position }));
    const tasks = g.tasks || [];
    const rows = tasks.map((t, i) => {
      if (!t.id) t.id = uuid();
      if (!t.d) delete t.doneAt; else if (!t.doneAt) t.doneAt = new Date().toISOString();
      return { id: t.id, user_id: user.id, goal_id: g.id, title: t.t, position: i, done_at: t.d ? t.doneAt : null, skipped_at: t.skippedAt || null, freq_period: t.freq?.p || "once", freq_count: t.freq?.n || 1 };
    });
    if (rows.length) ok(await sb.from("steps").upsert(rows));
    let del = sb.from("steps").delete().eq("goal_id", g.id);
    if (rows.length) del = del.not("id", "in", "(" + rows.map((r) => r.id).join(",") + ")");
    ok(await del); // steps removed from the goal
  },
  // Archive instead of delete (per schema), so past reflections keep their history.
  async deleteGoal(id) { ok(await sb.from("goals").update({ archived_at: new Date().toISOString() }).eq("id", id)); },
  async loadCheckins() {
    const r = await sb.from("check_ins").select("*"); ok(r);
    const out = {};
    for (const c of r.data) out[c.check_date] = c.answers || {};
    return out;
  },
  async saveCheckin(day, d) {
    ok(await sb.from("check_ins").upsert({ user_id: user.id, check_date: day, answers: d }, { onConflict: "user_id,check_date" }));
  },
  // Repeating to-dos: one plan_items row per step per day; done_at null = unticked.
  // Only the last 45 days are loaded (enough for any week/month count; also stays under the 1000-row API default).
  async loadLog() {
    const since = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
    const r = await sb.from("plan_items").select("step_id,plan_date").not("done_at", "is", null).gte("plan_date", since); ok(r);
    const out = {};
    for (const x of r.data) (out[x.step_id] ??= []).push(x.plan_date);
    return out;
  },
  async saveCompletion(step, date, done) {
    ok(await sb.from("plan_items").upsert({ user_id: user.id, step_id: step, plan_date: date, done_at: done ? new Date().toISOString() : null }, { onConflict: "plan_date,step_id,user_id" }));
  },
  async isSeeded() { return !!user.user_metadata?.seeded; },
  async markSeeded() { const r = await sb.auth.updateUser({ data: { seeded: true } }); ok(r); user = r.data.user; },
};

// Cloud ids must be UUIDs. Older local data used ids like "c1"; remap them (and the
// goal references inside check-ins) so nothing dangles.
function normalizeIds({ goals = [], checkins = {}, log = {} }) {
  const map = {};
  const rid = (id) => (UUID.test(id) ? id : (map[id] ??= uuid()));
  return {
    goals: goals.map((g) => ({ ...g, id: rid(g.id), tasks: (g.tasks || []).map((t) => ({ ...t, id: t.id ? rid(t.id) : uuid() })) })),
    checkins: Object.fromEntries(Object.entries(checkins).map(([day, d]) => [day, d.goals ? { ...d, goals: d.goals.map(rid) } : d])),
    log: Object.fromEntries(Object.entries(log).map(([sid, dates]) => [rid(sid), dates])),
  };
}
async function bulkWrite(impl, data) {
  const { goals = [], checkins = {}, log = {} } = impl === cloud ? normalizeIds(data) : data;
  for (const g of goals) await impl.saveGoal(g.section, g, g.position ?? 0);   // goals/steps first: completions reference steps
  for (const [day, d] of Object.entries(checkins)) await impl.saveCheckin(day, d);
  for (const [sid, dates] of Object.entries(log)) for (const day of dates) await impl.saveCompletion(sid, day, true);
}
// First cloud sign-in: carry over anything already saved in this browser.
async function importLocalOnce() {
  if (await cloud.isSeeded()) return;
  const goals = localGoals(), checkins = lsGet(K.checkins, {}), log = lsGet(K.log, {});
  if (!goals.length && !Object.keys(checkins).length) return;
  await bulkWrite(cloud, { goals, checkins, log });
  await cloud.markSeeded();
}

const impl = () => (sb ? cloud : local);

export const store = {
  get mode() { return sb ? "cloud" : "local"; },
  get user() { return user; },
  async init() {
    if (sb || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    const { createClient } = await import(SB_ESM);
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await sb.auth.getSession();
    user = data.session?.user ?? null;
    if (user) await importLocalOnce();
  },
  onAuthChange(cb) {
    if (!sb) return;
    sb.auth.onAuthStateChange((_e, s) => {
      const u = s?.user ?? null;
      if (u?.id === user?.id) return;
      user = u;
      // defer: Supabase calls made inside this callback can deadlock
      setTimeout(() => (u ? importLocalOnce() : Promise.resolve()).catch(console.error).finally(cb), 0);
    });
  },
  signIn: (email) => sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }),
  signOut: () => sb.auth.signOut(),
  loadGoals: () => impl().loadGoals(),
  saveGoal: (section, g, position) => impl().saveGoal(section, g, position),
  deleteGoal: (id) => impl().deleteGoal(id),
  loadCheckins: () => impl().loadCheckins(),
  loadLog: () => impl().loadLog(),
  saveCompletion: (step, date, done) => impl().saveCompletion(step, date, done),
  saveCheckin: (day, d) => impl().saveCheckin(day, d),
  isSeeded: () => impl().isSeeded(),
  markSeeded: () => impl().markSeeded(),
  async exportData() { return { goals: await impl().loadGoals(), checkins: await impl().loadCheckins(), log: await impl().loadLog() }; },
  importData: (d) => bulkWrite(impl(), d),
};
