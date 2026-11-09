// UI module: main rendering, event handlers, and application orchestration
import { store } from "../storage.js";
import { esc, newId, dayKey } from "./utils.js";
import { setLog, getLog, fq, checked, quotaMet, skippedToday } from "./scheduling.js";
import { setState, getState, setTab, getTab, setEditing, getEditing, find, addTask, toggleTask, pct, totals, goalCard, toggleGoalComplete, isGoalComplete } from "./goals.js";
import { triggerConfetti } from "./confetti.js";
import { setCheckins, getCheckins, setCheckinState, getCheckinState, streak, lipText, ciSteps, layer, grab, finish, toggle } from "./checkin.js";
import { todayItems, homeHTML, secName } from "./home.js";
import { syncUI, syncText, bannerHTML, fail, mark, persist, flush, getDirty, clearDirty, hasDirty, setSaveEntryHandler } from "./engine.js";

const ICONS = {
  home:'<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/></svg>',
  career:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
  personal:'<svg viewBox="0 0 24 24"><path d="M12 3l2.2 5.3L20 9l-4.3 3.9L17 19l-5-3-5 3 1.3-6.1L4 9l5.8-.7z"/></svg>',
  family:'<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'
};

const HOME = {id:"home", name:"Home", line:"Everything due today, pulled from all your goals."};
const SECTIONS = [
  {id:"career",name:"Career",line:"Cyber, identity, and the dessert bar — all moving forward."},
  {id:"personal",name:"Personal",line:"A space just for you."},
  {id:"family",name:"Family",line:"The people you're building all of this for."}
];

const WINS = ["CompTIA CySA+","CompTIA Security+","Per Scholas Cybersecurity Analyst","Forage: AIG Shields Up","Forage: Deloitte Cyber Simulation"];

function T(a) { return a.map(function(t){return {t:t[0], d:!!t[1]}}) }

const SEED = {
  career:[
    {id:"c1",title:"Splunk Core User certification",tag:"Certification",tasks:T([["Work through Splunk Basics lessons"],["Practice SPL on the Buttercup Games tutorial data"]])},
    {id:"c2",title:"SC-300 Identity & Access Administrator",tag:"Certification",tasks:T([["Entitlement Management"],["Conditional Access"],["Privileged Identity Management (PIM)"]])},
    {id:"c3",title:"Land a cybersecurity role",tag:"Job search",tasks:T([["Apply: LIPA IT Analyst, Cyber Security"],["Explore intern and entry-level roles"]])},
    {id:"c4",title:"Project Kingdom Shield",tag:"Portfolio",tasks:T([["Phase 1: company design deliverables",1],["Phase 2: Active Directory build",1],["Phase 2 Medium blog post"],["Complete all 9 phases"]])},
    {id:"c5",title:"The Cake Jar Bar",tag:"Business",tasks:T([["Brand system, website and pricing guide",1],["Apply brand assets across platforms"],["Build Instagram content presence in Canva"]])}
  ],
  personal:[],
  family:[]
};

let adding = false;

export function ring(p) {
  var r = 44, c = 2*Math.PI*r;
  return '<div class="ring"><svg viewBox="0 0 104 104"><circle cx="52" cy="52" r="'+r+'" fill="none" stroke="var(--sunk)" stroke-width="10"/><circle cx="52" cy="52" r="'+r+'" fill="none" stroke="var(--rose)" stroke-width="10" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+(c*(1-p/100))+'"/></svg><b>'+p+'%</b></div>'
}

