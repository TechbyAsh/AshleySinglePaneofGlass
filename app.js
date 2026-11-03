import { store } from "./storage.js";
var ICONS={
  home:'<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/></svg>',
  career:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
  personal:'<svg viewBox="0 0 24 24"><path d="M12 3l2.2 5.3L20 9l-4.3 3.9L17 19l-5-3-5 3 1.3-6.1L4 9l5.8-.7z"/></svg>',
  family:'<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'
};
var SECTIONS=[
  {id:"career",name:"Career",line:"Cyber, identity, and the dessert bar — all moving forward."},
  {id:"personal",name:"Personal",line:"A space just for you."},
  {id:"family",name:"Family",line:"The people you’re building all of this for."}
];
var HOME={id:"home",name:"Home",line:"Everything due today, pulled from all your goals."};
function T(a){return a.map(function(t){return {t:t[0],d:!!t[1]}})}
var SEED={
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
var WINS=["CompTIA CySA+","CompTIA Security+","Per Scholas Cybersecurity Analyst","Forage: AIG Shields Up","Forage: Deloitte Cyber Simulation"];
var state={career:[],personal:[],family:[]},tab="home",adding=false,editing=null,LOG={};
/*ENGINE*/
// Unsaved-changes tracker: every write is marked dirty, saved, and cleared only if
// nothing newer was marked meanwhile. Failures keep the entry, flag it, and retry
// with backoff (2s, 4s... max 30s). "Retry now", coming back online, and returning
// to the tab also trigger a retry. Each retry saves the CURRENT state, never a stale copy.
var dirty={},flushing=false,rerun=false,retryTimer=null,retryN=0,notice="";
function newId(){return crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16)})}
function failedCount(){return Object.keys(dirty).filter(function(k){return dirty[k].failed}).length}
function isFailed(k){return !!(dirty[k]&&dirty[k].failed)}
function syncText(){var n=failedCount();return n?n+" unsaved":store.mode==="cloud"?"Synced to your account":"Saved on this device only"}
function bannerHTML(){var n=failedCount();if(n)return '<span>'+n+' unsaved change'+(n>1?'s':'')+'. '+(flushing?'Retrying…':'Will retry automatically.')+'</span><button class="btn" data-ci="retry">Retry now</button>';return notice?'<span>'+esc(notice)+'</span>':''}
function syncUI(){
  var s=document.getElementById("sync");if(s)s.textContent=syncText();
  var b=document.getElementById("banner");if(b){var h=bannerHTML();b.innerHTML=h;b.hidden=!h}
  document.querySelectorAll("[data-gid]").forEach(function(c){c.classList.toggle("is-unsaved",isFailed("g:"+c.dataset.gid))});
}
function setSync(){syncUI()}
function fail(e){console.error(e);notice=(e&&e.message)||"Something went wrong";syncUI();setTimeout(function(){notice="";syncUI()},6000)}
function mark(k,e){var d=dirty[k];e.v=(d?d.v:0)+1;e.failed=d?d.failed:false;dirty[k]=e}
function persist(g,sec){mark("g:"+g.id,{type:"goal",section:sec||tab,id:g.id});return flush()}
function saveEntry(e){
  if(e.type==="goal"){var list=state[e.section]||[],g=list.filter(function(x){return x.id===e.id})[0];return g?store.saveGoal(e.section,g,list.indexOf(g)):Promise.resolve()}
  if(e.type==="del")return store.deleteGoal(e.id);
  if(e.type==="log"){var on=(LOG[e.step]||[]).indexOf(e.date)>-1;return store.saveCompletion(e.step,e.date,on)}
  return CK[e.day]?store.saveCheckin(e.day,CK[e.day]):Promise.resolve();
}
async function flush(){
  if(flushing){rerun=true;return}
  flushing=true;clearTimeout(retryTimer);
  if(failedCount())syncUI();
  var failed=false;
  do{
    rerun=false;
    var keys=Object.keys(dirty);
    for(var i=0;i<keys.length;i++){
      var k=keys[i],e=dirty[k];if(!e)continue;var v=e.v;
      try{await saveEntry(e);if(dirty[k]&&dirty[k].v===v)delete dirty[k]}
      catch(err){console.error(err);failed=true;if(dirty[k])dirty[k].failed=true}
    }
  }while(rerun);
  flushing=false;
  if(failed&&Object.keys(dirty).length){retryN++;retryTimer=setTimeout(flush,Math.min(30000,1000*Math.pow(2,retryN)))}else retryN=0;
  syncUI();
}
/*END*/
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
/*SCHED*/
// How a to-do repeats: freq = {p:"once"|"day"|"week"|"month", n:times per period}.
// Completions of repeating to-dos live in LOG[stepId] = ["YYYY-MM-DD", ...] (plan_items rows).
// Weeks start Monday. "Weekly x3" stays on Today until it has been done 3 times this week.
function fq(t){return t.freq||{p:"once",n:1}}
function lday(iso){var d=new Date(iso);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function pstart(p){var o=0,n=new Date();if(p==="week")o=-((n.getDay()+6)%7);else if(p==="month")o=1-n.getDate();return dayKey(o)}
function cnt(t,p){var s=pstart(p),e=dayKey(0);return (LOG[t.id]||[]).filter(function(x){return x>=s&&x<=e}).length}
function doneToday(t){return (LOG[t.id]||[]).indexOf(dayKey(0))>-1}
function onceToday(t){return !!(t.d&&t.doneAt&&lday(t.doneAt)===dayKey(0))}
function checked(t){return fq(t).p==="once"?!!t.d:doneToday(t)}
function quotaMet(t){var f=fq(t);return f.p==="once"?!!t.d:f.p==="day"?doneToday(t):cnt(t,f.p)>=f.n}
function dueToday(t){var f=fq(t);if(f.p==="once")return !t.d||onceToday(t);if(f.p==="day")return true;return cnt(t,f.p)<f.n||doneToday(t)}
function fLabel(t){var f=fq(t);if(f.p==="once")return "One-time";if(f.p==="day")return "Daily";if(f.n>1)return f.n+"×/"+(f.p==="week"?"wk":"mo");return f.p==="week"?"Weekly":"Monthly"}
function prog(t){var f=fq(t);return f.p==="week"||f.p==="month"?Math.min(cnt(t,f.p),f.n)+"/"+f.n+" this "+f.p:""}
function daysLeft(d){return Math.round((new Date(d+"T12:00")-new Date(dayKey(0)+"T12:00"))/864e5)}
function dlLabel(d){var n=daysLeft(d),s=new Date(d+"T12:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});return n<0?"Overdue by "+(-n)+(n===-1?" day":" days"):n===0?"Due today":"Due "+s+" · "+n+(n===1?" day":" days")+" left"}
/*ENDSCHED*/
function pct(g){return g.tasks.length?Math.round(g.tasks.filter(quotaMet).length/g.tasks.length*100):0}
function totals(id){var n=0,d=0;state[id].forEach(function(g){n+=g.tasks.length;d+=g.tasks.filter(quotaMet).length});return {n:n,d:d,p:n?Math.round(d/n*100):0}}
function toggleTask(sec,gid,i,on){
  var g=(state[sec]||[]).filter(function(x){return x.id===gid})[0];if(!g)return;var t=g.tasks[i];
  if(fq(t).p==="once"){t.d=on;if(on)t.doneAt=new Date().toISOString();else delete t.doneAt;persist(g,sec)}
  else{var k=dayKey(0),a=LOG[t.id]||(LOG[t.id]=[]),ix=a.indexOf(k);if(on&&ix<0)a.push(k);if(!on&&ix>-1)a.splice(ix,1);mark("l:"+t.id+"|"+k,{type:"log",step:t.id,date:k});flush()}
}
function ring(p){var r=44,c=2*Math.PI*r;return '<div class="ring"><svg viewBox="0 0 104 104"><circle cx="52" cy="52" r="'+r+'" fill="none" stroke="var(--sunk)" stroke-width="10"/><circle cx="52" cy="52" r="'+r+'" fill="none" stroke="var(--rose)" stroke-width="10" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+(c*(1-p/100))+'"/></svg><b>'+p+'%</b></div>'}
function secName(id){return SECTIONS.filter(function(s){return s.id===id})[0].name}
function todayItems(){var out=[];SECTIONS.forEach(function(s){state[s.id].forEach(function(g){g.tasks.forEach(function(t,i){if(dueToday(t))out.push({s:s.id,g:g,t:t,i:i})})})});return out}
function urg(a,b){var x=a.g.deadline||"9999",y=b.g.deadline||"9999";return x<y?-1:x>y?1:0}
function trow(x){var t=x.t,id="h"+t.id,c=checked(t),p=prog(t);return '<li class="'+(c?'done':'')+'"><input type="checkbox" id="'+id+'" data-s="'+x.s+'" data-g="'+esc(x.g.id)+'" data-i="'+x.i+'"'+(c?' checked':'')+'><label for="'+id+'">'+esc(t.t)+'<small class="sub2">'+esc(x.g.title)+' · '+secName(x.s)+(p?' · '+p:'')+'</small></label><span class="fqchip">'+fLabel(t)+'</span></li>'}
function homeHTML(items){
  var open=items.filter(function(x){return !checked(x.t)}).sort(urg),done=items.filter(function(x){return checked(x.t)});
  var h='<div class="head"><h2>Today</h2></div>';
  h+=items.length?'<div class="card tlist"><ul>'+open.concat(done).map(trow).join("")+'</ul></div>':'<div class="card empty"><h3>Nothing due today</h3><p>Add tasks to your goals, then tap the label next to a task to choose how often it repeats. They’ll show up here.</p></div>';
  var dg=[];SECTIONS.forEach(function(s){state[s.id].forEach(function(g){if(g.deadline)dg.push({s:s.id,g:g})})});
  dg.sort(function(a,b){return a.g.deadline<b.g.deadline?-1:1});
  h+='<div class="head"><h2>Deadlines</h2></div><div class="card tlist">'+(dg.length?'<ul>'+dg.slice(0,6).map(function(x){return '<li><label style="cursor:default">'+esc(x.g.title)+'<small class="sub2">'+secName(x.s)+'</small></label><span class="fqchip'+(daysLeft(x.g.deadline)<0?' over':'')+'">'+dlLabel(x.g.deadline)+'</span></li>'}).join("")+'</ul>':'<p class="sub2" style="padding:12px 0;margin:0">Set a deadline on any goal and it will show up here.</p>')+'</div>';
  return h+'<div class="head"><h2>Check-ins</h2></div>'+weekCard();
}
function fqEditor(g,i,t){
  var f=fq(t),a=' data-g="'+esc(g.id)+'" data-i="'+i+'"';
  return '<select data-fq="p"'+a+' aria-label="How often">'+[["once","One-time"],["day","Every day"],["week","Weekly"],["month","Monthly"]].map(function(o){return '<option value="'+o[0]+'"'+(f.p===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join("")+'</select>'+(f.p==="week"||f.p==="month"?'<span>× <input type="number" data-fq="n" min="1" max="'+(f.p==="week"?21:31)+'" value="'+f.n+'"'+a+' aria-label="Times per '+f.p+'"> per '+f.p+'</span>':'');
}
function goalCard(g){
  return '<article class="card goal'+(isFailed("g:"+g.id)?' is-unsaved':'')+'" data-gid="'+esc(g.id)+'"><div class="gtop"><div><span class="tag">'+esc(g.tag||"Goal")+'</span><span class="ub">Unsaved</span><h3>'+esc(g.title)+'</h3></div><button class="x" data-act="delgoal" data-g="'+esc(g.id)+'" aria-label="Delete goal">×</button></div>'+
  '<div class="bar"><i style="width:'+pct(g)+'%"></i></div><div class="pct">'+pct(g)+'% on track</div>'+
  '<div class="dl"><label>Deadline <input type="date" data-dl="1" data-g="'+esc(g.id)+'" value="'+esc(g.deadline||"")+'"></label>'+(g.deadline?'<span class="fqchip'+(daysLeft(g.deadline)<0?' over':'')+'">'+dlLabel(g.deadline)+'</span>':'')+'</div><ul>'+
  g.tasks.map(function(t,i){
    var id=g.id+"-"+i,c=checked(t),p=prog(t);
    var li='<li class="'+(c?'done':'')+'"><input type="checkbox" id="'+id+'" data-g="'+esc(g.id)+'" data-i="'+i+'"'+(c?' checked':'')+'><label for="'+id+'">'+esc(t.t)+(p?'<small class="sub2">'+p+'</small>':'')+'</label><button class="fqchip" data-act="editfq" data-t="'+esc(t.id)+'" aria-label="Change how often">'+fLabel(t)+'</button></li>';
    if(editing===t.id)li+='<li class="fqrow">'+fqEditor(g,i,t)+'</li>';
    return li}).join("")+
  '</ul><div class="add"><input data-newtask="'+esc(g.id)+'" placeholder="Add a task" maxlength="100"><button data-act="addtask" data-g="'+esc(g.id)+'" aria-label="Add task">+</button></div></article>';
}
function render(){
  var home=tab==="home",all=[HOME].concat(SECTIONS);
  document.getElementById("rail").innerHTML='<div class="logo">A</div>'+all.map(function(s){return '<button class="tab" role="tab" aria-selected="'+(s.id===tab)+'" data-tab="'+s.id+'">'+ICONS[s.id]+'<span>'+s.name+'</span></button>'}).join("");
  var sec=all.filter(function(s){return s.id===tab})[0],goals=home?[]:state[tab],items=home?todayItems():[];
  var hd=items.filter(function(x){return checked(x.t)}).length,tt=home?{d:hd,n:items.length,p:items.length?Math.round(hd/items.length*100):0}:totals(tab);
  var dt=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  var h='<div id="banner" class="banner" role="status"'+(bannerHTML()?'':' hidden')+'>'+bannerHTML()+'</div><section class="card hero"><div><small>'+dt.toUpperCase()+'</small><h1>'+(home?"Hi, Ashley":sec.name)+'</h1><p>'+sec.line+'</p><div class="chips">'+SECTIONS.map(function(s){return '<span class="chip'+(s.id===tab?' on':'')+'">'+s.name+' · '+totals(s.id).p+'%</span>'}).join("")+(streak()?'<span class="chip on">'+streak()+'-day streak</span>':'')+'</div></div><div class="ringwrap">'+ring(tt.p)+'</div><div class="hfoot"><span class="lip">'+lipText()+'</span><button class="cta'+(CK[dayKey(0)]?' done':'')+'" data-ci="open">'+(CK[dayKey(0)]?'Edit check-in ✓':'Start check-in →')+'</button></div></section>';
  h+=home?'<div class="stats"><div class="card stat"><span>Due today</span><b>'+items.length+'</b></div><div class="card stat"><span>Done</span><b>'+hd+'</b></div><div class="card stat"><span>Progress</span><div class="bar"><i style="width:'+tt.p+'%"></i></div></div></div>'
    :'<div class="stats"><div class="card stat"><span>Active goals</span><b>'+goals.length+'</b></div><div class="card stat"><span>On track</span><b>'+tt.d+'/'+tt.n+'</b></div><div class="card stat"><span>Progress</span><div class="bar"><i style="width:'+tt.p+'%"></i></div></div></div>';
  if(home)h+=homeHTML(items);
  else{
    h+='<div class="head"><h2>'+sec.name+' goals</h2><button class="btn" data-act="toggleadd">+ New goal</button></div>';
    if(adding)h+='<div class="card form"><input id="ng" placeholder="Goal name" maxlength="80"><input id="nt" placeholder="Tag (optional)" maxlength="24" style="max-width:170px"><input id="nd" type="date" aria-label="Deadline (optional)" style="max-width:170px"><button class="btn" data-act="addgoal">Add</button></div>';
    h+=goals.length?'<div class="grid">'+goals.map(goalCard).join("")+'</div>':'<div class="card empty"><h3>Nothing here yet</h3><p>Tell me what you’re working toward in '+sec.name.toLowerCase()+' and we’ll fill this in together.</p><button class="btn" data-act="toggleadd">Add a goal</button></div>';
  }
  if(tab==="career")h+='<section class="card wins"><h3>Wins so far</h3><div class="chips">'+WINS.map(function(w){return '<span class="chip on">'+esc(w)+'</span>'}).join("")+'</div></section>';
  h+='<p class="theme"><span id="sync">'+syncText()+'</span> · <button class="lnk" data-act="theme">Light / dark</button> · <button class="lnk" data-ci="export">Export</button> · <button class="lnk" data-ci="import">Import</button>'+(store.mode==="cloud"?' · <button class="lnk" data-ci="signout">Sign out</button>':'')+'</p>';
  var m=document.getElementById("main"),y=window.scrollY;m.innerHTML=h;window.scrollTo(0,y);
}
function find(id){return state[tab].filter(function(g){return g.id===id})[0]}
function addTask(id){var inp=document.querySelector('[data-newtask="'+id+'"]');var v=inp&&inp.value.trim();if(!v)return;var g=find(id);g.tasks.push({id:newId(),t:v,d:false,freq:{p:"once",n:1}});persist(g);render();var n=document.querySelector('[data-newtask="'+id+'"]');if(n)n.focus()}
document.addEventListener("click",function(e){
  var b=e.target.closest("[data-tab],[data-act]");if(!b)return;
  if(b.dataset.tab){tab=b.dataset.tab;adding=false;editing=null;render();return}
  var a=b.dataset.act;
  if(a==="toggleadd"){adding=!adding;render();var f=document.getElementById("ng");if(f)f.focus()}
  else if(a==="addgoal"){var v=document.getElementById("ng").value.trim();if(!v)return;var ng={id:newId(),title:v,tag:document.getElementById("nt").value.trim(),tasks:[]},dv=document.getElementById("nd").value;if(dv)ng.deadline=dv;state[tab].push(ng);adding=false;persist(ng);render()}
  else if(a==="delgoal"){var did=b.dataset.g;state[tab]=state[tab].filter(function(g){return g.id!==did});delete dirty["g:"+did];mark("d:"+did,{type:"del",id:did});flush();render()}
  else if(a==="addtask"){addTask(b.dataset.g)}
  else if(a==="editfq"){editing=editing===b.dataset.t?null:b.dataset.t;render()}
  else if(a==="theme"){var r=document.documentElement,dark=r.dataset.theme?r.dataset.theme==="dark":matchMedia("(prefers-color-scheme: dark)").matches;r.dataset.theme=dark?"light":"dark"}
});
document.addEventListener("change",function(e){
  var c=e.target,d=c.dataset;
  if(c.type==="checkbox"){toggleTask(d.s||tab,d.g,+d.i,c.checked);render();return}
  if(d.fq){
    var g=find(d.g),t=g.tasks[+d.i],f=Object.assign({},fq(t));
    if(d.fq==="p"){f.p=c.value;if(f.p==="once"||f.p==="day")f.n=1}else f.n=Math.max(1,Math.min(+c.max,Math.round(+c.value)||1));
    t.freq=f;persist(g);render();return;
  }
  if(d.dl!==undefined){var g2=find(d.g);if(c.value)g2.deadline=c.value;else delete g2.deadline;persist(g2);render()}
});
document.addEventListener("keydown",function(e){
  if(e.key!=="Enter")return;var t=e.target;
  if(t.dataset&&t.dataset.newtask)addTask(t.dataset.newtask);
  else if(t.id==="ng"||t.id==="nt")document.querySelector('[data-act="addgoal"]').click();
});
var CK={},CI={open:false,step:0,data:{}};
var MOODS=[["😄",5],["🙂",4],["😐",3],["😔",2],["😣",1]],TAGS=["Work","Family","Sleep","Money","Health","Time"];
function dayKey(o){var d=new Date();d.setDate(d.getDate()+o);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function streak(){var n=0,o=CK[dayKey(0)]?0:-1;while(CK[dayKey(o)]){n++;o--}return n}
function lipText(){return CK[dayKey(0)]?"Check-in done. "+streak()+"-day streak.":(new Date().getHours()>=18?"It’s past 6. Time for your check-in.":"Check-in reminder at 6pm.")}
function weekCard(){
  var days=[];for(var i=-6;i<=0;i++){var k=dayKey(i),c=CK[k],m=c&&MOODS.filter(function(x){return x[1]===c.mood})[0];days.push('<div class="wd"><span>'+new Date(k+"T12:00").toLocaleDateString("en-US",{weekday:"narrow"})+'</span><b>'+(m?m[0]:"·")+'</b></div>')}
  var g=Object.keys(CK).filter(function(k){return CK[k].gratitude}).sort().pop();
  return '<section class="card week"><h3>This week</h3><div class="wrow">'+days.join("")+'</div><p class="grat">'+(g?"Grateful for: "+esc(CK[g].gratitude):"Your check-in ends with one thing you’re grateful for.")+'</p></section>';
}
function ciSteps(){return ["mood","sleep","water","move","goals","gratitude"]}
function opts(k,arr,sel,suf){return '<div class="opts">'+arr.map(function(v){return '<button class="opt" data-ci="set" data-k="'+k+'" data-v="'+esc(v)+'" aria-pressed="'+(sel===v)+'">'+esc(v)+(suf||"")+'</button>'}).join("")+'</div>'}
function ciHTML(){
  var st=ciSteps(),k=st[CI.step],d=CI.data,last=CI.step===st.length-1,all=[];
  SECTIONS.forEach(function(s){state[s.id].forEach(function(g){all.push(g)})});
  var Q={
    mood:["How are you feeling today?",'<div class="emojis">'+MOODS.map(function(m){return '<button class="emoji" data-ci="set" data-k="mood" data-v="'+m[1]+'" aria-pressed="'+(d.mood===m[1])+'" aria-label="Mood '+m[1]+' of 5">'+m[0]+'</button>'}).join("")+'</div><div class="sub">Anything shaping it? Tap all that fit.</div><div class="opts">'+TAGS.map(function(t){return '<button class="opt" data-ci="tag" data-v="'+t+'" aria-pressed="'+((d.tags||[]).indexOf(t)>-1)+'">'+t+'</button>'}).join("")+'</div>'],
    sleep:["How long did you sleep last night?",opts("sleep",[4,5,6,6.5,7,7.5,8,9,10],d.sleep," hrs")],
    water:["How much water today?",'<div class="counter"><button class="round" data-ci="water" data-v="-1" aria-label="One less">−</button><b>'+(d.water||0)+'</b><button class="round" data-ci="water" data-v="1" aria-label="One more">+</button></div><div class="sub">Glasses (8 oz each)</div>'],
    move:["Did you move today?",opts("move",["None","Walk","Strength","Cardio","Yoga","Other"],d.move)],
    goals:["Which goals moved forward today?",all.length?'<div class="opts">'+all.map(function(g){return '<button class="opt" data-ci="goal" data-v="'+g.id+'" aria-pressed="'+((d.goals||[]).indexOf(g.id)>-1)+'">'+esc(g.title)+'</button>'}).join("")+'</div>':'<div class="sub">No goals yet. Add some and they’ll show up here.</div>'],
    gratitude:["One thing you’re grateful for",'<input id="ciGrat" class="field" maxlength="200" placeholder="Today I’m grateful for…" autocomplete="off" value="'+esc(d.gratitude||"")+'">']
  },q=Q[k];
  return '<div class="overlay" role="dialog" aria-modal="true" aria-label="Daily check-in"><div class="sheet"><div class="row"><span class="eyebrow">Check-in · '+new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})+'</span><button class="x" data-ci="close" aria-label="Close check-in">×</button></div><div class="dots">'+st.map(function(_,i){return '<i class="'+(i<=CI.step?"on":"")+'"></i>'}).join("")+'</div><h2>'+q[0]+'</h2>'+q[1]+'<div class="row"><button class="ghost" data-ci="prev"'+(CI.step?"":" disabled")+'>Back</button><div class="row"><button class="opt" data-ci="next" data-skip="1">Skip</button><button class="cta" data-ci="next">'+(last?"Finish":"Next")+'</button></div></div></div></div>';
}
function layer(){document.getElementById("layer").innerHTML=CI.open?ciHTML():"";var g=document.getElementById("ciGrat");if(g)g.focus()}
function grab(){var g=document.getElementById("ciGrat");if(g)CI.data.gratitude=g.value.trim()}
function finish(){CK[dayKey(0)]=Object.assign({},CI.data,{savedAt:new Date().toISOString()});mark("c:"+dayKey(0),{type:"checkin",day:dayKey(0)});flush();CI.open=false;layer();render()}
function toggle(arr,v){var i=arr.indexOf(v);if(i>-1)arr.splice(i,1);else arr.push(v)}
document.addEventListener("click",function(e){
  var b=e.target.closest("[data-ci]");if(!b)return;
  var a=b.dataset.ci,d=CI.data,v=b.dataset.v;
  if(a==="open"){var p=CK[dayKey(0)];CI.data=p?JSON.parse(JSON.stringify(p)):{water:0};CI.step=0;CI.open=true;layer()}
  else if(a==="close"){CI.open=false;layer()}
  else if(a==="signout"){if(Object.keys(dirty).length&&!confirm("You have unsaved changes. Sign out anyway?"))return;store.signOut().catch(fail)}
  else if(a==="retry"){retryN=0;flush()}
  else if(a==="magic"){var em=document.getElementById("em").value.trim();if(!em)return;store.signIn(em).then(function(r){showSignIn(r.error?r.error.message:"Check your email for the link.")},function(e){showSignIn(e.message)})}
  else if(a==="import"){document.getElementById("imp").click()}
  else if(a==="export"){store.exportData().then(function(d){var x=document.createElement("a");x.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}));x.download="life-dashboard-"+dayKey(0)+".json";x.click()}).catch(fail)}
  else if(a==="set"){var k=b.dataset.k;d[k]=isNaN(+v)?v:+v;layer();if(k==="sleep"||k==="move")setTimeout(function(){if(CI.open&&CI.step<ciSteps().length-1){CI.step++;layer()}},220)}
  else if(a==="tag"){toggle(d.tags||(d.tags=[]),v);layer()}
  else if(a==="goal"){toggle(d.goals||(d.goals=[]),v);layer()}
  else if(a==="water"){d.water=Math.max(0,Math.min(20,(d.water||0)+(+v)));layer()}
  else if(a==="prev"){grab();CI.step=Math.max(0,CI.step-1);layer()}
  else if(a==="next"){grab();if(b.dataset.skip)delete d[ciSteps()[CI.step]];if(CI.step>=ciSteps().length-1)finish();else{CI.step++;layer()}}
});
document.addEventListener("keydown",function(e){
  if(!CI.open)return;
  if(e.key==="Escape"){CI.open=false;layer()}
  else if(e.key==="Enter"&&e.target.id==="ciGrat"){grab();finish()}
});

function showSignIn(msg){document.getElementById("main").innerHTML="";document.getElementById("layer").innerHTML='<div class="overlay"><div class="sheet"><h2>Sign in</h2><div class="sub">'+esc(msg||"We’ll email you a magic link. No password.")+'</div><input id="em" type="email" class="field" placeholder="you@email.com" autocomplete="email"><button class="cta" data-ci="magic">Send magic link</button></div></div>'}
function group(rows){var o={career:[],personal:[],family:[]};rows.forEach(function(r){if(o[r.section])o[r.section].push(r)});return o}
async function load(){
  var rows=await store.loadGoals(),seeded=await store.isSeeded();
  if(!seeded&&!rows.length){
    state=JSON.parse(JSON.stringify(SEED));
    for(var k in state)state[k].forEach(function(g){g.id=newId();g.tasks.forEach(function(t){t.id=newId()})});
    for(var s in state)for(var i=0;i<state[s].length;i++)await store.saveGoal(s,state[s][i],i);
    await store.markSeeded();
  }else state=group(rows);
  CK=await store.loadCheckins();
  LOG=await store.loadLog();
  for(var sk in state)state[sk].forEach(function(g){var ch=false;g.tasks.forEach(function(t){if(!t.id){t.id=newId();ch=true}});if(ch)persist(g,sk)});
}
var wired=false;
async function boot(){
  await store.init();
  if(!wired){wired=true;store.onAuthChange(boot)}
  if(store.mode==="cloud"&&!store.user){showSignIn();return}
  CI.open=false;layer();
  try{await load();setSync()}catch(e){fail(e)}
  render();
}
document.getElementById("imp").addEventListener("change",function(e){var f=e.target.files[0];if(!f)return;f.text().then(function(t){return store.importData(JSON.parse(t))}).then(load).then(render).catch(fail);e.target.value=""});
window.addEventListener("online",function(){if(Object.keys(dirty).length)flush()});
document.addEventListener("visibilitychange",function(){if(!document.hidden&&Object.keys(dirty).length)flush()});
window.addEventListener("beforeunload",function(e){if(Object.keys(dirty).length){e.preventDefault();e.returnValue=""}});
boot();
