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
  const cat={disciplines:[mk("da","Disciplina A"),mk("db","Disciplina B")]};
  const qs=[]; let k=0;
  for(const d of ["da","db"]) for(const t of ["t1","t2","t3","t4"]) for(let i=0;i<6;i++){ k++;
    const usmle=i===5; const opts=[0,1,2,3,4].map(j=>({t:`Alternativa ${j} da questão ${k}`,why:j===i%5?"<b>Correta</b> porque sim.":"Errada.",more:"Detalhe."}));
    const L={stem:`Enunciado ${k} (${d}/${t})`,opts,peg:"<b>Memorize:</b> x",pegMore:"mais",src:"Fixture"};
    qs.push({id:`${d}-${t}-${usmle?"usmle":"ufpr"}-${i}`,discipline:d,topic:t,sub:i%2?"s2":"s1",standard:usmle?"usmle":"ufpr",step:usmle?"Step 1":null,origin:i<3&&!usmle?"real":"authored",exam:i<3&&!usmle?`P${t<"t3"?1:2} 23.1 · Q${k} · 22.2 · Q${k+1}`:null,exc:i===4,correct:i%5,tags:{pt:["Tag"],en:["Tag"]},i18n:usmle?{en:L}:{pt:Object.assign({},L,i===2?{outdated:"Mudou."}:{}),en:L},reviewed:true,order:i,...(k===1?{img:{url:"icons/icon-192.png",alt:"Imagem de teste"}}:{})});
  }
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
    const step=async(name,fn)=>{ try{ await fn(); steps++; }catch(e){ errs.push(`[${vp.width}] ${name}: ${e.message.split("\n")[0]}`); } };
    for(const v of ["home","study","review","cards","stats","bank"]) await step("view "+v, ()=>p.evaluate(v=>{ S.session=null; S.fcDeck=null; go(v); },v));
    for(const t of ["geral","provas","cobrados"]) await step("stats "+t, ()=>p.evaluate(t=>{ S.statsTab=t; go("stats"); render(); },t));
    await step("study session", async()=>{ await p.evaluate(()=>{ S.session=null; S.studyTab="build"; go("study"); }); await p.click('[data-act="startSession"]'); await p.click('[data-pick="0"]'); });
    await step("image zoom", async()=>{ await p.evaluate(()=>{ S.session=null; S.setup=null; set().topic="t1"; go("study"); }); await p.click('[data-act="startSession"]'); const has=await p.evaluate(()=>!!document.querySelector('[data-act="imgZoom"]')); if(has){ await p.click('[data-act="imgZoom"]'); await p.waitForSelector(".zoomwrap img"); await p.goBack(); } await p.click('[data-pick="0"]'); });
    await step("report sheet", async()=>{ await p.click('[data-act="report"]'); await p.click('[data-act="repAlt"]:not([disabled])'); await p.click('[data-act="repSend"]'); });
    await step("lesson from question", async()=>{ await p.click('.tags [data-act="lesson"]'); await p.waitForSelector(".lesson"); await p.goBack(); });
    await step("topic picker", async()=>{ await p.evaluate(()=>{ S.session=null; S.setup=null; S.studyTab="build"; set().std="all"; set().topic="t1"; go("study"); }); await p.click('#selTopic'); await p.evaluate(()=>document.querySelectorAll("details.pg").forEach(g=>g.open=true)); await p.click('[data-act="pickTopic"][data-val="t3"]'); const t=await p.evaluate(()=>set().topic); if(t!=="t3") throw new Error("tema não trocou: "+t); await p.click('#selTopic'); await p.evaluate(()=>document.querySelectorAll("details.pg").forEach(g=>g.open=true)); await p.click('[data-act="pickTopic"][data-val="exam:P1"]'); await p.click('#suSub'); await p.click('[data-act="pickSub"][data-val="t2"]'); const su=await p.evaluate(()=>S.setup.sub); if(su!=="t2") throw new Error("subtema: "+su); await p.evaluate(()=>{ S.setup=null; set().topic="t1"; render(); }); });
    await step("keyboard", async()=>{ await p.evaluate(()=>{ S.session=null; S.setup=null; set().topic="t2"; go("study"); }); await p.click('[data-act="startSession"]'); await p.keyboard.press("b"); await p.keyboard.press("m"); await p.keyboard.press("Enter"); const i=await p.evaluate(()=>S.session.i); if(i!==1) throw new Error("Enter não avançou: "+i); await p.keyboard.press("?"); await p.waitForSelector(".krow"); await p.keyboard.press("Escape"); await p.evaluate(()=>{ S.session=null; S.fcDeck=null; go("cards"); document.querySelector('[data-act="fcStart"]')?.click(); }); await p.keyboard.press(" "); await p.keyboard.press("3"); });
    await step("bank table + lesson toc", async()=>{ await p.evaluate(()=>{ S.session=null; S.fcDeck=null; set().topic="t1"; go("bank"); }); if(vp.width>=1000){ await p.click('[data-act="bankSort"][data-val="acc"]'); await p.click('.btbl tbody tr'); await p.keyboard.press("Escape"); }
      await p.evaluate(()=>{ S.lessonId="lesson:da:t1"; go("lesson"); }); });
    await step("full exam sim", async()=>{ await p.evaluate(()=>{ S.session=null; S.studyTab="full"; go("study"); }); await p.click('[data-act="fullExam"][data-mode="sim"]'); await p.click('[data-pick="1"]'); });
    await step("review session", ()=>p.evaluate(()=>{ S.session=null; go("review"); document.querySelector('[data-act="startReview"]')?.click(); }));
    await step("flashcards", ()=>p.evaluate(()=>{ S.session=null; S.fcDeck=null; go("cards"); document.querySelector('[data-act="fcStart"]')?.click(); }));
    await step("usmle + dark", ()=>p.evaluate(()=>{ set().std="usmle"; set().theme="dark"; applyTheme(); S.session=null; go("home"); go("stats"); }));
    await step("settings sheet", async()=>{ await p.evaluate(()=>{ S.session=null; go("home"); }); await p.click("#btnSettings"); await p.goBack(); });
    await ctx.close();
  }
  await b.close(); srv.close();
  if(errs.length){ console.error("FALHOU:\n"+errs.join("\n")); process.exit(1); }
  console.log(`OK — ${steps} passos sem erro`);
})().catch(e=>{ console.error(e); process.exit(1); });
