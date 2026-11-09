// Main application entry point - imports and initializes modules
import { store } from "./storage.js";
import { render, load, showSignIn, setRenderCallback } from "./modules/ui.js";
import { setSync, flush, getDirty, hasDirty } from "./modules/engine.js";
import { setCheckinState, getCheckinState, layer } from "./modules/checkin.js";
import { dayKey } from "./modules/utils.js";

// Set up render callback for check-in finish
setRenderCallback(render);

var wired = false;

async function boot() {
  await store.init();
  if (!wired) {
    wired = true;
    store.onAuthChange(boot)
  }
  if (store.mode === "cloud" && !store.user) {
    showSignIn();
    return
  }
  setCheckinState({open:false, step:0, data:{}});
  layer();
  try {
    await load();
    setSync()
  } catch(e) {
    console.error(e)
  }
  render();
}

// Import file handler
document.getElementById("imp").addEventListener("change", function(e) {
  var f = e.target.files[0];
  if (!f) return;
  f.text().then(function(t){return store.importData(JSON.parse(t))}).then(load).then(render).catch(console.error);
  e.target.value = ""
});

// Online/offline handlers
window.addEventListener("online", function() {
  if (hasDirty()) flush()
});

document.addEventListener("visibilitychange", function() {
  if (!document.hidden && hasDirty()) flush()
});

window.addEventListener("beforeunload", function(e) {
  if (hasDirty()) {
    e.preventDefault();
    e.returnValue = ""
  }
});

// Initialize the application
boot();
