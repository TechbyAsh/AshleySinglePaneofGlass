// Engine module: dirty tracking, persistence, sync, and retry logic
import { store } from "../storage.js";
import { esc } from "./utils.js";

// Unsaved-changes tracker: every write is marked dirty, saved, and cleared only if
// nothing newer was marked meanwhile. Failures keep the entry, flag it, and retry
// with backoff (2s, 4s... max 30s). "Retry now", coming back online, and returning
// to the tab also trigger a retry. Each retry saves the CURRENT state, never a stale copy.
let dirty = {}, flushing = false, rerun = false, retryTimer = null, retryN = 0, notice = "";

export function failedCount() {
  return Object.keys(dirty).filter(function(k){return dirty[k].failed}).length
}

export function isFailed(k) {
  return !!(dirty[k]&&dirty[k].failed)
}

export function syncText() {
  var n = failedCount();
  return n ? n+" unsaved" : store.mode==="cloud" ? "Synced to your account" : "Saved on this device only"
}

export function bannerHTML() {
  var n = failedCount();
  if (n) return '<span>'+n+' unsaved change'+(n>1?'s':'')+'. '+(flushing?'Retrying…':'Will retry automatically.')+'</span><button class="btn" data-ci="retry">Retry now</button>';
  return notice ? '<span>'+esc(notice)+'</span>' : ''
}

export function syncUI() {
  var s = document.getElementById("sync");
  if (s) s.textContent = syncText();
  var b = document.getElementById("banner");
  if (b) {
    var h = bannerHTML();
    b.innerHTML = h;
    b.hidden = !h
  }
  document.querySelectorAll("[data-gid]").forEach(function(c){
    c.classList.toggle("is-unsaved", isFailed("g:"+c.dataset.gid))
  });
}

export function setSync() {
  syncUI()
}

export function fail(e) {
  console.error(e);
  notice = (e&&e.message)||"Something went wrong";
  syncUI();
  setTimeout(function(){notice="";syncUI()},6000)
}

export function mark(k, e) {
  var d = dirty[k];
  e.v = (d?d.v:0)+1;
  e.failed = d?d.failed:false;
  dirty[k] = e
}

export function persist(g, sec) {
  mark("g:"+g.id, {type:"goal", section:sec, id:g.id});
  return flush()
}

export function saveEntry(e) {
  // This will be set by the main app to handle different entry types
  return saveEntryHandler(e)
}

let saveEntryHandler = null;

export function setSaveEntryHandler(handler) {
  saveEntryHandler = handler
}

export async function flush() {
  if (flushing) { rerun = true; return }
  flushing = true;
  clearTimeout(retryTimer);
  if (failedCount()) syncUI();
  var failed = false;
  do {
    rerun = false;
    var keys = Object.keys(dirty);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], e = dirty[k];
      if (!e) continue;
      var v = e.v;
      try {
        await saveEntry(e);
        if (dirty[k] && dirty[k].v === v) delete dirty[k]
      } catch(err) {
        console.error(err);
        failed = true;
        if (dirty[k]) dirty[k].failed = true
      }
    }
  } while (rerun);
  flushing = false;
  if (failed && Object.keys(dirty).length) {
    retryN++;
    retryTimer = setTimeout(flush, Math.min(30000, 1000*Math.pow(2,retryN)))
  } else retryN = 0;
  syncUI();
}

export function getDirty() {
  return dirty
}

export function clearDirty(key) {
  delete dirty[key]
}

export function hasDirty() {
  return Object.keys(dirty).length > 0
}
