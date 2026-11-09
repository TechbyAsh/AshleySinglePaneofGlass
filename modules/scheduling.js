// Scheduling module: frequency logic, completion tracking, due date calculations
import { lday, dayKey, pstart } from "./utils.js";

// How a to-do repeats: freq = {p:"once"|"day"|"week"|"month", n:times per period}.
// Completions of repeating to-dos live in LOG[stepId] = ["YYYY-MM-DD", ...] (plan_items rows).
// Weeks start Monday. "Weekly x3" stays on Today until it has been done 3 times this week.

let LOG = {};

export function setLog(log) {
  LOG = log
}

export function getLog() {
  return LOG
}

export function fq(t) {
  return t.freq || {p:"once", n:1}
}

export function cnt(t, p) {
  var s = pstart(p), e = dayKey(0);
  return (LOG[t.id]||[]).filter(function(x){return x>=s && x<=e}).length
}

export function doneToday(t) {
  return (LOG[t.id]||[]).indexOf(dayKey(0)) > -1
}

export function skippedToday(t) {
  return !!(t.skippedAt && lday(t.skippedAt) === dayKey(0))
}

export function onceToday(t) {
  return !!(t.d && t.doneAt && lday(t.doneAt) === dayKey(0))
}

export function checked(t) {
  return fq(t).p === "once" ? !!t.d : doneToday(t)
}

export function quotaMet(t) {
  var f = fq(t);
  return f.p === "once" ? !!t.d : f.p === "day" ? doneToday(t) : cnt(t, f.p) >= f.n
}

export function dueToday(t) {
  if (skippedToday(t)) return false;
  var f = fq(t);
  if (f.p === "once") return !t.d || onceToday(t);
  if (f.p === "day") return true;
  return cnt(t, f.p) < f.n || doneToday(t)
}

export function fLabel(t) {
  var f = fq(t);
  if (f.p === "once") return "One-time";
  if (f.p === "day") return "Daily";
  if (f.n > 1) return f.n + "×/" + (f.p === "week" ? "wk" : "mo");
  return f.p === "week" ? "Weekly" : "Monthly"
}

export function prog(t) {
  var f = fq(t);
  return f.p === "week" || f.p === "month" ? Math.min(cnt(t, f.p), f.n) + "/" + f.n + " this " + f.p : ""
}

export function daysLeft(d) {
  return Math.round((new Date(d+"T12:00") - new Date(dayKey(0)+"T12:00")) / 864e5)
}

export function dlLabel(d) {
  var n = daysLeft(d), s = new Date(d+"T12:00").toLocaleDateString("en-US", {month:"short", day:"numeric"});
  return n < 0 ? "Overdue by " + (-n) + (n === -1 ? " day" : " days") : n === 0 ? "Due today" : "Due " + s + " · " + n + (n === 1 ? " day" : " days") + " left"
}
