// Check-in module: daily check-in feature, mood/sleep/water tracking
import { esc, dayKey } from "./utils.js";
import { mark, flush } from "./engine.js";
import { getState } from "./goals.js";

let CK = {};
let CI = {open:false, step:0, data:{}};
const MOODS = [["😄",5],["🙂",4],["😐",3],["😔",2],["😣",1]];
const TAGS = ["Work","Family","Sleep","Money","Health","Time"];

export function setCheckins(checkins) {
  CK = checkins
}

export function getCheckins() {
  return CK
}

export function setCheckinState(state) {
  CI = state
}

export function getCheckinState() {
  return CI
}

export function streak() {
  var n = 0, o = CK[dayKey(0)] ? 0 : -1;
  while (CK[dayKey(o)]) { n++; o-- }
  return n
}

export function lipText() {
  return CK[dayKey(0)] ? "Check-in done. " + streak() + "-day streak." : (new Date().getHours() >= 18 ? "It's past 6. Time for your check-in." : "Check-in reminder at 6pm.")
}

export function weekCard() {
  var days = [];
  for (var i = -6; i <= 0; i++) {
    var k = dayKey(i), c = CK[k], m = c && MOODS.filter(function(x){return x[1]===c.mood})[0];
    days.push('<div class="wd"><span>'+new Date(k+"T12:00").toLocaleDateString("en-US",{weekday:"narrow"})+'</span><b>'+(m?m[0]:"·")+'</b></div>')
  }
  var g = Object.keys(CK).filter(function(k){return CK[k].gratitude}).sort().pop();
  return '<section class="card week"><h3>This week</h3><div class="wrow">'+days.join("")+'</div><p class="grat">'+(g?"Grateful for: "+esc(CK[g].gratitude):"Your check-in ends with one thing you're grateful for.")+'</p></section>'
}

export function ciSteps() {
  return ["mood","sleep","water","move","goals","gratitude"]
}

export function opts(k, arr, sel, suf) {
  return '<div class="opts">'+arr.map(function(v){
    return '<button class="opt" data-ci="set" data-k="'+k+'" data-v="'+esc(v)+'" aria-pressed="'+(sel===v)+'">'+esc(v)+(suf||"")+'</button>'
  }).join("")+'</div>'
}

export function ciHTML() {
  var st = ciSteps(), k = st[CI.step], d = CI.data, last = CI.step === st.length-1, all = [];
  var state = getState();
  Object.keys(state).forEach(function(sec){
    state[sec].forEach(function(g){all.push(g)})
  });
  var Q = {
    mood:["How are you feeling today?",'<div class="emojis">'+MOODS.map(function(m){
      return '<button class="emoji" data-ci="set" data-k="mood" data-v="'+m[1]+'" aria-pressed="'+(d.mood===m[1])+'" aria-label="Mood '+m[1]+' of 5">'+m[0]+'</button>'
    }).join("")+'</div><div class="sub">Anything shaping it? Tap all that fit.</div><div class="opts">'+TAGS.map(function(t){
      return '<button class="opt" data-ci="tag" data-v="'+t+'" aria-pressed="'+((d.tags||[]).indexOf(t)>-1)+'">'+t+'</button>'
    }).join("")+'</div>'],
    sleep:["How long did you sleep last night?",opts("sleep",[4,5,6,6.5,7,7.5,8,9,10],d.sleep," hrs")],
    water:["How much water today?",'<div class="counter"><button class="round" data-ci="water" data-v="-1" aria-label="One less">−</button><b>'+(d.water||0)+'</b><button class="round" data-ci="water" data-v="1" aria-label="One more">+</button></div><div class="sub">Glasses (8 oz each)</div>'],
    move:["Did you move today?",opts("move",["None","Walk","Strength","Cardio","Yoga","Other"],d.move)],
    goals:["Which goals moved forward today?",all.length?'<div class="opts">'+all.map(function(g){
      return '<button class="opt" data-ci="goal" data-v="'+g.id+'" aria-pressed="'+((d.goals||[]).indexOf(g.id)>-1)+'">'+esc(g.title)+'</button>'
    }).join("")+'</div>':'<div class="sub">No goals yet. Add some and they\'ll show up here.</div>'],
    gratitude:["One thing you're grateful for",'<input id="ciGrat" class="field" maxlength="200" placeholder="Today I\'m grateful for…" autocomplete="off" value="'+esc(d.gratitude||"")+'">']
  }, q = Q[k];
  return '<div class="overlay" role="dialog" aria-modal="true" aria-label="Daily check-in"><div class="sheet"><div class="row"><span class="eyebrow">Check-in · '+new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})+'</span><button class="x" data-ci="close" aria-label="Close check-in">×</button></div><div class="dots">'+st.map(function(_,i){
    return '<i class="'+(i<=CI.step?"on":"")+'"></i>'
  }).join("")+'</div><h2>'+q[0]+'</h2>'+q[1]+'<div class="row"><button class="ghost" data-ci="prev"'+(CI.step?"":" disabled")+'>Back</button><div class="row"><button class="opt" data-ci="next" data-skip="1">Skip</button><button class="cta" data-ci="next">'+(last?"Finish":"Next")+'</button></div></div></div></div>'
}

export function layer() {
  document.getElementById("layer").innerHTML = CI.open ? ciHTML() : "";
  var g = document.getElementById("ciGrat");
  if (g) g.focus()
}

export function grab() {
  var g = document.getElementById("ciGrat");
  if (g) CI.data.gratitude = g.value.trim()
}

export function finish() {
  CK[dayKey(0)] = Object.assign({}, CI.data, {savedAt:new Date().toISOString()});
  mark("c:"+dayKey(0), {type:"checkin", day:dayKey(0)});
  flush();
  CI.open = false;
  layer();
  // Trigger re-render via callback
  if (window.renderCallback) window.renderCallback()
}

export function toggle(arr, v) {
  var i = arr.indexOf(v);
  if (i > -1) arr.splice(i, 1);
  else arr.push(v)
}
