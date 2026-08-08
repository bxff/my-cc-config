/**
 * patch-qol.mjs — subagent task-lifecycle quality-of-life splices for Claude Code.
 *
 * Retention, pinning, detaching, and the [p] markers, across every surface:
 * the background-tasks dialog, the agents view, the footer tree, and the
 * viewing mode. Personal tooling; anchors are structural, identifiers are
 * captured from the bundle at patch time (2.1.220 verified).
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MARK = '/*ccq*/';

// --- anchors (minified shape as shipped; property keys never rename) --------

// 6) task retention — terminal tasks stay in the session list (Qse/Tdd/dMf)
const RETENTION = Buffer.from('Qse=30000,Tdd=30000');
const RETENTION_NEW = Buffer.from('Qse=3600000,Tdd=3600000');
const VIEW_REARM = Buffer.from('dMf=30000');
const VIEW_REARM_NEW = Buffer.from('dMf=3600000');

// 5) agents-view done-fold — keep completed agents listed
const DONE_FOLD = Buffer.from('C=b>=eKS?b:0');
const DONE_FOLD_NEW = Buffer.from('C=0');

// 7) task panel keybindings — k=pin, x-on-terminal=dismiss, d=detach
const PANEL_KEYS = Buffer.from('if(se.key==="x"&&!se.ctrl&&!se.meta){if(se.preventDefault(),ne.type==="local_bash"&&ne.status==="running")H(ne.id);');
const PANEL_KEYS_NEW = Buffer.from(
  'if((se.key==="p"||se.key==="k")&&!se.ctrl&&!se.meta&&ne.task){se.preventDefault();' +
  's((q)=>{let w=q.tasks?.[ne.id];return w?{...q,tasks:{...q.tasks,[ne.id]:{...w,retain:!w.retain,evictAfter:w.retain?Date.now()+3600000:void 0}}}:q});' +
  'e("Pinned "+(ne.task.description||ne.id)+", kept until x",{display:"system"})}' +
  'if(se.key==="x"&&!se.ctrl&&!se.meta&&ne.status!=="running"&&ne.task){se.preventDefault();' +
  's((q)=>{let w=q.tasks?.[ne.id];return w?{...q,tasks:{...q.tasks,[ne.id]:{...w,evictAfter:Date.now()+30000,retain:void 0}}}:q});' +
  'e("Dismissing "+(ne.task.description||ne.id)+", removing in 30s",{display:"system"})}' +
  'if(se.key==="d"&&!se.ctrl&&!se.meta&&ne.task){se.preventDefault();try{' +
  'let fss=require("fs"),pss=require("path"),cry=require("crypto"),proj=process.env.HOME+"/.claude/projects",found=null;' +
  'for(let dd of fss.readdirSync(proj)){let p1=pss.join(proj,dd);let st;try{st=fss.statSync(p1)}catch(x){continue}' +
  'if(!st.isDirectory())continue;for(let ss of fss.readdirSync(p1)){let p2=pss.join(p1,ss);' +
  'try{if(!fss.statSync(p2).isDirectory())continue}catch(x){continue}' +
  'let p3=pss.join(p2,"subagents","agent-"+ne.id+".jsonl");if(fss.existsSync(p3)){found=p3;break}}if(found)break}' +
  'if(!found){e("No transcript found for "+ne.id,{display:"system"});return}' +
  'let lines=fss.readFileSync(found,"utf8").split("\\n"),uid=cry.randomUUID(),msgs=[],prev=null;' +
  'for(let raw of lines){let dd;try{dd=JSON.parse(raw)}catch(x){continue}let tt=dd.type;' +
  'if(tt!=="user"&&tt!=="assistant"&&tt!=="attachment")continue;' +
  'dd.uuid=dd.uuid||cry.randomUUID();dd.timestamp=dd.timestamp||new Date().toISOString();' +
  'dd.sessionId=uid;dd.isSidechain=false;dd.parentUuid=prev;prev=dd.uuid;msgs.push(dd)}' +
  'if(msgs.length===0){e("No messages to detach for "+ne.id,{display:"system"});return}' +
  'let out=pss.join(proj,pss.basename(pss.dirname(pss.dirname(pss.dirname(found)))),uid+".jsonl");' +
  'let body=JSON.stringify({type:"mode",mode:"normal",sessionId:uid})+"\\n"+JSON.stringify({type:"permission-mode",permissionMode:"default",sessionId:uid})+"\\n";' +
  'for(let m of msgs)body+=JSON.stringify(m)+"\\n";fss.writeFileSync(out,body,{mode:0o600});' +
  'e("Detached "+ne.id+", resume with: claude --resume "+uid,{display:"system"})}catch(err){e("Detach failed: "+err.message,{display:"system"})}}' +
  'if(se.key==="x"&&!se.ctrl&&!se.meta){if(se.preventDefault(),ne.type==="local_bash"&&ne.status==="running")H(ne.id);'
);

