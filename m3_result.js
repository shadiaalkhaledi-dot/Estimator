var feeView='dialog', scopeLines=[], engagement='full', soloDisc='Structural', primeDisc='Architecture / Prime';
var SCOPE_DISC=["Architecture / Prime","Structural","Mechanical","Electrical","Interior Design","Landscape Architecture","Civil","AV / Signage","Other"];
var DISC_RATE={"Structural":200,"Mechanical":195,"Electrical":195,"Interior Design":180,"Landscape Architecture":185,"Civil":190,"AV / Signage":185,"Other":185};
var COORD_ADJ={};
function coordAdj(n){return COORD_ADJ[n]||0;}
function discBlendRate(n){return DISC_RATE[n]||190;}

function renderNoData(np){
  document.getElementById('out').innerHTML=
    '<div class="flag" style="margin-bottom:14px">No comparable <b>'+esc(np.typology)+'</b> projects in the knowledge base. By design, a no-AI tool won\'t fabricate a confident number where it has no evidence.</div>'+
    '<div class="empty" style="padding:34px 20px"><p style="font-size:15px;margin:0 0 6px"><b>'+esc(np.typology)+'</b> · '+np.gfa.toLocaleString()+' m² — no seeded comparables.</p>'+
    '<p style="font-size:13px;color:var(--muted);margin:0 0 16px">Load curated '+esc(np.typology)+' projects (left), or generate a synthetic illustrative example.</p>'+
    '<button class="runbtn" id="genex" style="max-width:340px;margin:0 auto;display:block">✦ Generate illustrative example (synthetic)</button></div>';
  document.getElementById('genex').onclick=function(){forceExample=true;compute();};
}

function compute(){
  var egEl=document.getElementById('eng'); if(egEl) engagement=egEl.value;
  var ldEl=document.getElementById('lead'); if(ldEl){primeDisc=ldEl.value; soloDisc=ldEl.value;}
  var input=currentInput();
  if(!input.candidates.length){document.getElementById('out').innerHTML='<div class="empty">Knowledge base is empty — load curated projects first.</div>';return;}
  var cv=parseFloat(document.getElementById('cv').value)||0;
  var F=WorkplanEngine.fullEstimate(input,{disciplines:selDisc(),constructionValue:cv});
  var s=F.scored;
  if(!s.selected.length&&!forceExample){renderNoData(input.new_project);return;}
  EM={input:input,conf:s.confidence,example:s.example_mode,broadened:s.broadened_typology_search,warnings:s.warnings,
    allScored:s.all_scored,selected:s.selected,byPhase:F.by_phase,primeHours:F.prime_hours,primeFee:F.prime_fee,
    byRole:F.by_role,byDiscipline:F.by_discipline,modLines:F.modifier_breakdown.lines,uplift:F.modifier_breakdown.uplift_applied,capped:F.modifier_breakdown.capped,
    raic:F.raic,resourcing:F.resourcing};
  initScope();
  renderResult();
}
function initScope(){
  scopeLines=[];var lead=primeDisc||'Architecture / Prime';
  var primeRate=EM.primeHours?Math.round(EM.primeFee/EM.primeHours):200;
  var RD=WorkplanEngine.REAL_DISCIPLINES, shareOf={}; RD.forEach(function(d){shareOf[d.name]=d.pct;});
  var names=EM.byDiscipline.map(function(d){return d.name;});
  if(names.indexOf(lead)===-1) names.unshift(lead);
  var PA=0.52, total=Math.round(EM.primeHours/PA), pool=total-EM.primeHours;
  var others=names.filter(function(n){return n!==lead;}), osum=0;
  others.forEach(function(n){osum+=(shareOf[n]||0.05);}); if(osum<=0)osum=1;
  names.forEach(function(n){var isLead=(n===lead);
    var hrs=isLead?Math.round(EM.primeHours):Math.round(pool*(shareOf[n]||0.05)/osum);
    var rate=isLead?(lead==='Architecture / Prime'?primeRate:discBlendRate(n)):discBlendRate(n);
    scopeLines.push({disc:n,sub:'',company:'DIALOG',inhouse:true,hours:hrs,rate:rate,prime:isLead});});
  applyEngagement();
}
function applyEngagement(){
  var lead=primeDisc||'Architecture / Prime', solo=soloDisc||lead;
  scopeLines.forEach(function(l){
    if(engagement==='full') l.inhouse=true;
    else if(engagement==='prime') l.inhouse=(l.disc===lead);
    else if(engagement==='solo') l.inhouse=(l.disc===solo);
    if(l.inhouse){ if(!l.company||/consultant|external/i.test(l.company)) l.company='DIALOG'; }
    else { if(l.company==='DIALOG') l.company='External consultant'; }
  });
}
function setMode(m){if(m==='full')scopeLines.forEach(function(l){l.inhouse=true;});else if(m==='arch')scopeLines.forEach(function(l){l.inhouse=(l.disc==='Architecture / Prime');});renderResult();}
function scopeTotals(){var dialogBase=0,consultant=0,coord=0;
  scopeLines.forEach(function(l){var fee=Math.round((parseFloat(l.hours)||0)*l.rate);if(l.inhouse)dialogBase+=fee;else{consultant+=fee;coord+=Math.round(fee*coordAdj(l.disc));}});
  var dialogFee=Math.round((dialogBase+coord)*(1+EM.uplift));
  var totalHours=Math.round(scopeLines.reduce(function(a,l){return a+(parseFloat(l.hours)||0);},0));
  var dialogHours=Math.round(scopeLines.filter(function(l){return l.inhouse;}).reduce(function(a,l){return a+(parseFloat(l.hours)||0);},0));
  return {dialogBase:dialogBase,coord:coord,consultant:consultant,dialogFee:dialogFee,total:dialogFee+consultant,totalHours:totalHours,dialogHours:dialogHours};}

