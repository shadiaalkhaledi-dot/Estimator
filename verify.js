const fs=require('fs');
const E=require('./engine/engine.js');
global.WorkplanEngine=E;
const DEMO_DATA=JSON.parse(fs.readFileSync('engine/demo_candidates.json','utf8'));
global.DEMO_DATA=DEMO_DATA;

function assert(name,cond,got){ console.log((cond?'PASS':'FAIL')+' — '+name+(cond?'':'  (got: '+got+')')); if(!cond) process.exitCode=1; }

// ---- extract buildInput() from method2 and currentInput() from method3 ----
function extractFn(html, sig){
  const start=html.indexOf(sig); if(start<0) throw new Error('not found '+sig);
  let i=html.indexOf('{',start), depth=0, j=i;
  for(;j<html.length;j++){ if(html[j]==='{')depth++; else if(html[j]==='}'){depth--; if(depth===0){j++;break;}} }
  return html.slice(start,j);
}
const m2=fs.readFileSync('method2_webapp.html','utf8');
const m3=fs.readFileSync('method3_standalone.html','utf8');

// ===== METHOD 2 =====
let state;
eval(extractFn(m2,'function buildInput()'));   // defines buildInput using global state/DEMO_DATA/WorkplanEngine
function m2run(st){ state=st; return E.estimate(buildInput()); }

let r=m2run({typology:'Institutional',gfa:7500,modifiers:['Sustainability Certification Target','Fast-Track Schedule'],droppedC:false});
assert('M2 canonical confidence 84', r.scored.confidence.confidence_pct===84, r.scored.confidence.confidence_pct);
assert('M2 canonical hours 8659', r.indicative.base_hours===8659, r.indicative.base_hours);
assert('M2 canonical fee 1,801,072', r.indicative.fee===1801072, r.indicative.fee);
assert('M2 selected A,B,D,C', r.scored.selected.map(x=>x.project_code).join('')==='ABDC', r.scored.selected.map(x=>x.project_code));

let rd=m2run({typology:'Institutional',gfa:7500,modifiers:['Sustainability Certification Target','Fast-Track Schedule'],droppedC:true});
assert('M2 drop-C confidence 86', rd.scored.confidence.confidence_pct===86, rd.scored.confidence.confidence_pct);
assert('M2 drop-C hours 8880.5', rd.indicative.base_hours===8880.5, rd.indicative.base_hours);

let ri=m2run({typology:'Healthcare',gfa:20000,modifiers:['Fast-Track Schedule'],droppedC:false});
assert('M2 non-Institutional -> example_mode', ri.scored.example_mode===true, ri.scored.example_mode);
assert('M2 example_mode band Low', ri.scored.confidence.band==='Low', ri.scored.confidence.band);

// ===== METHOD 3 =====
// stub the DOM reads used by currentInput()
const KB=JSON.parse(JSON.stringify(DEMO_DATA.candidates));
const MOD_DEFAULTS=JSON.parse(JSON.stringify(DEMO_DATA.modifier_defaults||{}));
let droppedCodes={};
let TYP='Institutional', GFA=7500, MODS=['Sustainability Certification Target','Fast-Track Schedule'];
global.KB=KB; global.MOD_DEFAULTS=MOD_DEFAULTS; global.droppedCodes=droppedCodes;
global.document={ getElementById:(id)=>({value: id==='typ'?TYP:(id==='gfa'?GFA:'')}),
  querySelectorAll:(sel)=> sel.indexOf('mods')>=0 ? MODS.map(m=>({checked:true,value:m})) : [] };
eval(extractFn(m3,'function currentInput()'));
function m3run(){ return E.estimate(currentInput()); }

let t=m3run();
assert('M3 canonical confidence 84', t.scored.confidence.confidence_pct===84, t.scored.confidence.confidence_pct);
assert('M3 canonical hours 8659', t.indicative.base_hours===8659, t.indicative.base_hours);
assert('M3 all candidates scored = 4', t.scored.all_scored.length===4, t.scored.all_scored.length);

droppedCodes['C']=1; global.droppedCodes=droppedCodes;
let t2=m3run();
assert('M3 drop-C confidence 86', t2.scored.confidence.confidence_pct===86, t2.scored.confidence.confidence_pct);
assert('M3 drop-C candidates = 3', t2.scored.all_scored.length===3, t2.scored.all_scored.length);