// 8) task row renderer — [p] marker on pinned (retain) local_agent rows
const PIN_MARK = Buffer.from('let Av;if(XT[29]!==Pb||XT[30]!==_w)Av=Nf.jsxs(h,{children:[Pb," ",_w]}),XT[29]=Pb,XT[30]=_w,XT[31]=Av;else Av=XT[31];return Av}');
const PIN_MARK_NEW = Buffer.from(
  'let Av;if(XT[29]!==Pb||XT[30]!==_w||XT[31]!==!!Ca.retain)' +
  'Av=Nf.jsxs(h,{children:[Pb," ",!!Ca.retain?"[p] ":"",_w]}),' +
  'XT[29]=Pb,XT[30]=_w,XT[31]=!!Ca.retain,XT[32]=Av;else Av=XT[32];return Av}'
);

// 8b) panel input guide — "p pin" hint for agent entries
const PIN_HINT = Buffer.from('Ed.jsx($e,{chord:"escape",action:"close"},"esc")],');
const PIN_HINT_NEW = Buffer.from(
  '...(x?.task?[Ed.jsx($e,{chord:"p",action:"pin"},"pin")]:[]),' +
  'Ed.jsx($e,{chord:"escape",action:"close"},"esc")],'
);

// 8c) teammate row renderer — [p] marker on pinned teammates
const PIN_MARK_TM = Buffer.from('Qre=Nf.jsxs(p8a,{children:[_w,Av]}),XT[50]=p8a,XT[51]=_w,XT[52]=Av,XT[53]=Qre;else Qre=XT[53];return Qre}');
const PIN_MARK_TM_NEW = Buffer.from(
  'Qre=Nf.jsxs(p8a,{children:[_w,Av,!!Ca.retain?" [p]":void 0]}),' +
  'XT[50]=p8a,XT[51]=_w,XT[52]=Av,XT[113]=!!Ca.retain,XT[53]=Qre;' +
  'else Qre=XT[53];return Qre}'
);

// 10) agents view — bare p = pin (alias for the native ctrl+t pin toggle)
const PIN_ALIAS = Buffer.from('if(Ge.ctrl&&Ge.key==="t"){Tr();let $r=tO.current[nt.current],Gr=$r?.kind==="job"?$r.job:void 0;if(!Gr||gI.some((Ts)=>Ts.id===Gr.id))return;');
const PIN_ALIAS_NEW = Buffer.from(
  'if((Ge.ctrl&&Ge.key==="t")||(!Ge.ctrl&&!Ge.meta&&Ge.key==="p"&&!lt&&!v)){Tr();' +
  'let $r=tO.current[nt.current],Gr=$r?.kind==="job"?$r.job:void 0;if(!Gr||gI.some((Ts)=>Ts.id===Gr.id))return;'
);

// 13) agents view — allow pinning in-process sessions too
const PIN_GATE = Buffer.from('if(Gr.state.backend!=="daemon"){ho(Gr.state.backend==="remote"?"Can\'t pin a cloud session":"Can\'t pin a session that\'s running in another terminal"),be("fleet_view_pin_toggle");return}');
const PIN_GATE_NEW = Buffer.from('');

