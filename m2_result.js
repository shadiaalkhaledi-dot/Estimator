/* ---- editable result view: scope lines + companies ---- */
var EM=null, feeView='dialog', scopeLines=[];
var SCOPE_DISC=["Architecture / Prime","Structural","Mechanical","Electrical","Interior Design","Landscape Architecture","Civil","AV / Signage","Other"];
var DISC_RATE={"Structural":200,"Mechanical":195,"Electrical":195,"Interior Design":180,"Landscape Architecture":185,"Civil":190,"AV / Signage":185,"Other":185};
var COORD_ADJ={}; // Disciplines.Coordination Adjust % — all 0 in the base today; hook kept live.
function coordAdj(name){return COORD_ADJ[name]||0;}
function discBlendRate(name){return DISC_RATE[name]||190;}

function discHours(d){return Math.round(d.roles.reduce(function(a,r){return a+(parseFloat(r.hours)||0);},0)*10)/10;}
function discFee(d){return d.roles.reduce(function(a,r){return a+Math.round((parseFloat(r.hours)||0)*r.rate);},0);}

/* entry from step dispatcher — recompute from inputs (resets edits + scope) */
function result(){
  var input=buildInput();
  var F=WorkplanEngine.fullEstimate(input,{disciplines:selectedDisc(),constructionValue:state.value});
  var s=F.scored;
  EM={conf:s.confidence,example:s.example_mode,broadened:s.broadened_typology_search,warnings:s.warnings,
    selected:s.selected,allCandidates:input.candidates,byPhase:F.by_phase,primeHours:F.prime_hours,primeFee:F.prime_fee,
    byRole:F.by_role,modLines:F.modifier_breakdown.lines,uplift:F.modifier_breakdown.uplift_applied,capped:F.modifier_breakdown.capped,
    raic:F.raic,resourcing:F.resourcing,byDiscipline:F.by_discipline};
  initScope();
  renderResult();
}
function initScope(){
  scopeLines=[];
  var lead=state.primeDisc||'Architecture / Prime';
  var primeRate=EM.primeHours?Math.round(EM.primeFee/EM.primeHours):200;
  var RD=WorkplanEngine.REAL_DISCIPLINES, shareOf={}; RD.forEach(function(d){shareOf[d.name]=d.pct;});
  var names=EM.byDiscipline.map(function(d){return d.name;});
  if(names.indexOf(lead)===-1) names.unshift(lead);
  var PA=0.52, total=Math.round(EM.primeHours/PA), pool=total-EM.primeHours; // prime carries ~52%; rest split the remainder
  var others=names.filter(function(n){return n!==lead;}), osum=0;
  others.forEach(function(n){osum+=(shareOf[n]||0.05);}); if(osum<=0)osum=1;
  names.forEach(function(n){
    var isLead=(n===lead);
    var hrs=isLead?Math.round(EM.primeHours):Math.round(pool*(shareOf[n]||0.05)/osum);
    var rate=isLead?(lead==='Architecture / Prime'?primeRate:discBlendRate(n)):discBlendRate(n);
    scopeLines.push({disc:n,sub:'',company:'DIALOG',inhouse:true,hours:hrs,rate:rate,prime:isLead});
  });
  applyEngagement();
}
function applyEngagement(){
  var e=state.engagement||'full', lead=state.primeDisc||'Architecture / Prime', solo=state.soloDisc||lead;
  scopeLines.forEach(function(l){
    if(e==='full') l.inhouse=true;
    else if(e==='prime') l.inhouse=(l.disc===lead);
    else if(e==='solo') l.inhouse=(l.disc===solo);
    // custom: leave as initialised (all DIALOG) for the user to edit
    if(l.inhouse){ if(!l.company||/consultant|external/i.test(l.company)) l.company='DIALOG'; }
    else { if(l.company==='DIALOG') l.company='External consultant'; }
  });
}
function setMode(m){
  if(m==='full') scopeLines.forEach(function(l){l.inhouse=true;});
  else if(m==='arch') scopeLines.forEach(function(l){l.inhouse=(l.disc==='Architecture / Prime');});
  renderResult();
}
function scopeTotals(){
  var dialogBase=0,consultant=0,coord=0;
  scopeLines.forEach(function(l){var fee=Math.round((parseFloat(l.hours)||0)*l.rate);
    if(l.inhouse) dialogBase+=fee; else { consultant+=fee; coord+=Math.round(fee*coordAdj(l.disc)); }});
  var dialogFee=Math.round((dialogBase+coord)*(1+EM.uplift));
  var totalHours=Math.round(scopeLines.reduce(function(a,l){return a+(parseFloat(l.hours)||0);},0));
  var dialogHours=Math.round(scopeLines.filter(function(l){return l.inhouse;}).reduce(function(a,l){return a+(parseFloat(l.hours)||0);},0));
  return {dialogBase:dialogBase,coord:coord,consultant:consultant,dialogFee:dialogFee,total:dialogFee+consultant,totalHours:totalHours,dialogHours:dialogHours};
}