function renderResult(){
  var conf=EM.conf,np=EM.input.new_project,pct=conf.confidence_pct,h='',T=scopeTotals();
  if(EM.warnings.length)EM.warnings.forEach(function(w){h+='<div class="flag '+(/EXAMPLE|LOW CONFIDENCE/.test(w)?'bad':'')+'">'+esc(w)+'</div>';});
  var circ=2*Math.PI*38,off=circ*(1-pct/100),col=conf.band==='High'?'#15803d':(conf.band==='Moderate'?'#b45309':'#b91c1c');
  h+='<div class="headline"><div class="gauge"><svg width="88" height="88"><circle cx="44" cy="44" r="38" fill="none" stroke="#0000000f" stroke-width="8"/><circle cx="44" cy="44" r="38" fill="none" stroke="'+col+'" stroke-width="8" stroke-linecap="round" stroke-dasharray="'+circ+'" stroke-dashoffset="'+off+'"/></svg><div class="pct"><b>'+pct+'%</b><span>confidence</span></div></div>'+
    '<div><h2 style="margin:0 0 3px;font-size:18px">Draft estimate <span class="band '+conf.band+'">'+conf.band+'</span></h2><div style="font-size:12.5px;color:var(--muted)">'+esc(np.typology)+' · '+np.gfa.toLocaleString()+' m² · '+scopeLines.length+' scope lines · '+EM.selected.length+' selected'+(EM.broadened?' · broadened':'')+'</div></div></div>';

  var W={depth:'30%',match_quality:'30%',typology_fidelity:'15%',modifier_coverage:'15%',gfa_proximity:'10%'},NM={depth:'Depth',match_quality:'Match qual.',typology_fidelity:'Typ. fidelity',modifier_coverage:'Mod. coverage',gfa_proximity:'GFA prox.'};
  h+='<h3 class="sec">Confidence drivers</h3><div class="drivers">';
  Object.keys(conf.drivers).forEach(function(k){h+='<div class="driver"><b>'+conf.drivers[k].toFixed(2)+'</b><span>'+NM[k]+'</span><em>w '+W[k]+'</em></div>';});h+='</div>';

  h+='<h3 class="sec">All candidates scored</h3><table><thead><tr><th>Code</th><th>Project</th><th class="num">Typ</th><th class="num">GFA</th><th class="num">Mod</th><th class="num">Rec</th><th class="num">Score</th><th></th></tr></thead><tbody>';
  var selCodes={};EM.selected.forEach(function(x){selCodes[x.project_code]=1;});var byCode={};EM.input.candidates.forEach(function(c){byCode[c.project_code]=c;});
  EM.allScored.forEach(function(sc){var c=byCode[sc.project_code]||{};h+='<tr class="'+(selCodes[sc.project_code]?'sel':'')+'"><td class="comp">'+esc(sc.project_code)+'</td><td>'+esc((c.project_name||'').slice(0,26))+'</td><td class="num">'+sc.typology_score.toFixed(2)+'</td><td class="num">'+sc.gfa_score.toFixed(2)+'</td><td class="num">'+sc.modifier_score.toFixed(2)+'</td><td class="num">'+sc.recency_score.toFixed(2)+'</td><td class="num"><b>'+sc.total_score.toFixed(3)+'</b></td><td>'+(selCodes[sc.project_code]&&!forceExample?'<button class="dl" data-drop="'+esc(sc.project_code)+'" style="padding:2px 7px;margin:0">drop</button>':'—')+'</td></tr>';});
  h+='</tbody></table>';

  var bigFee=feeView==='dialog'?T.dialogFee:T.total,bigLbl=feeView==='dialog'?'DIALOG fee (incl modifiers)':'Total project (incl consultants)';
  h+='<h3 class="sec">Headline</h3><div class="toggle"><button class="tg '+(feeView==='dialog'?'on':'')+'" data-fv="dialog">DIALOG fee</button><button class="tg '+(feeView==='total'?'on':'')+'" data-fv="total">Total project</button></div>'+
    '<div class="kpis" style="margin-top:8px"><div class="kpi"><b>'+T.totalHours.toLocaleString()+'</b><span>total hours ('+T.dialogHours.toLocaleString()+' DIALOG)</span></div><div class="kpi"><b>$'+(bigFee/1e6).toFixed(2)+'M</b><span>'+bigLbl+'</span></div><div class="kpi"><b>'+(EM.resourcing.peak_team?EM.resourcing.peak_team.concurrent_fte:'—')+'</b><span>peak FTE · '+(EM.resourcing.peak_team?esc(EM.resourcing.peak_team.phase):'')+'</span></div></div>';

  h+='<h3 class="sec">Scope &amp; companies — split the workload</h3>'+
     '<div class="toggle" style="margin-bottom:10px"><button class="tg" data-mode="full">Fully integrated</button><button class="tg" data-mode="arch">Architecture-only</button></div>'+
     '<table><thead><tr><th>Discipline</th><th>Sub-scope</th><th>Company</th><th style="text-align:center">In-house</th><th class="num">Hours</th><th class="num">$/hr</th><th class="num">Fee</th><th></th></tr></thead><tbody>';
  scopeLines.forEach(function(l,i){var fee=Math.round((parseFloat(l.hours)||0)*l.rate);
    h+='<tr class="'+(l.inhouse?'':'ext')+'"><td>'+esc(l.disc)+'</td><td><input class="sin" data-i="'+i+'" data-k="sub" value="'+esc(l.sub)+'" placeholder="—" style="width:80px"></td><td><input class="sin" data-i="'+i+'" data-k="company" value="'+esc(l.company)+'" style="width:96px"></td><td style="text-align:center"><input type="checkbox" class="sck" data-i="'+i+'" '+(l.inhouse?'checked':'')+'></td><td class="num"><input type="number" class="sin hin" data-i="'+i+'" data-k="hours" value="'+l.hours+'"></td><td class="num"><input type="number" class="sin" data-i="'+i+'" data-k="rate" value="'+l.rate+'" style="width:58px"></td><td class="num">$'+fee.toLocaleString()+'</td><td><button class="xrow" data-del="'+i+'">✕</button></td></tr>';});
  h+='</tbody></table><div style="margin-top:9px"><select id="addsel" style="width:auto;padding:7px 9px">'+SCOPE_DISC.map(function(d){return '<option>'+d+'</option>';}).join('')+'</select> <button class="dl" id="addline" style="padding:6px 10px">+ Add scope line</button></div>';
  h+='<div class="totgrid"><div class="tt"><span>DIALOG base fee</span><b>$'+T.dialogBase.toLocaleString()+'</b></div>'+
     (T.coord?'<div class="tt"><span>+ coordination premium</span><b>$'+T.coord.toLocaleString()+'</b></div>':'')+
     '<div class="tt"><span>+ modifiers (+'+Math.round(EM.uplift*100)+'%)</span><b>$'+(T.dialogFee-T.dialogBase-T.coord).toLocaleString()+'</b></div>'+
     '<div class="tt amber"><span>DIALOG fee</span><b>$'+T.dialogFee.toLocaleString()+'</b></div>'+
     '<div class="tt"><span>Outside consultants (carried)</span><b>$'+T.consultant.toLocaleString()+'</b></div>'+
     '<div class="tt grand"><span>Total project cost</span><b>$'+T.total.toLocaleString()+'</b></div></div>'+
     '<p style="font-size:11px;color:var(--muted);margin:7px 0 0">Toggle a line to outside → it moves into carried consultants. Add lines for two Electricals, ducts vs piping, AV/Signage, or another architecture firm.</p>';

  h+='<h3 class="sec">Hours by phase <span style="font-weight:600;color:var(--muted);text-transform:none;letter-spacing:0">(prime)</span></h3><table><thead><tr><th>Phase</th><th class="num">Prime hrs</th><th class="num">Share</th><th class="num">Firm ref %</th></tr></thead><tbody>';
  var order=["Schematic Design","Design Development","Contract Documents","Contract Administration"];
  EM.byPhase.slice().sort(function(a,b){return order.indexOf(a.phase)-order.indexOf(b.phase);}).forEach(function(p){h+='<tr><td>'+esc(p.phase)+'</td><td class="num">'+Math.round(p.hours).toLocaleString()+'</td><td class="num">'+Math.round(p.hours/EM.primeHours*100)+'%</td><td class="num">'+(p.ref_pct!=null?Math.round(p.ref_pct*100)+'%':'—')+'</td></tr>';});
  h+='</tbody></table>';

  h+='<h3 class="sec">Architecture/Prime — role detail</h3><table><thead><tr><th>Role</th><th class="num">Hours</th><th class="num">$/hr</th><th class="num">Fee</th></tr></thead><tbody>';
  EM.byRole.forEach(function(r){h+='<tr><td>'+esc(r.discipline+' — '+r.seniority)+'</td><td class="num">'+r.hours.toFixed(1)+'</td><td class="num">$'+r.rate+'</td><td class="num">$'+r.fee.toLocaleString()+'</td></tr>';});
  h+='</tbody></table>';

  h+='<h3 class="sec">Modifiers — how they add up</h3>';
  if(!EM.modLines.length)h+='<p style="font-size:12.5px;color:var(--muted)">None selected.</p>';
  else{h+='<table><thead><tr><th>Modifier</th><th class="num">Default %</th><th>Treatment</th><th class="num">Applied</th></tr></thead><tbody>';
    EM.modLines.forEach(function(m){h+='<tr><td>'+esc(m.name)+'</td><td class="num">'+Math.round(m.pct*100)+'%</td><td>'+(m.covered?'<span class="tagcov">absorbed by comparable</span>':'<span class="tagapp">default applied</span>')+'</td><td class="num">'+(m.covered?'+0%':'+'+Math.round(m.applied*100)+'%')+'</td></tr>';});
    h+='<tr class="tot"><td colspan="3">Total uplift'+(EM.capped?' (capped 50%)':'')+'</td><td class="num">+'+Math.round(EM.uplift*100)+'%</td></tr></tbody></table>';}

  if(EM.raic){var adj=T.total,rv=adj<EM.raic.fee_low?'below':(adj>EM.raic.fee_high?'above':'within'),rvtxt=rv==='within'?'sits inside':(rv==='above'?'sits above':'sits below');
    h+='<h3 class="sec">RAIC fee cross-check (Method B)</h3><div class="flag '+(rv==='within'?'good':'')+'">At $'+(EM.raic.construction_value/1e6).toFixed(0)+'M, guidance implies $'+(EM.raic.fee_low/1e6).toFixed(2)+'M–$'+(EM.raic.fee_high/1e6).toFixed(2)+'M ('+Math.round(EM.raic.fee_pct_low*100)+'–'+Math.round(EM.raic.fee_pct_high*100)+'%). Total project $'+(adj/1e6).toFixed(2)+'M '+rvtxt+' the band.'+(rv!=='within'?' <b>Divergence flagged.</b>':'')+'</div>';}

  h+='<h3 class="sec">Resourcing — FTE by phase</h3>';
  if(EM.resourcing.peak_team)h+='<p style="margin:0 0 6px;font-size:13px"><b>Peak '+EM.resourcing.peak_team.concurrent_fte+' FTE</b> in '+esc(EM.resourcing.peak_team.phase)+' — '+EM.resourcing.peak_team.roles.map(esc).join(' · ')+'</p>';
  h+='<table><thead><tr><th>Phase</th><th class="num">Weeks</th><th class="num">Hours</th><th class="num">Conc. FTE</th><th>Duration</th></tr></thead><tbody>';
  EM.resourcing.phases.forEach(function(p){h+='<tr><td>'+esc(p.phase)+'</td><td class="num">'+p.weeks+'</td><td class="num">'+p.phase_hours.toFixed(0)+'</td><td class="num"><b>'+p.concurrent_fte+'</b></td><td>'+(p.duration_assumed?'<span style="color:var(--warn)">assumed</span>':'supplied')+'</td></tr>';});
  h+='</tbody></table>';if(EM.resourcing.warnings.length)h+='<div class="flag">⚑ '+esc(EM.resourcing.warnings[0])+'</div>';

  h+='<h3 class="sec">Reference engine (wired in)</h3><p style="font-size:12px;color:var(--muted);margin:0 0 4px">Math runs in JavaScript for offline speed — a line-for-line port of the firm\'s Python, shipped inside this file. Verified identical.</p>'+
    '<details><summary>score_comparables.py</summary><pre>'+esc(PY_SCORE)+'</pre></details><details><summary>estimate_resourcing.py</summary><pre>'+esc(PY_RES)+'</pre></details>';
  h+='<p class="disclaimer">Deterministic case-based reasoning — not ML, no AI, no network. A <b>draft starting point for the PM\'s judgment</b>, never a final fee. No Excel in this demo. Reference date pinned 2026-07-23.</p>';

  document.getElementById('out').innerHTML=h;
  Array.prototype.forEach.call(document.querySelectorAll('.tg[data-fv]'),function(b){b.onclick=function(){feeView=b.dataset.fv;renderResult();};});
  Array.prototype.forEach.call(document.querySelectorAll('.tg[data-mode]'),function(b){b.onclick=function(){setMode(b.dataset.mode);};});
  Array.prototype.forEach.call(document.querySelectorAll('.sin'),function(inp){inp.onchange=function(){var l=scopeLines[inp.dataset.i],k=inp.dataset.k;l[k]=(k==='hours'||k==='rate')?(parseFloat(inp.value)||0):inp.value;renderResult();};});
  Array.prototype.forEach.call(document.querySelectorAll('.sck'),function(cb){cb.onchange=function(){scopeLines[cb.dataset.i].inhouse=cb.checked;renderResult();};});
  Array.prototype.forEach.call(document.querySelectorAll('.xrow'),function(b){b.onclick=function(){scopeLines.splice(b.dataset.del,1);renderResult();};});
  var al=document.getElementById('addline');if(al)al.onclick=function(){var dn=document.getElementById('addsel').value;scopeLines.push({disc:dn,sub:'',company:'DIALOG',inhouse:true,hours:0,rate:discBlendRate(dn),prime:false});renderResult();};
  Array.prototype.forEach.call(document.querySelectorAll('[data-drop]'),function(b){b.onclick=function(){droppedCodes[b.dataset.drop]=1;compute();};});
}
