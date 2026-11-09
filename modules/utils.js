// Utility functions for the life dashboard

export function esc(s) {
  return String(s).replace(/[&<>"]/g, function(c) {
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]
  })
}

export function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0;
    return (c==="x"?r:(r&3|8)).toString(16)
  })
}

export function lday(iso) {
  var d = new Date(iso);
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0")
}

export function dayKey(o) {
  var d = new Date();
  d.setDate(d.getDate()+o);
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0")
}

export function pstart(p) {
  var o = 0, n = new Date();
  if (p==="week") o = -((n.getDay()+6)%7);
  else if (p==="month") o = 1-n.getDate();
  return dayKey(o)
}
