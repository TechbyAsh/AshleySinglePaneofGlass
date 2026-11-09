// Home module: today view, deadline tracking, weekly summary
import { esc } from "./utils.js";
import { dueToday, checked, prog, fLabel, daysLeft, dlLabel } from "./scheduling.js";
import { getState } from "./goals.js";
import { weekCard } from "./checkin.js";

const SECTIONS = [
  {id:"career",name:"Career",line:"Cyber, identity, and the dessert bar — all moving forward."},
  {id:"personal",name:"Personal",line:"A space just for you."},
  {id:"family",name:"Family",line:"The people you're building all of this for."}
];

export function secName(id) {
  return SECTIONS.filter(function(s){return s.id===id})[0].name
}

export function todayItems() {
  var out = [];
  var state = getState();
  SECTIONS.forEach(function(s){
    state[s.id].forEach(function(g){
      g.tasks.forEach(function(t,i){
        if (dueToday(t)) out.push({s:s.id, g:g, t:t, i:i})
      })
    })
  });
  return out
}

export function urg(a, b) {
  var x = a.g.deadline || "9999", y = b.g.deadline || "9999";
  return x < y ? -1 : x > y ? 1 : 0
}

export function trow(x) {
  var t = x.t, id = "h"+t.id, c = checked(t), p = prog(t);
  return '<li class="'+(c?'done':'')+'"><input type="checkbox" id="'+id+'" data-s="'+x.s+'" data-g="'+esc(x.g.id)+'" data-i="'+x.i+'"'+(c?' checked':'')+'><label for="'+id+'">'+esc(t.t)+'<small class="sub2">'+esc(x.g.title)+' · '+secName(x.s)+(p?' · '+p:'')+'</small></label><span class="fqchip">'+fLabel(t)+'</span><button class="x" data-act="skiptask" data-t="'+esc(t.id)+'" aria-label="Skip for today">×</button></li>'
}

export function homeHTML(items) {
  var open = items.filter(function(x){return !checked(x.t)}).sort(urg), done = items.filter(function(x){return checked(x.t)});
  var h = '<div class="head"><h2>Today</h2></div>';
  h += items.length ? '<div class="card tlist"><ul>'+open.concat(done).map(trow).join("")+'</ul></div>' : '<div class="card empty"><h3>Nothing due today</h3><p>Add tasks to your goals, then tap the label next to a task to choose how often it repeats. They\'ll show up here.</p></div>';
  var dg = [];
  var state = getState();
  SECTIONS.forEach(function(s){
    state[s.id].forEach(function(g){
      if (g.deadline) dg.push({s:s.id, g:g})
    })
  });
  dg.sort(function(a,b){return a.g.deadline < b.g.deadline ? -1 : 1});
  h += '<div class="head"><h2>Deadlines</h2></div><div class="card tlist">'+(dg.length ? '<ul>'+dg.slice(0,6).map(function(x){
    return '<li><label style="cursor:default">'+esc(x.g.title)+'<small class="sub2">'+secName(x.s)+'</small></label><span class="fqchip'+(daysLeft(x.g.deadline)<0?' over':'')+'">'+dlLabel(x.g.deadline)+'</span></li>'
  }).join("")+'</ul>' : '<p class="sub2" style="padding:12px 0;margin:0">Set a deadline on any goal and it will show up here.</p>')+'</div>';
  return h + '<div class="head"><h2>Check-ins</h2></div>' + weekCard()
}