export function render() {
  var home = getTab() === "home", all = [HOME].concat(SECTIONS);
  document.getElementById("rail").innerHTML = '<div class="logo">A</div>'+all.map(function(s){
    return '<button class="tab" role="tab" aria-selected="'+(s.id===getTab())+'" data-tab="'+s.id+'">'+ICONS[s.id]+'<span>'+s.name+'</span></button>'
  }).join("");
  var sec = all.filter(function(s){return s.id===getTab()})[0], goals = home ? [] : getState()[getTab()], items = home ? todayItems() : [];
  var hd = items.filter(function(x){return checked(x.t)}).length, tt = home ? {d:hd, n:items.length, p:items.length?Math.round(hd/items.length*100):0} : totals(getTab());
  var dt = new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  var h = '<div id="banner" class="banner" role="status"'+(bannerHTML()?"":" hidden")+'>'+bannerHTML()+'</div><section class="card hero"><div><small>'+dt.toUpperCase()+'</small><h1>'+(home?"Hi, Ashley":sec.name)+'</h1><p>'+sec.line+'</p><div class="chips">'+SECTIONS.map(function(s){
    return '<span class="chip'+(s.id===getTab()?' on':'')+'">'+s.name+' · '+totals(s.id).p+'%</span>'
  }).join("")+(streak()?'<span class="chip on">'+streak()+'-day streak</span>':'')+'</div></div><div class="ringwrap">'+ring(tt.p)+'</div><div class="hfoot"><span class="lip">'+lipText()+'</span><button class="cta'+(getCheckins()[dayKey(0)]?' done':'')+'" data-ci="open">'+(getCheckins()[dayKey(0)]?'Edit check-in ✓':'Start check-in →')+'</button></div></section>';
  h += home ? '<div class="stats"><div class="card stat"><span>Due today</span><b>'+items.length+'</b></div><div class="card stat"><span>Done</span><b>'+hd+'</b></div><div class="card stat"><span>Progress</span><div class="bar"><i style="width:'+tt.p+'%"></i></div></div></div>'
    : '<div class="stats"><div class="card stat"><span>Active goals</span><b>'+goals.length+'</b></div><div class="card stat"><span>On track</span><b>'+tt.d+'/'+tt.n+'</b></div><div class="card stat"><span>Progress</span><div class="bar"><i style="width:'+tt.p+'%"></i></div></div></div>';
  if (home) h += homeHTML(items);
  else {
    h += '<div class="head"><h2>'+sec.name+' goals</h2><button class="btn" data-act="toggleadd">+ New goal</button></div>';
    if (adding) h += '<div class="card form"><input id="ng" placeholder="Goal name" maxlength="80"><input id="nt" placeholder="Tag (optional)" maxlength="24" style="max-width:170px"><input id="nd" type="date" aria-label="Deadline (optional)" style="max-width:170px"><button class="btn" data-act="addgoal">Add</button></div>';
    h += goals.length ? '<div class="grid">'+goals.map(goalCard).join("")+'</div>' : '<div class="card empty"><h3>Nothing here yet</h3><p>Tell me what you\'re working toward in '+sec.name.toLowerCase()+' and we\'ll fill this in together.</p><button class="btn" data-act="toggleadd">Add a goal</button></div>';
  }
  if (getTab() === "career") h += '<section class="card wins"><h3>Wins so far</h3><div class="chips">'+WINS.map(function(w){return '<span class="chip on">'+esc(w)+'</span>'}).join("")+'</div></section>';
  h += '<p class="theme"><span id="sync">'+syncText()+'</span> · <button class="lnk" data-act="theme">Light / dark</button> · <button class="lnk" data-ci="export">Export</button> · <button class="lnk" data-ci="import">Import</button>'+(store.mode==="cloud"?' · <button class="lnk" data-ci="signout">Sign out</button>':'')+'</p>';
  var m = document.getElementById("main"), y = window.scrollY;
  m.innerHTML = h;
  window.scrollTo(0, y);
}

// Set up save entry handler
setSaveEntryHandler(function(e) {
  if (e.type === "goal") {
    var list = getState()[e.section] || [], g = list.filter(function(x){return x.id===e.id})[0];
    return g ? store.saveGoal(e.section, g, list.indexOf(g)) : Promise.resolve()
  }
  if (e.type === "del") return store.deleteGoal(e.id);
  if (e.type === "log") {
    var on = (getLog()[e.step]||[]).indexOf(e.date) > -1;
    return store.saveCompletion(e.step, e.date, on)
  }
  return getCheckins()[e.day] ? store.saveCheckin(e.day, getCheckins()[e.day]) : Promise.resolve()
});

