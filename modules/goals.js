// Goals module: goal/task CRUD operations and goal card rendering
import { esc, newId, dayKey } from "./utils.js";
import { fq, checked, prog, fLabel, daysLeft, dlLabel, quotaMet, getLog } from "./scheduling.js";
import { isFailed } from "./engine.js";

let state = {career:[], personal:[], family:[]};
let tab = "home";
let editing = null;

export function setState(newState) {
  state = newState
}

export function getState() {
  return state
}

export function setTab(newTab) {
  tab = newTab
}

export function getTab() {
  return tab
}

export function setEditing(editingId) {
  editing = editingId
}

export function getEditing() {
  return editing
}

export function find(id) {
  return state[tab].filter(function(g){return g.id===id})[0]
}

export function addTask(id) {
  var inp = document.querySelector('[data-newtask="'+id+'"]');
  var v = inp && inp.value.trim();
  if (!v) return;
  var g = find(id);
  g.tasks.push({id:newId(), t:v, d:false, freq:{p:"once", n:1}});
  return g
}

export function toggleTask(sec, gid, i, on) {
  var g = (state[sec]||[]).filter(function(x){return x.id===gid})[0];
  if (!g) return;
  var t = g.tasks[i];
  var LOG = getLog();
  var result;
  if (fq(t).p === "once") {
    t.d = on;
    if (on) t.doneAt = new Date().toISOString();
    else delete t.doneAt;
    result = {type:"goal", section:sec, id:g.id}
  } else {
    var k = dayKey(0), a = LOG[t.id] || (LOG[t.id] = []), ix = a.indexOf(k);
    if (on && ix < 0) a.push(k);
    if (!on && ix > -1) a.splice(ix, 1);
    result = {type:"log", step:t.id, date:k}
  }
  // Check for auto-completion
  var autoCompleted = checkAutoComplete(g);
  if (autoCompleted) {
    result.autoCompleted = true;
    result.goalId = g.id;
  }
  return result
}

export function pct(g) {
  return g.tasks.length ? Math.round(g.tasks.filter(quotaMet).length/g.tasks.length*100) : 0
}

export function isGoalComplete(g) {
  return !!g.completed
}

export function toggleGoalComplete(g) {
  if (g.completed) {
    delete g.completed;
    delete g.completedAt;
  } else {
    g.completed = true;
    g.completedAt = new Date().toISOString();
  }
  return g
}

export function checkAutoComplete(g) {
  if (g.completed) return false;
  if (g.tasks.length === 0) return false;
  var allDone = g.tasks.every(function(t) { return quotaMet(t); });
  if (allDone) {
    g.completed = true;
    g.completedAt = new Date().toISOString();
    return true;
  }
  return false;
}

export function totals(id) {
  var n = 0, d = 0;
  state[id].forEach(function(g){
    n += g.tasks.length;
    d += g.tasks.filter(quotaMet).length
  });
  return {n:n, d:d, p:n ? Math.round(d/n*100) : 0}
}

export function fqEditor(g, i, t) {
  var f = fq(t), a = ' data-g="'+esc(g.id)+'" data-i="'+i+'"';
  return '<select data-fq="p"'+a+' aria-label="How often">'+[["once","One-time"],["day","Every day"],["week","Weekly"],["month","Monthly"]].map(function(o){
    return '<option value="'+o[0]+'"'+(f.p===o[0]?' selected':'')+'>'+o[1]+'</option>'
  }).join("")+'</select>'+(f.p==="week"||f.p==="month"?'<span>× <input type="number" data-fq="n" min="1" max="'+(f.p==="week"?21:31)+'" value="'+f.n+'"'+a+' aria-label="Times per '+f.p+'"> per '+f.p+'</span>':'')
}

export function goalCard(g) {
  var isComplete = isGoalComplete(g);
  return '<article class="card goal'+(isFailed("g:"+g.id)?' is-unsaved':'')+(isComplete?' completed':'')+'" data-gid="'+esc(g.id)+'"><div class="gtop"><div><span class="tag">'+esc(g.tag||"Goal")+'</span><span class="ub">Unsaved</span><h3>'+(isComplete?'✓ ':'')+esc(g.title)+'</h3></div><div class="goal-actions"><button class="complete-btn" data-act="'+(isComplete?'uncompletegoal':'completegoal')+'" data-g="'+esc(g.id)+'" aria-label="'+(isComplete?'Mark incomplete':'Mark complete')+'">'+(isComplete?'↩':'✓')+'</button><button class="x" data-act="delgoal" data-g="'+esc(g.id)+'" aria-label="Delete goal">×</button></div></div>'+
  '<div class="bar"><i style="width:'+pct(g)+'%"></i></div><div class="pct">'+pct(g)+'% on track'+(isComplete?' · Completed '+new Date(g.completedAt).toLocaleDateString():"")+'</div>'+
  '<div class="dl"><label>Deadline <input type="date" data-dl="1" data-g="'+esc(g.id)+'" value="'+esc(g.deadline||"")+'"'+(isComplete?' disabled':'')+'></label>'+(g.deadline?'<span class="fqchip'+(daysLeft(g.deadline)<0?' over':'')+'">'+dlLabel(g.deadline)+'</span>':'')+'</div><ul>'+
  g.tasks.map(function(t,i){
    var id = g.id+"-"+i, c = checked(t), p = prog(t);
    var li = '<li class="'+(c?'done':'')+'"><input type="checkbox" id="'+id+'" data-g="'+esc(g.id)+'" data-i="'+i+'"'+(c?' checked':'')+(isComplete?' disabled':'')+'><label for="'+id+'">'+esc(t.t)+(p?'<small class="sub2">'+p+'</small>':'')+'</label><button class="fqchip" data-act="editfq" data-t="'+esc(t.id)+'" aria-label="Change how often"'+(isComplete?' disabled':'')+'>'+fLabel(t)+'</button><button class="x" data-act="deltask" data-g="'+esc(g.id)+'" data-i="'+i+'" data-t="'+esc(t.id)+'" aria-label="Delete task"'+(isComplete?' disabled':'')+'>×</button></li>';
    if (editing === t.id && !isComplete) li += '<li class="fqrow">'+fqEditor(g,i,t)+'</li>';
    return li
  }).join("")+
  '</ul>'+(isComplete?'':'<div class="add"><input data-newtask="'+esc(g.id)+'" placeholder="Add a task" maxlength="100"><button data-act="addtask" data-g="'+esc(g.id)+'" aria-label="Add task">+</button></div>')+'</article>'
}