// 14) main screen (viewing mode) — p = pin viewed task, d = detach viewed task
const MAIN_KEYS = Buffer.from('handleKeyDown:(l)=>{if(t)return;if(l.name==="escape"&&n==="viewing-agent"){');
const MAIN_KEYS_NEW = Buffer.from(
  'handleKeyDown:(l)=>{if(t)return;' +
  'if(!l.ctrl&&!l.meta&&(l.key==="p"||l.key==="k")&&o){l.preventDefault();' +
  'i((q)=>{let w=q.tasks?.[o];return w?{...q,tasks:{...q.tasks,[o]:{...w,retain:!w.retain,evictAfter:w.retain?Date.now()+3600000:void 0}}}:q})}' +
  'if(!l.ctrl&&!l.meta&&l.key==="d"&&o){l.preventDefault();try{' +
  'let fss=require("fs"),pss=require("path"),cry=require("crypto"),proj=process.env.HOME+"/.claude/projects",found=null;' +
  'for(let dd of fss.readdirSync(proj)){let p1=pss.join(proj,dd);let st;try{st=fss.statSync(p1)}catch(x){continue}' +
  'if(!st.isDirectory())continue;for(let ss of fss.readdirSync(p1)){let p2=pss.join(p1,ss);' +
  'try{if(!fss.statSync(p2).isDirectory())continue}catch(x){continue}' +
  'let p3=pss.join(p2,"subagents","agent-"+o+".jsonl");if(fss.existsSync(p3)){found=p3;break}}if(found)break}' +
  'if(found){let lines=fss.readFileSync(found,"utf8").split("\\n"),uid=cry.randomUUID(),msgs=[],prev=null;' +
  'for(let raw of lines){let dd;try{dd=JSON.parse(raw)}catch(x){continue}let tt=dd.type;' +
  'if(tt!=="user"&&tt!=="assistant"&&tt!=="attachment")continue;' +
  'dd.uuid=dd.uuid||cry.randomUUID();dd.timestamp=dd.timestamp||new Date().toISOString();' +
  'dd.sessionId=uid;dd.isSidechain=false;dd.parentUuid=prev;prev=dd.uuid;msgs.push(dd)}' +
  'if(msgs.length>0){let out=pss.join(proj,pss.basename(pss.dirname(pss.dirname(pss.dirname(found)))),uid+".jsonl");' +
  'let body=JSON.stringify({type:"mode",mode:"normal",sessionId:uid})+"\\n"+JSON.stringify({type:"permission-mode",permissionMode:"default",sessionId:uid})+"\\n";' +
  'for(let m of msgs)body+=JSON.stringify(m)+"\\n";fss.writeFileSync(out,body,{mode:0o600})}}' +
  '}catch(err){}}' +
  'if(l.name==="escape"&&n==="viewing-agent"){'
);

// 15) footer (main-view task tree) — p = pin, d = detach via named chords
const FOOTER_BIND = Buffer.from('x:"footer:close",backspace:"footer:dismiss",delete:"footer:dismiss"}}');
const FOOTER_BIND_NEW = Buffer.from('x:"footer:close",p:"footer:pin",d:"footer:detach",backspace:"footer:dismiss",delete:"footer:dismiss"}}');
const FOOTER_ACT = Buffer.from('"footer:previous":rQ,"footer:openSelected":');
const FOOTER_ACT_NEW = Buffer.from(
  '"footer:previous":rQ,' +
  '"footer:pin":()=>{let Wt=Xl>=1?RX(Ot,jl,er,sl)[Xl-1]:void 0;' +
  'if(Wt)mt((Rn)=>{let w=Rn.tasks?.[Wt.id];' +
  'return w?{...Rn,tasks:{...Rn.tasks,[Wt.id]:{...w,retain:!w.retain,evictAfter:w.retain?Date.now()+3600000:void 0}}}:Rn})},' +
  '"footer:detach":()=>{let Wt=Xl>=1?RX(Ot,jl,er,sl)[Xl-1]:void 0;if(!Wt)return;try{' +
  'let fss=require("fs"),pss=require("path"),cry=require("crypto"),proj=process.env.HOME+"/.claude/projects",found=null;' +
  'let ag=Wt.id.startsWith("agent-")?Wt.id.slice(6):Wt.id;' +
  'for(let dd of fss.readdirSync(proj)){let p1=pss.join(proj,dd);let st;try{st=fss.statSync(p1)}catch(x){continue}' +
  'if(!st.isDirectory())continue;for(let ss of fss.readdirSync(p1)){let p2=pss.join(p1,ss);' +
  'try{if(!fss.statSync(p2).isDirectory())continue}catch(x){continue}' +
  'let p3=pss.join(p2,"subagents","agent-"+ag+".jsonl");if(fss.existsSync(p3)){found=p3;break}}if(found)break}' +
  'if(found){let lines=fss.readFileSync(found,"utf8").split("\\n"),uid=cry.randomUUID(),msgs=[],prev=null;' +
  'for(let raw of lines){let dd;try{dd=JSON.parse(raw)}catch(x){continue}let tt=dd.type;' +
  'if(tt!=="user"&&tt!=="assistant"&&tt!=="attachment")continue;' +
  'dd.uuid=dd.uuid||cry.randomUUID();dd.timestamp=dd.timestamp||new Date().toISOString();' +
  'dd.sessionId=uid;dd.isSidechain=false;dd.parentUuid=prev;prev=dd.uuid;msgs.push(dd)}' +
  'if(msgs.length>0){let out=pss.join(proj,pss.basename(pss.dirname(pss.dirname(pss.dirname(found)))),uid+".jsonl");' +
  'let body=JSON.stringify({type:"mode",mode:"normal",sessionId:uid})+"\\n"+JSON.stringify({type:"permission-mode",permissionMode:"default",sessionId:uid})+"\\n";' +
  'for(let m of msgs)body+=JSON.stringify(m)+"\\n";fss.writeFileSync(out,body,{mode:0o600});' +
  'let cmd="claude --resume "+uid;hI(te.slice(0,xe)+cmd+te.slice(xe));Qe(xe+cmd.length)}}}' +
  'catch(err){}},' +
  '"footer:openSelected":'
);