// Event handlers
document.addEventListener("click", function(e) {
  var b = e.target.closest("[data-tab],[data-act]");
  if (!b) return;
  if (b.dataset.tab) {
    setTab(b.dataset.tab);
    adding = false;
    setEditing(null);
    render();
    return
  }
  var a = b.dataset.act;
  if (a === "toggleadd") {
    adding = !adding;
    render();
    var f = document.getElementById("ng");
    if (f) f.focus()
  } else if (a === "addgoal") {
    var v = document.getElementById("ng").value.trim();
    if (!v) return;
    var ng = {id:newId(), title:v, tag:document.getElementById("nt").value.trim(), tasks:[]}, dv = document.getElementById("nd").value;
    if (dv) ng.deadline = dv;
    getState()[getTab()].push(ng);
    adding = false;
    persist(ng, getTab());
    render()
  } else if (a === "delgoal") {
    var did = b.dataset.g;
    var newState = {...getState()};
    newState[getTab()] = newState[getTab()].filter(function(g){return g.id!==did});
    setState(newState);
    clearDirty("g:"+did);
    mark("d:"+did, {type:"del", id:did});
    flush();
    render()
  } else if (a === "addtask") {
    var g = addTask(b.dataset.g);
    if (g) {
      persist(g, getTab());
      render();
      var n = document.querySelector('[data-newtask="'+b.dataset.g+'"]');
      if (n) n.focus()
    }
  } else if (a === "deltask") {
    var g = find(b.dataset.g);
    if (g) {
      g.tasks.splice(+b.dataset.i, 1);
      persist(g, getTab());
      render()
    }
  } else if (a === "skiptask") {
    var tid = b.dataset.t;
    SECTIONS.forEach(function(s){
      getState()[s.id].forEach(function(g){
        var t = g.tasks.filter(function(x){return x.id===tid})[0];
        if (t) {
          if (skippedToday(t)) delete t.skippedAt;
          else t.skippedAt = new Date().toISOString();
          persist(g, s.id);
          render()
        }
      })
    })
  } else if (a === "completegoal") {
    var g = find(b.dataset.g);
    if (g) {
      toggleGoalComplete(g);
      persist(g, getTab());
      triggerConfetti();
      render()
    }
  } else if (a === "uncompletegoal") {
    var g = find(b.dataset.g);
    if (g) {
      toggleGoalComplete(g);
      persist(g, getTab());
      render()
    }
  } else if (a === "togglecompleted") {
    var section = document.getElementById("completedSection");
    var btn = b;
    if (section) {
      var isHidden = section.style.display === "none";
      section.style.display = isHidden ? "block" : "none";
      btn.textContent = isHidden ? "Hide" : "Show";
      btn.setAttribute("aria-expanded", isHidden);
    }
  } else if (a === "editfq") {
    setEditing(getEditing() === b.dataset.t ? null : b.dataset.t);
    render()
  } else if (a === "theme") {
    var r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = dark ? "light" : "dark"
  }
});

document.addEventListener("change", function(e) {
  var c = e.target, d = c.dataset;
  if (c.type === "checkbox") {
    var result = toggleTask(d.s || getTab(), d.g, +d.i, c.checked);
    if (result) {
      if (result.type === "goal") persist(find(d.g), d.s || getTab());
      else mark("l:"+result.step+"|"+result.date, result);
      flush();
      if (result.autoCompleted) {
        triggerConfetti();
      }
      render()
    }
    return
  }
  if (d.fq) {
    var g = find(d.g), t = g.tasks[+d.i], f = Object.assign({}, fq(t));
    if (d.fq === "p") {
      f.p = c.value;
      if (f.p === "once" || f.p === "day") f.n = 1
    } else f.n = Math.max(1, Math.min(+c.max, Math.round(+c.value)||1));
    t.freq = f;
    persist(g, getTab());
    render();
    return
  }
  if (d.dl !== undefined) {
    var g2 = find(d.g);
    if (c.value) g2.deadline = c.value;
    else delete g2.deadline;
    persist(g2, getTab());
    render()
  }
});

document.addEventListener("keydown", function(e) {
  if (e.key !== "Enter") return;
  var t = e.target;
  if (t.dataset && t.dataset.newtask) {
    var g = addTask(t.dataset.newtask);
    if (g) {
      persist(g, getTab());
      render();
      var n = document.querySelector('[data-newtask="'+t.dataset.newtask+'"]');
      if (n) n.focus()
    }
  } else if (t.id === "ng" || t.id === "nt") {
    document.querySelector('[data-act="addgoal"]').click()
  }
});