function renderResult(){
  var conf=EM.conf,pct=conf.confidence_pct,h=progress(6),T=scopeTotals();
  if(EM.example) h+='<div class="flag bad"><b>◆ EXAMPLE MODE</b> — no real '+esc(state.typology)+' comparables on file, so synthetic ones were fabricated. Math is genuine; comparables are invented; confidence pinned Low.</div>';

  var circ=2*Math.PI*42,off=circ*(1-pct/100),col=conf.band==='High'?'#15803d':(conf.band==='Moderate'?'#b45309':'#b91c1c');
  h+='<div class="headline"><div class="gauge"><svg width="96" height="96"><circle cx="48" cy="48" r="42" fill="none" stroke="#0000000f" stroke-width="9"/>'+
     '<circle cx="48" cy="48" r="42" fill="none" stroke="'+col+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+circ+'" stroke-dashoffset="'+off+'"/></svg>'+
     '<div class="pct"><b>'+pct+'%</b><span>confidence</span></div></div>'+
     '<div class="hl-text"><h3>Draft workplan estimate <span class="band '+conf.band+'">'+conf.band+'</span></h3>'+
     '<p>'+esc(state.typology)+' · '+Number(state.gfa).toLocaleString()+' m² · '+scopeLines.length+' scope lines · '+state.modifiers.length+' modifiers</p></div></div>';
  h+='<div class="methodnote"><b>Method A+B (combined):</b> comparables drive the phase &amp; role shape; the scope split, companies and rates turn it into a costed workplan. Every hour is editable.</div>';
  h+='<ul class="audit" style="margin:12px 0 0;padding-left:18px">'+conf.factors.map(function(f){return '<li>'+esc(f)+'</li>';}).join('')+'</ul>';

  // comparables
  h+='<div class="sec"><h4>Comparables used</h4><table><thead><tr><th>Project</th><th class="num">Similarity</th><th>Typ</th><th class="num">GFA</th><th>Outcome</th></tr></thead><tbody>';
  var byCode={}; EM.allCandidates.forEach(function(c){byCode[c.project_code]=c;});
  EM.selected.forEach(function(sc){var c=byCode[sc.project_code]||{};
    h+='<tr><td><b>'+esc(sc.project_code)+'</b> '+esc(c.project_name||'')+'</td><td class="num"><span class="simbar" style="width:'+(sc.total_score*46)+'px"></span>'+sc.total_score.toFixed(3)+'</td><td>'+esc(sc.typology_match)+'</td><td class="num">'+(c.gfa?c.gfa.toLocaleString():'—')+'</td><td>'+esc(c.outcome_judgment||'—')+'</td></tr>';});
  h+='</tbody></table>';
  if(state.typology==='Institutional'&&!state.droppedC) h+='<div class="flag"><span>◇</span><div><b>Project C</b> is a small secondary school (3,800 m²) — not a close fit. <button class="btn ghost" id="dropc" style="padding:2px 6px;color:var(--amber-d);text-decoration:underline">Drop Project C ›</button></div></div>';
  else if(state.typology==='Institutional'&&state.droppedC) h+='<div class="flag good"><span>✓</span><div><b>Project C dropped.</b> Confidence rose to '+pct+'%. <button class="btn ghost" id="restorec" style="padding:2px 6px;color:var(--good);text-decoration:underline">Undo</button></div></div>';
  h+='</div>';

  // headline KPIs w/ fee-view toggle
  var bigFee=feeView==='dialog'?T.dialogFee:T.total, bigLbl=feeView==='dialog'?'DIALOG fee (incl. modifiers)':'Total project (incl. consultants)';
  h+='<div class="sec"><h4>Headline</h4>'+
     '<div class="toggle"><button class="tg '+(feeView==='dialog'?'on':'')+'" data-fv="dialog">DIALOG fee</button><button class="tg '+(feeView==='total'?'on':'')+'" data-fv="total">Total project</button></div>'+
     '<div class="kpis" style="margin-top:8px">'+
     '<div class="kpi"><b>'+T.totalHours.toLocaleString()+'</b><span>total hours ('+T.dialogHours.toLocaleString()+' DIALOG)</span></div>'+
     '<div class="kpi"><b>$'+(bigFee/1e6).toFixed(2)+'M</b><span>'+bigLbl+'</span></div>'+
     '<div class="kpi"><b>'+(EM.resourcing.peak_team?EM.resourcing.peak_team.concurrent_fte:'—')+'</b><span>peak FTE · '+(EM.resourcing.peak_team?esc(EM.resourcing.peak_team.phase):'')+'</span></div></div></div>';

  // SCOPE & COMPANIES
  h+='<div class="sec"><h4>Scope &amp; companies — split the workload</h4>'+
     '<div class="toggle" style="margin-bottom:10px"><span style="font-size:11.5px;color:var(--muted);font-weight:700;margin-right:6px">Quick set:</span><button class="tg" data-mode="full">Fully integrated (all DIALOG)</button><button class="tg" data-mode="arch">DIALOG architecture-only</button></div>'+
     '<table><thead><tr><th>Discipline</th><th>Sub-scope</th><th>Company</th><th style="text-align:center">In-house</th><th class="num">Hours</th><th class="num">$/hr</th><th class="num">Fee</th><th></th></tr></thead><tbody>';
  scopeLines.forEach(function(l,i){var fee=Math.round((parseFloat(l.hours)||0)*l.rate);
    h+='<tr class="'+(l.inhouse?'':'ext')+'"><td>'+esc(l.disc)+'</td>'+
       '<td><input class="sin" data-i="'+i+'" data-k="sub" value="'+esc(l.sub)+'" placeholder="—" style="width:96px"></td>'+
       '<td><input class="sin" data-i="'+i+'" data-k="company" value="'+esc(l.company)+'" style="width:110px"></td>'+
       '<td style="text-align:center"><input type="checkbox" class="sck" data-i="'+i+'" '+(l.inhouse?'checked':'')+'></td>'+
       '<td class="num"><input type="number" class="sin hin" data-i="'+i+'" data-k="hours" value="'+l.hours+'"></td>'+
       '<td class="num"><input type="number" class="sin" data-i="'+i+'" data-k="rate" value="'+l.rate+'" style="width:64px"></td>'+
       '<td class="num">$'+fee.toLocaleString()+'</td>'+
       '<td><button class="xrow" data-del="'+i+'" title="remove">✕</button></td></tr>';});
  h+='</tbody></table>';
  h+='<div style="margin-top:10px"><select id="addsel" style="width:auto;padding:8px 10px">'+SCOPE_DISC.map(function(d){return '<option>'+d+'</option>';}).join('')+'</select> <button class="btn ghost" id="addline" style="padding:8px 12px;color:var(--amber-d)">+ Add scope line</button></div>';
  // totals block
  h+='<div class="totgrid">'+
     '<div class="tt"><span>DIALOG base fee</span><b>$'+T.dialogBase.toLocaleString()+'</b></div>'+
     (T.coord?'<div class="tt"><span>+ coordination premium</span><b>$'+T.coord.toLocaleString()+'</b></div>':'')+
     '<div class="tt"><span>+ modifiers (+'+Math.round(EM.uplift*100)+'%)</span><b>$'+(T.dialogFee-T.dialogBase-T.coord).toLocaleString()+'</b></div>'+
     '<div class="tt amber"><span>DIALOG fee</span><b>$'+T.dialogFee.toLocaleString()+'</b></div>'+
     '<div class="tt"><span>Outside consultants (carried)</span><b>$'+T.consultant.toLocaleString()+'</b></div>'+
     '<div class="tt grand"><span>Total project cost</span><b>$'+T.total.toLocaleString()+'</b></div></div>';
  h+='<p style="font-size:11.5px;color:var(--muted);margin:8px 0 0">Toggle a line to <b>outside</b> and it moves from DIALOG’s fee into carried consultants (with DIALOG’s coordination premium, currently 0% in your base). Edit hours, rate, company, or sub-scope inline. Add a line to model two Electricals, ducts vs piping, AV/Signage, or another architecture firm.</p></div>';

  // by phase
  h+='<div class="sec"><h4>Hours by phase <span style="font-weight:600;color:var(--muted);text-transform:none;letter-spacing:0">(Architecture/Prime distribution)</span></h4><table><thead><tr><th>Phase</th><th class="num">Prime hours</th><th class="num">Share</th><th class="num">Firm ref %</th></tr></thead><tbody>';
  var order=["Schematic Design","Design Development","Contract Documents","Contract Administration"];
  EM.byPhase.slice().sort(function(a,b){return order.indexOf(a.phase)-order.indexOf(b.phase);}).forEach(function(p){
    h+='<tr><td>'+esc(p.phase)+'</td><td class="num">'+Math.round(p.hours).toLocaleString()+'</td><td class="num">'+Math.round(p.hours/EM.primeHours*100)+'%</td><td class="num">'+(p.ref_pct!=null?Math.round(p.ref_pct*100)+'%':'—')+'</td></tr>';});
  h+='</tbody></table></div>';

  // prime role detail (read-only)
  h+='<div class="sec"><h4>Architecture/Prime — role detail</h4><table><thead><tr><th>Role</th><th class="num">Hours</th><th class="num">$/hr</th><th class="num">Fee</th></tr></thead><tbody>';
  EM.byRole.forEach(function(r){h+='<tr><td>'+esc(r.discipline+' — '+r.seniority)+'</td><td class="num">'+r.hours.toFixed(1)+'</td><td class="num">$'+r.rate+'</td><td class="num">$'+r.fee.toLocaleString()+'</td></tr>';});
  h+='</tbody></table></div>';

  // modifiers
  h+='<div class="sec"><h4>Complexity modifiers — how they add up</h4>';
  if(!EM.modLines.length) h+='<p class="audit" style="margin:0">No modifiers selected.</p>';
  else{h+='<table><thead><tr><th>Modifier</th><th class="num">Default %</th><th>Treatment</th><th class="num">Applied</th></tr></thead><tbody>';
    EM.modLines.forEach(function(m){h+='<tr class="modrow"><td>'+esc(m.name)+'</td><td class="num">'+Math.round(m.pct*100)+'%</td><td>'+(m.covered?'<span class="tagcov">seen in a comparable — absorbed</span>':'<span class="tagapp">default applied</span>')+'</td><td class="num">'+(m.covered?'+0%':'+'+Math.round(m.applied*100)+'%')+'</td></tr>';});
    h+='<tr><td colspan="3" style="font-weight:800">Total uplift'+(EM.capped?' (capped 50%)':'')+'</td><td class="num" style="font-weight:800">+'+Math.round(EM.uplift*100)+'%</td></tr></tbody></table>';}
  h+='</div>';

  // RAIC vs total project
  if(EM.raic){var adj=T.total,rv=adj<EM.raic.fee_low?'below':(adj>EM.raic.fee_high?'above':'within'),rvtxt=rv==='within'?'sits inside':(rv==='above'?'sits <b>above</b>':'sits <b>below</b>');
    h+='<div class="sec"><h4>RAIC fee cross-check (Method B)</h4><div class="flag '+(rv==='within'?'good':'')+'"><span>◇</span><div>At <b>$'+(EM.raic.construction_value/1e6).toFixed(0)+'M</b> construction value, guidance implies <b>$'+(EM.raic.fee_low/1e6).toFixed(2)+'M–$'+(EM.raic.fee_high/1e6).toFixed(2)+'M</b> ('+Math.round(EM.raic.fee_pct_low*100)+'–'+Math.round(EM.raic.fee_pct_high*100)+'%). Total project fee <b>$'+(adj/1e6).toFixed(2)+'M</b> '+rvtxt+' that band.'+(rv!=='within'?' <b>Divergence flagged.</b>':'')+'</div></div><p style="font-size:11.5px;color:var(--muted);margin:8px 0 0">Indicative placeholder band — swap in raic_fee_benchmarks.json.</p></div>';}

  // resourcing
  h+='<div class="sec"><h4>Resourcing — peak team</h4>';
  if(EM.resourcing.peak_team){h+='<p style="margin:0 0 4px"><b>'+EM.resourcing.peak_team.concurrent_fte+' FTE</b> at peak, during <b>'+esc(EM.resourcing.peak_team.phase)+'</b> (Architecture/Prime):</p>';
    var maxf=0;EM.resourcing.peak_team.roles.forEach(function(l){var n=parseFloat(l);if(n>maxf)maxf=n;});
    EM.resourcing.peak_team.roles.forEach(function(l){var n=parseFloat(l);h+='<div class="rolebar"><span class="fill" style="width:'+(n/maxf*160)+'px"></span><span>'+esc(l)+'</span></div>';});}
  if(EM.resourcing.warnings.length)h+='<div class="flag"><span>⚑</span><div>'+esc(EM.resourcing.warnings[0])+'</div></div>';
  h+='</div>';

  h+='<p class="disclaimer">A <b>draft starting point for the PM\'s judgment</b>, not a final fee. In production the approved draft writes into the firm\'s Excel workplan template — <b>out of scope for this demo</b>. Same engine as Method 1 (Claude) and Method 3.</p>';
  h+='<div class="nav"><button class="btn ghost" id="restart">‹ New estimate</button><span></span></div>';
  card.innerHTML=h;

  Array.prototype.forEach.call(card.querySelectorAll('.tg[data-fv]'),function(b){b.onclick=function(){feeView=b.dataset.fv;renderResult();};});
  Array.prototype.forEach.call(card.querySelectorAll('.tg[data-mode]'),function(b){b.onclick=function(){setMode(b.dataset.mode);};});
  Array.prototype.forEach.call(card.querySelectorAll('.sin'),function(inp){inp.onchange=function(){var l=scopeLines[inp.dataset.i],k=inp.dataset.k;l[k]=(k==='hours'||k==='rate')?(parseFloat(inp.value)||0):inp.value;renderResult();};});
  Array.prototype.forEach.call(card.querySelectorAll('.sck'),function(cb){cb.onchange=function(){scopeLines[cb.dataset.i].inhouse=cb.checked;renderResult();};});
  Array.prototype.forEach.call(card.querySelectorAll('.xrow'),function(b){b.onclick=function(){scopeLines.splice(b.dataset.del,1);renderResult();};});
  var al=document.getElementById('addline');if(al)al.onclick=function(){var dn=document.getElementById('addsel').value;scopeLines.push({disc:dn,sub:'',company:'DIALOG',inhouse:true,hours:0,rate:discBlendRate(dn),prime:false});renderResult();};
  var dc=document.getElementById('dropc');if(dc)dc.onclick=function(){state.droppedC=true;result();};
  var rc=document.getElementById('restorec');if(rc)rc.onclick=function(){state.droppedC=false;result();};
  document.getElementById('restart').onclick=function(){state={step:0,scope:'',engagement:'full',soloDisc:'Architecture / Prime',typology:null,gfa:null,disciplines:defDisc(),modifiers:[],value:null,useDefaults:true,droppedC:false};render();};
}
