// Teste de fumaça do Gabarito: abre cada tela com dados fictícios, responde questões e falha
// se houver erro de JavaScript. Uso: npx playwright@1 (ou NODE_PATH com playwright) → node tests/smoke.js
// Não usa o Supabase (o script é bloqueado) e não contém conteúdo real de provas.
const {chromium}=require("playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=path.join(__dirname,"..");
const day=86400000;
function fixture(){
  const exams=[{id:"P1",name:{pt:"P1 · 15/dez",en:"Exam 1"}},{id:"P2",name:{pt:"P2 · 20/dez",en:"Exam 2"}},{id:"FINAL",all:true,name:{pt:"Final · 30/dez",en:"Final"}}];
  const mk=(d,n)=>({id:d,name:{pt:n,en:n},exams,topics:["t1","t2","t3","t4"].map((t,i)=>({id:t,name:{pt:`${n} tema ${i+1}`,en:`${n} topic ${i+1}`},exam:i<2?"P1":"P2",subs:[{id:"s1",name:{pt:"Sub 1",en:"Sub 1"}},{id:"s2",name:{pt:"Sub 2",en:"Sub 2"}}]}))});
  const cat={disciplines:[{...mk("da","Disciplina A"),period:5},{...mk("db","Disciplina B"),period:4}]};
  cat.disciplines[0].topics[0].links=[{t:"pdf",n:"PDF fictício",p:"p. 1–2",id:"x1"},{t:"video",n:"Vídeo fictício",id:"x2"},{t:"folder",n:"Pasta fictícia",id:"x3"}];
  const qs=[]; let k=0;
  for(const d of ["da","db"]) for(const t of ["t1","t2","t3","t4"]) for(let i=0;i<6;i++){ k++;
    const usmle=i===5; const opts=[0,1,2,3,4].map(j=>({t:`Alternativa ${j} da questão ${k}`,why:j===i%5?"<b>Correta</b> porque sim.":"Errada.",more:"Detalhe."}));
    const L={stem:`Enunciado ${k} (${d}/${t})`,opts,peg:"<b>Memorize:</b> x",pegMore:"mais",src:"Fixture"};
    qs.push({id:`${d}-${t}-${usmle?"usmle":"ufpr"}-${i}`,discipline:d,topic:t,sub:i%2?"s2":"s1",standard:usmle?"usmle":"ufpr",step:usmle?"Step 1":null,origin:i<3&&!usmle?"real":"authored",exam:i<3&&!usmle?`P${t<"t3"?1:2} 23.1 · Q${k} · 22.2 · Q${k+1}`:null,exc:i===4,pri:(i%3)+1,correct:i%5,tags:{pt:["Tag"],en:["Tag"]},i18n:usmle?{en:L}:{pt:Object.assign({},L,i===2?{outdated:"Mudou."}:{}),en:L},reviewed:true,order:i,...(k===1?{img:{url:"icons/icon-192.png",alt:"Imagem de teste"}}:{})});
  }
  for(let i=0;i<3;i++){ const L={stem:`Banco fictício ${i}`,opts:[0,1,2,3].map(j=>({t:`Alt ${j}`,why:j===i%4?"<b>Correta.</b> Comentário fictício.":""})),peg:"",src:"Banco fictício"}; qs.push({id:`bk-${i}`,discipline:"da",topic:"t1",sub:"banco",standard:"banco",step:null,origin:"bank",exam:null,exc:false,pri:2,correct:i%4,tags:{pt:["Banco"]},i18n:{pt:L},reviewed:true,order:i+1}); }
  const lessons=[{id:"lesson:da:t1",kind:"lesson",discipline:"da",topic:"t1",title:"Lição de teste",minutes:5,sources:["Fixture"],html:'<aside class="call prova"><div class="ct">O que cai</div><p>x</p></aside><h2>1. Seção</h2><p>a</p><h2>2. Seção</h2><p>b</p><h2>3. Seção</h2><div class="tbl"><table class="stack"><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead><tbody><tr><td data-label="A">a</td><td data-label="B">b</td><td data-label="C">c</td></tr></tbody></table></div><ol class="flow"><li>um</li><li class="stop">fim</li></ol>'}];
  return {cat,qs,lessons};
}
(async()=>{
  const srv=http.createServer((req,res)=>{ let f=path.join(ROOT,decodeURIComponent(req.url.split("?")[0].split("#")[0])); if(f.endsWith("/")) f+="index.html"; fs.readFile(f,(e,b)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{"Content-Type":f.endsWith(".html")?"text/html":f.endsWith(".js")?"text/javascript":"application/octet-stream"}); res.end(b); }); }).listen(0);
  const base=`http://127.0.0.1:${srv.address().port}/index.html`;
  const b=await chromium.launch(); const errs=[]; let steps=0;
  for(const vp of [{width:390,height:844},{width:1024,height:768}]){
    const ctx=await b.newContext({viewport:vp}); const p=await ctx.newPage(); p.setDefaultTimeout(8000);
    await p.route(/supabase|fonts\.g/,r=>r.abort());
    p.on("pageerror",e=>errs.push(`[${vp.width}] ${e.message}`));
    p.on("console",m=>{ if(m.type()==="error"&&!/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errs.push(`[${vp.width}] console: ${m.text()}`); });
    await p.goto(base); await p.waitForTimeout(500);
    const F=fixture();
    await p.evaluate(F=>{ S.catalog=F.cat; F.qs.forEach(q=>S.qs.set(q.id,q)); F.lessons.forEach(l=>S.lessons.set(l.id,l)); S.dbState="on"; set().disc="da"; set().topic="t1";
      const t=Date.now(); F.qs.forEach((q,i)=>{ if(i%3) return; S.prog.q[q.id]={n:2,nOk:i%2,ok:!!(i%2),first:true,box:1,due:t-86400000,ts:t}; }); render(); },F);
    const step=async(name,fn)=>{ try{ await fn(); steps++; }catch(e){ errs.push(`[${vp.width}] ${name}: ${e.message.split("\n").slice(0,4).join(" | ")}`); } };
    for(const v of ["home","plan","study","review","cards","stats","bank"]) await step("view "+v, ()=>p.evaluate(v=>{ S.session=null; S.fcDeck=null; go(v); },v));
    for(const t of ["geral","provas","cobrados"]) await step("stats "+t, ()=>p.evaluate(t=>{ S.statsTab=t; go("stats"); render(); },t));
    await step("stats nome longo", async()=>{ const w=await p.evaluate(()=>{ const t=S.catalog.disciplines[0].topics[0], old=t.name; t.name={pt:"Fundamentos: fenomenologia, entrevista psiquiátrica e exame do estado mental completo",en:"x"}; S.statsTab="geral"; go("stats"); render(); const w=document.documentElement.scrollWidth-document.documentElement.clientWidth; t.name=old; return w; }); if(w>0) throw new Error("transborda "+w+"px"); });
    await step("links do tema", async()=>{ const n=await p.evaluate(()=>{ set().topic="t1"; S.session=null; go("home"); const a=document.querySelectorAll(".tlinks a").length; S.lessonId="lesson:da:t1"; go("lesson"); return [a,document.querySelectorAll(".tlinks a").length]; }); if(n[0]!==3||n[1]!==3) throw new Error("links "+n); });
    if(vp.width>=1000) await step("painel do material", async()=>{ await p.click(".tlinks summary"); await p.click('.tlinks a[data-mp]'); const ok=await p.evaluate(()=>document.body.classList.contains("mp-on")&&/\/preview$/.test(document.querySelector("#mpane iframe").src)); if(!ok) throw new Error("painel não abriu"); await p.click("[data-mpclose]"); if(await p.evaluate(()=>document.body.classList.contains("mp-on"))) throw new Error("painel não fechou"); });
    await step("study session", async()=>{ await p.evaluate(()=>{ S.session=null; S.studyTab="build"; go("study"); }); await p.click('[data-act="startSession"]'); await p.click('[data-pick="0"]'); });
    await step("image zoom", async()=>{ await p.evaluate(()=>{ S.session=null; S.setup=null; set().topic="t1"; go("study"); }); await p.click('[data-act="startSession"]'); const has=await p.evaluate(()=>!!document.querySelector('[data-act="imgZoom"]')); if(has){ await p.click('[data-act="imgZoom"]'); await p.waitForSelector(".zoomwrap img"); await p.goBack(); } await p.click('[data-pick="0"]'); });
    await step("report sheet", async()=>{ await p.click('[data-act="report"]'); await p.click('[data-act="repAlt"]:not([disabled])'); await p.click('[data-act="repSend"]'); });
    await step("lesson from question", async()=>{ await p.click('.tags [data-act="lesson"]'); await p.waitForSelector(".lesson"); await p.goBack(); });
    await step("topic picker", async()=>{ await p.evaluate(()=>{ S.session=null; S.setup=null; S.studyTab="build"; set().std="all"; set().topic="t1"; go("study"); }); await p.click('#selTopic'); await p.evaluate(()=>document.querySelectorAll("details.pg").forEach(g=>g.open=true)); await p.click('[data-act="pickTopic"][data-val="t3"]'); const t=await p.evaluate(()=>set().topic); if(t!=="t3") throw new Error("tema não trocou: "+t); await p.click('#selTopic'); await p.evaluate(()=>document.querySelectorAll("details.pg").forEach(g=>g.open=true)); await p.click('[data-act="pickTopic"][data-val="exam:P1"]'); await p.click('#suSub'); await p.click('[data-act="pickSub"][data-val="t2"]'); const su=await p.evaluate(()=>S.setup.sub); if(su!=="t2") throw new Error("subtema: "+su); await p.evaluate(()=>{ S.setup=null; set().topic="t1"; render(); }); });
    await step("keyboard", async()=>{ await p.evaluate(()=>{ S.session=null; S.setup=null; set().topic="t2"; go("study"); }); await p.click('[data-act="startSession"]'); await p.keyboard.press("b"); await p.keyboard.press("m"); await p.keyboard.press("Enter"); const i=await p.evaluate(()=>S.session.i); if(i!==1) throw new Error("Enter não avançou: "+i); await p.keyboard.press("?"); await p.waitForSelector(".krow"); await p.keyboard.press("Escape"); await p.evaluate(()=>{ S.session=null; S.fcDeck=null; go("cards"); document.querySelector('[data-act="fcStart"]')?.click(); }); await p.keyboard.press(" "); await p.keyboard.press("3"); });
    await step("bank table + lesson toc", async()=>{ await p.evaluate(()=>{ S.session=null; S.fcDeck=null; set().topic="t1"; go("bank"); }); if(vp.width>=1000){ await p.click('[data-act="bankSort"][data-val="acc"]'); await p.click('.btbl tbody tr'); await p.keyboard.press("Escape"); }
      await p.evaluate(()=>{ S.lessonId="lesson:da:t1"; go("lesson"); }); });
    await step("plano", async()=>{ await p.evaluate(()=>{ S.session=null; S.fcDeck=null; const f=new Date(Date.now()+20*86400000), k=dayKey(f); PL().dates={"da|P1":k,"da|P2":dayKey(new Date(Date.now()+40*86400000)),"db|P1":k}; PL().offDates=[dayKey(new Date(Date.now()+86400000))]; go("plan"); });
      const r=await p.evaluate(()=>{ const C=planCompute(); return {ex:C.exams.length,rows:document.querySelectorAll(".pday").length,items:document.querySelectorAll(".pday .pitem").length,fin:[...C.days.values()].flat().filter(i=>i.k==="final").length,offNew:(C.days.get(dayKey(new Date(Date.now()+86400000)))||[]).filter(i=>i.k==="new").length}; });
      if(r.ex<2||r.rows!==7||!r.items||!r.fin||r.offNew) throw new Error("plano: "+JSON.stringify(r));
      await p.click('[data-act="planWeek"][data-v="1"]'); await p.click('[data-act="planWeek"][data-v="0"]');
      await p.click('[data-act="planOff"]'); await p.click('[data-act="planCfg"]'); await p.waitForSelector("[data-pdate]"); await p.click('[data-act="planCap"][data-v="15"]'); await p.click('[data-act="planWd"][data-v="0"]'); await p.fill("#plOffD",await p.evaluate(()=>dayKey(new Date(Date.now()+5*86400000)))); await p.click('[data-act="planOffAdd"]'); await p.click('.sheet button[data-act="closeSheet"]');
      const sc=await p.evaluate(()=>PL().cap+"|"+PL().offWd); if(sc!=="15|0") throw new Error("config: "+sc);
      const ov=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth); if(ov>0) throw new Error("transborda "+ov+"px");
      await p.evaluate(()=>go("home")); if(!(await p.$(".plhome"))) throw new Error("sem contagem regressiva na tela inicial");
      await p.evaluate(()=>go("plan")); await p.evaluate(()=>{ document.querySelectorAll(".ptps").forEach(d=>d.open=true); }); await p.click('[data-act="planStudy"]'); const v=await p.evaluate(()=>S.view); if(v!=="study") throw new Error("planStudy: "+v);
      await p.evaluate(()=>{ go("plan"); }); const rv=await p.$('[data-act="planRev"]'); if(rv){ await rv.click(); const v2=await p.evaluate(()=>S.view+":"+(S.session?.items.length||0)); if(!v2.startsWith("review:")||v2.endsWith(":0")) throw new Error("planRev: "+v2); }
      await p.evaluate(()=>{ S.session=null; PL().offWd=[]; PL().offDates=[]; PL().cap=30; go("home"); }); });
    await step("pdf da lição", async()=>{ const r=await p.evaluate(async()=>{ const f=await lessonPdf(S.lessons.get("lesson:da:t1")); const h=new Uint8Array(await f.slice(0,5).arrayBuffer()); return {n:f.name,s:f.size,h:String.fromCharCode(...h),pages:(new TextDecoder("latin1").decode(await f.arrayBuffer()).match(/\/Type \/Page /g)||[]).length}; });
      if(!r.n.endsWith(".pdf")||r.s<10240||r.h!=="%PDF-"||r.pages<2) throw new Error("PDF inválido: "+JSON.stringify(r)); });
    await step("pdf da disciplina", async()=>{ const r=await p.evaluate(async()=>{ const fs=await discPdfFiles("da"); const f=fs[fs.length-1]; const h=new Uint8Array(await f.slice(0,5).arrayBuffer()); const nq=fs.slice(0,-1).filter(x=>x.name.endsWith("99 Questões.pdf")).length; return {n:fs.length,last:f.name,h:String.fromCharCode(...h),nq}; });
      if(!r.last.endsWith("99 Questões.pdf")||r.h!=="%PDF-"||r.nq||r.n<2) throw new Error("pacote inválido: "+JSON.stringify(r)); });
    await step("botão estudar no tablet", async()=>{ await p.evaluate(()=>{ S.lessonId="lesson:da:t1"; go("lesson"); }); const dl=p.waitForEvent("download",{timeout:20000}); await p.click('[data-act="lessonPdf"]'); const d=await dl; if(!d.url().startsWith("blob:")) throw new Error("download: "+d.url()); });
    await step("priority", async()=>{ await p.evaluate(()=>{ S.session=null; S.setup=null; set().topic="t1"; go("home"); }); const b=await p.$('[data-act="examEssentials"]'); if(b){ await b.click(); } await p.evaluate(()=>{ S.session=null; S.setup=null; go("study"); }); await p.click('[data-su="prio"][data-val="3"]'); await p.click('[data-su="order"][data-val="pri"]'); await p.click('[data-act="startSession"]'); const ok=await p.evaluate(()=>S.session.items.every(it=>S.qs.get(it.id).pri===3)); if(!ok) throw new Error("filtro ★★★ falhou"); });
    await step("full exam sim", async()=>{ await p.evaluate(()=>{ S.session=null; S.studyTab="full"; go("study"); }); await p.click('[data-act="fullExam"][data-mode="sim"]'); await p.click('[data-pick="1"]'); });
    await step("review session", ()=>p.evaluate(()=>{ S.session=null; go("review"); document.querySelector('[data-act="startReview"]')?.click(); }));
    await step("flashcards", ()=>p.evaluate(()=>{ S.session=null; S.fcDeck=null; go("cards"); document.querySelector('[data-act="fcStart"]')?.click(); }));
    await step("banco", ()=>p.evaluate(()=>{ set().std="banco"; S.session=null; go("home"); go("stats"); go("bank"); const n=discQs().length; if(n!==3) throw new Error("banco deveria ter 3 questões: "+n); set().std="all"; if(discQs().some(q=>q.standard==="banco")) throw new Error("Ambos não pode incluir banco"); }));
    await step("usmle + dark", ()=>p.evaluate(()=>{ set().std="usmle"; set().theme="dark"; applyTheme(); S.session=null; go("home"); go("stats"); }));
    await step("period select", async()=>{ await p.evaluate(()=>{ S.session=null; go("home"); }); await p.selectOption("#selPer","4"); const a=await p.evaluate(()=>[curDisc()?.id, discs().length]); if(a[0]!=="db"||a[1]!==1) throw new Error("período 4: "+a); await p.selectOption("#selPer","all"); const n=await p.evaluate(()=>discs().length); if(n!==2) throw new Error("todos: "+n); await p.evaluate(()=>go("stats")); await p.selectOption("#selPer","5"); const c=await p.evaluate(()=>curDisc()?.id); if(c!=="da") throw new Error("período 5: "+c); });
    await step("busca", async()=>{
      await p.evaluate(()=>{ S.session=null; S.fcDeck=null; window.SINONIMOS=[["zzsig","alternativa","option"]]; Object.assign(S.srch,{text:"",more:{}}); S.srch.f={per:"all",std:"all",real:false,st:"all",pri:0}; go("home"); });
      await p.click('[data-act="search"]'); await p.waitForSelector("#srQ");
      const q=async t=>{ await p.fill("#srQ",t); await p.waitForFunction(t=>S.srch.text===t&&!document.querySelector("#srRes .empty:not(.x)")||S.srch.text===t,t); await p.waitForTimeout(350); return p.evaluate(()=>{ const R=S.srRes; return R?{nq:R.nq,nl:R.nl,nt:R.nt,fz:R.P.notes.fuzzy,sy:R.P.notes.syn,ids:R.ids}:null; }); };
      let r=await q("enunciado"); if(!r||r.nq!==48) throw new Error("exato: "+JSON.stringify(r&&{nq:r.nq}));
      r=await q("ENUNCIÀDO"); if(r?.nq!==48) throw new Error("acento/caixa: "+r?.nq);
      r=await q("enunciadu"); if(r?.nq!==48||!r.fz.length) throw new Error("typo: "+JSON.stringify(r&&{nq:r.nq,fz:r.fz}));
      r=await q("enuncaido"); if(r?.nq!==48) throw new Error("transposição: "+r?.nq);
      r=await q("zzsig"); if(!r||r.nq<48||!r.sy.length) throw new Error("sinônimo: "+JSON.stringify(r&&{nq:r.nq,sy:r.sy}));
      r=await q("enunciado da/t1"); if(r?.nq!==12) throw new Error("e lógico: "+r?.nq);
      r=await q("secao"); if(!r||!r.nl) throw new Error("lição: "+JSON.stringify(r));
      await p.click('[data-act="srLesson"]'); await p.waitForSelector(".lesson mark.srh");
      await p.goBack(); await p.waitForSelector("#srQ");
      r=await q("enunciado"); await p.evaluate(()=>{ document.querySelector("#srFSum").parentElement.open=true; }); await p.click('[data-act="srF"][data-sk="real"][data-sv="true"]'); let n=await p.evaluate(()=>S.srRes.nq); if(!n||n>=48) throw new Error("filtro real: "+n);
      await p.click('[data-act="srF"][data-sk="std"][data-sv="usmle"]'); n=await p.evaluate(()=>S.srRes.nq); if(n!==0) throw new Error("real+usmle deveria zerar: "+n);
      await p.evaluate(()=>{ S.srch.f={per:"all",std:"all",real:false,st:"all",pri:0}; srRefresh(true); });
      await p.click('[data-act="srStudy"][data-n="20"]'); const ss=await p.evaluate(()=>({from:S.session.from,v:S.view,n:S.session.items.length,pri:S.session.items.map(it=>S.qs.get(it.id).pri)}));
      if(ss.from!=="search"||ss.v!=="study"||ss.n!==20||ss.pri.some((x,i)=>i&&x>ss.pri[i-1])) throw new Error("simulado da busca: "+JSON.stringify(ss));
      await p.click('[data-act="exit"]'); if(await p.evaluate(()=>S.view)!=="search") throw new Error("sair não voltou à busca");
      await p.keyboard.press("Escape"); await p.click('[data-act="srClose"]');
      await p.evaluate(()=>{ S.session=null; go("home"); }); await p.keyboard.press("/"); await p.waitForSelector("#srQ");
      await p.evaluate(()=>{ S.srch.text=""; go("home"); }); });
    await step("settings sheet", async()=>{ await p.evaluate(()=>{ S.session=null; go("home"); }); await p.click("#btnSettings"); await p.goBack(); });
    await ctx.close();
  }
  await b.close(); srv.close();
  if(errs.length){ console.error("FALHOU:\n"+errs.join("\n")); process.exit(1); }
  console.log(`OK — ${steps} passos sem erro`);
})().catch(e=>{ console.error(e); process.exit(1); });