// Check-in event handlers
document.addEventListener("click", function(e) {
  var b = e.target.closest("[data-ci]");
  if (!b) return;
  var a = b.dataset.ci, d = getCheckinState().data, v = b.dataset.v;
  if (a === "open") {
    var p = getCheckins()[dayKey(0)];
    setCheckinState({open:true, step:0, data:p ? JSON.parse(JSON.stringify(p)) : {water:0}});
    layer()
  } else if (a === "close") {
    setCheckinState({...getCheckinState(), open:false});
    layer()
  } else if (a === "signout") {
    if (hasDirty() && !confirm("You have unsaved changes. Sign out anyway?")) return;
    store.signOut().catch(fail)
  } else if (a === "retry") {
    flush()
  } else if (a === "magic") {
    var em = document.getElementById("em").value.trim();
    if (!em) return;
    store.signIn(em).then(function(r){
      showSignIn(r.error ? r.error.message : "Check your email for the link.")
    }, function(e){showSignIn(e.message)})
  } else if (a === "import") {
    document.getElementById("imp").click()
  } else if (a === "export") {
    store.exportData().then(function(d){
      var x = document.createElement("a");
      x.href = URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}));
      x.download = "life-dashboard-"+dayKey(0)+".json";
      x.click()
    }).catch(fail)
  } else if (a === "set") {
    var k = b.dataset.k;
    d[k] = isNaN(+v) ? v : +v;
    layer();
    if (k === "sleep" || k === "move") setTimeout(function(){
      if (getCheckinState().open && getCheckinState().step < ciSteps().length-1) {
        setCheckinState({...getCheckinState(), step:getCheckinState().step+1});
        layer()
      }
    }, 220)
  } else if (a === "tag") {
    toggle(d.tags || (d.tags = []), v);
    layer()
  } else if (a === "goal") {
    toggle(d.goals || (d.goals = []), v);
    layer()
  } else if (a === "water") {
    d.water = Math.max(0, Math.min(20, (d.water||0) + (+v)));
    layer()
  } else if (a === "prev") {
    grab();
    setCheckinState({...getCheckinState(), step:Math.max(0, getCheckinState().step-1)});
    layer()
  } else if (a === "next") {
    grab();
    if (b.dataset.skip) delete d[ciSteps()[getCheckinState().step]];
    if (getCheckinState().step >= ciSteps().length-1) finish();
    else {
      setCheckinState({...getCheckinState(), step:getCheckinState().step+1});
      layer()
    }
  }
});

document.addEventListener("keydown", function(e) {
  if (!getCheckinState().open) return;
  if (e.key === "Escape") {
    setCheckinState({...getCheckinState(), open:false});
    layer()
  } else if (e.key === "Enter" && e.target.id === "ciGrat") {
    grab();
    finish()
  }
});

export function showSignIn(msg) {
  document.getElementById("main").innerHTML = "";
  document.getElementById("layer").innerHTML = '<div class="overlay"><div class="sheet"><h2>Sign in</h2><div class="sub">'+esc(msg||"We'll email you a magic link. No password.")+'</div><input id="em" type="email" class="field" placeholder="you@email.com" autocomplete="email"><button class="cta" data-ci="magic">Send magic link</button></div></div>'
}

export function group(rows) {
  var o = {career:[], personal:[], family:[]};
  rows.forEach(function(r){if (o[r.section]) o[r.section].push(r)});
  return o
}

export async function load() {
  var rows = await store.loadGoals(), seeded = await store.isSeeded();
  if (!seeded && !rows.length) {
    setState(JSON.parse(JSON.stringify(SEED)));
    var state = getState();
    Object.keys(state).forEach(function(k){
      state[k].forEach(function(g){
        g.id = newId();
        g.tasks.forEach(function(t){t.id = newId()})
      })
    });
    for (var s in state) for (var i = 0; i < state[s].length; i++) await store.saveGoal(s, state[s][i], i);
    await store.markSeeded()
  } else setState(group(rows));
  setCheckins(await store.loadCheckins());
  setLog(await store.loadLog());
  var state = getState();
  Object.keys(state).forEach(function(sk){
    state[sk].forEach(function(g){
      var ch = false;
      g.tasks.forEach(function(t){if (!t.id) {t.id = newId(); ch = true}});
      if (ch) persist(g, sk)
    })
  });
}

export function setRenderCallback(callback) {
  window.renderCallback = callback
}