// 16) footer tree rows — [p] marker on pinned tasks (retain)
const TREE_PIN = Buffer.from('let UQa;if(OF[45]!==n5||OF[46]!==Hjt||OF[47]!==Nvt||OF[48]!==nPr)UQa=cs.jsxs(h,{bold:n5,dimColor:Hjt,wrap:"truncate",children:[Nvt,nPr]}),OF[45]=n5,OF[46]=Hjt,OF[47]=Nvt,OF[48]=nPr,OF[49]=UQa;else UQa=OF[49];');
const TREE_PIN_NEW = Buffer.from(
  'let UQa;if(OF[45]!==n5||OF[46]!==Hjt||OF[47]!==Nvt||OF[48]!==nPr||OF[78]!==Lvt)' +
  'UQa=cs.jsxs(h,{bold:n5,dimColor:Hjt,wrap:"truncate",children:[!!Lvt.retain?"[p] ":void 0,Nvt,nPr]}),' +
  'OF[45]=n5,OF[46]=Hjt,OF[47]=Nvt,OF[48]=nPr,OF[49]=UQa,OF[78]=Lvt;else UQa=OF[49];'
);

const SITES = [
  ['task retention', RETENTION, RETENTION_NEW],
  ['view re-arm', VIEW_REARM, VIEW_REARM_NEW],
  ['agents-view done-fold', DONE_FOLD, DONE_FOLD_NEW],
  ['panel keys p/k/x/d', PANEL_KEYS, PANEL_KEYS_NEW],
  ['row [p] marker', PIN_MARK, PIN_MARK_NEW],
  ['p pin hint', PIN_HINT, PIN_HINT_NEW],
  ['teammate [p] marker', PIN_MARK_TM, PIN_MARK_TM_NEW],
  ['agents view p=pin alias', PIN_ALIAS, PIN_ALIAS_NEW],
  ['pin gate removal', PIN_GATE, PIN_GATE_NEW],
  ['main screen keys', MAIN_KEYS, MAIN_KEYS_NEW],
  ['footer bindings', FOOTER_BIND, FOOTER_BIND_NEW],
  ['footer actions', FOOTER_ACT, FOOTER_ACT_NEW],
  ['tree [p] marker', TREE_PIN, TREE_PIN_NEW],
];

export function patchQoL(bundle) {
  if (bundle.includes(MARK)) return { out: bundle, patched: false };
  let out = bundle.toString('latin1');
  for (const [name, anchor, repl] of SITES) {
    if (out.indexOf(anchor) < 0) throw new Error(name + ' anchor not found — version mismatch?');
  }
  for (const [name, anchor, repl] of SITES) {
    const pos = out.indexOf(anchor);
    out = out.slice(0, pos) + repl + out.slice(pos + anchor.length);
  }
  out = out + MARK;
  return { out: Buffer.from(out, 'latin1'), patched: true };
}

function findBun() {
  for (const p of [process.env.HOME + '/.bun/bin/bun', 'bun']) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; } catch {}
  }
  return null;
}

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) {
    console.error('usage: node patch-qol.mjs <input-bundle.js> <output.js>');
    process.exit(1);
  }
  const bundle = fs.readFileSync(inPath);
  const { out, patched } = patchQoL(bundle);
  fs.writeFileSync(outPath, out);
  console.log(`${patched ? 'patched' : 'unchanged (already patched)'}: ${bundle.length} -> ${out.length} bytes -> ${outPath}`);
  const bun = findBun();
  if (!bun) return;
  try {
    execFileSync(bun, ['build', outPath, '--no-bundle', '--outfile=/dev/null'], { stdio: 'pipe' });
    console.log('parse ok');
  } catch {
    fs.unlinkSync(outPath);
    throw new Error('VERIFY FAILED: patched bundle does not parse — output removed');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
