// Gabarito — motor do Mapa de conceitos (só lógica; nenhum conteúdo de prova aqui).
// Usado pelo app (window.CX) e pelo Tutor no repositório de conteúdo (cópia idêntica em conceitos/motor.js).
// Ao mudar este arquivo: subir CX.VERSION e copiar para o outro repositório.
//
// Dados: nodes = {id: {n: nome, g: grupo, k: "base"|"clin"|"cond"|"farm", pre: [ids de pré-requisito]}}
//        marks = {idDaQuestão: [conceito principal, secundário, ...]}   (1 a 3 por questão)
//        ev    = progress.ev = [[ts(s), idDaQuestão, acerto 0/1, revisão, segundos, alternativa], ...]
//
// Modelo (recalculado do zero a partir de ev, sem estado próprio; marcar questões depois reatribui o histórico):
//  1. Cada resposta vira evidência para os conceitos da questão: peso 1 no principal, W2 nos secundários.
//  2. Repetir a mesma questão vale menos (memória da resposta): REP_LONG se a anterior foi há mais de 7 dias, REP_SHORT se menos.
//  3. A evidência sobe aos pré-requisitos (até 2 níveis): acerto prova a base (UP_OK por nível); erro levanta suspeita (UP_BAD por nível).
//  4. Evidência envelhece com meia-vida HALF dias (o que foi provado há meses conta pouco).
//  5. Beta-Bernoulli: p = (a0 + acertos ponderados) / (a0 + b0 + peso total); domínio m = (p − G) / (1 − G), G = chance de chute.
//  6. Repetição espaçada por conceito: dias seguidos "bons" (≥ 70 % de acerto direto no dia) alongam o intervalo LADDER; dia ruim volta a 1 dia.
//  7. Necessidade de treino = fraqueza × confiança + atraso, multiplicada por importância (★) e proximidade de prova.
(function(root, factory){ if(typeof module==="object"&&module.exports) module.exports=factory(); else root.CX=factory(); })(typeof self!=="undefined"?self:this, function(){
  const DAY=86400000;
  const P={ VERSION:1, W2:0.6, REP_LONG:0.5, REP_SHORT:0.25, UP_OK:0.5, UP_BAD:0.3, HOPS:2, HALF:45, G:0.2, A0:0.72, B0:0.48,
            LADDER:[1,3,7,16,35,75], WEAK:0.5, GOOD:0.75, NMIN:0.6, NGOOD:3, TRAIN:10 };

  function build(nodes, marks){
    const N=new Map(), qc=new Map(), cq=new Map(), kids=new Map();
    for(const [id,o] of Object.entries(nodes||{})) N.set(id,{id,n:o.n||id,g:o.g||"",k:o.k||"clin",pre:(o.pre||[]).slice()});
    for(const c of N.values()){ c.pre=c.pre.filter(p=>N.has(p)&&p!==c.id); for(const p of c.pre){ if(!kids.has(p)) kids.set(p,[]); kids.get(p).push(c.id); } }
    for(const [q,cs] of Object.entries(marks||{})){ const L=[...new Set((cs||[]).filter(c=>N.has(c)))].slice(0,3); if(!L.length) continue; qc.set(q,L);
      for(const c of L){ if(!cq.has(c)) cq.set(c,[]); cq.get(c).push(q); } }
    // ancestrais até HOPS níveis: [[id, nível]]
    const anc=new Map(); for(const c of N.values()){ const out=new Map(); let fr=[c.id];
      for(let h=1;h<=P.HOPS;h++){ const nx=[]; for(const x of fr) for(const p of N.get(x).pre){ if(p!==c.id&&!out.has(p)){ out.set(p,h); nx.push(p); } } fr=nx; }
      anc.set(c.id,[...out]); }
    return {N,qc,cq,kids,anc};
  }

  // domínio por conceito. ev em ordem cronológica. Retorna Map id → estado.
  function mastery(G, ev, now){
    now=now||Date.now(); const st=new Map();
    const get=id=>{ let s=st.get(id); if(!s) st.set(id,s={id,a:P.A0,b:P.B0,w:0,dn:0,dok:0,derr:0,last:0,days:new Map(),src:new Map()}); return s; };
    const seen=new Map();
    for(const e of ev||[]){ const ts=e[0]*1000, q=e[1], ok=e[2]?1:0, cs=G.qc.get(q); if(!cs) continue;
      const prev=seen.get(q); seen.set(q,ts);
      const rep=prev==null?1:(ts-prev>7*DAY?P.REP_LONG:P.REP_SHORT);
      const dec=Math.pow(0.5,Math.max(0,now-ts)/(P.HALF*DAY));
      const up=new Map();
      cs.forEach((c,i)=>{ const w0=(i===0?1:P.W2)*rep, s=get(c), w=w0*dec; s.a+=w*ok; s.b+=w*(1-ok); s.w+=w;
        s.dn++; if(ok) s.dok++; else s.derr++; if(ts>s.last) s.last=ts;
        const dk=Math.floor(ts/DAY), d=s.days.get(dk)||[0,0]; d[0]+=w0; d[1]+=w0*ok; s.days.set(dk,d);
        if(!ok) s.src.set(q,ts);
        for(const [p,h] of G.anc.get(c)||[]){ const wp=w0*Math.pow(ok?P.UP_OK:P.UP_BAD,h); if(!(up.get(p)>=wp)) up.set(p,wp); } });
      for(const [p,wp] of up){ if(cs.includes(p)) continue; const s=get(p), w=wp*dec; s.a+=w*ok; s.b+=w*(1-ok); s.w+=w; }
    }
    const out=new Map();
    for(const c of G.N.values()){ const s=st.get(c.id)||{a:P.A0,b:P.B0,w:0,dn:0,dok:0,derr:0,last:0,days:new Map(),src:new Map()};
      const p=s.a/(s.a+s.b), m=Math.max(0,Math.min(1,(p-P.G)/(1-P.G)));
      const sd=Math.sqrt(s.a*s.b/((s.a+s.b)*(s.a+s.b)*(s.a+s.b+1)))/(1-P.G);
      // sequência de dias bons (do mais recente para trás)
      const ds=[...s.days.entries()].sort((x,y)=>y[0]-x[0]); let streak=0; for(const [,d] of ds){ if(d[1]/d[0]>=0.7) streak++; else break; }
      const iv=s.dn?P.LADDER[Math.min(streak,P.LADDER.length-1)]:0, due=s.dn?s.last+iv*DAY:0;
      const status=s.w<P.NMIN?"novo":m<P.WEAK?"fraco":(m>=P.GOOD&&s.w>=P.NGOOD)?"dominado":"instavel";
      out.set(c.id,{id:c.id,m,sd,w:s.w,n:s.dn,ok:s.dok,err:s.derr,last:s.last,streak,iv,due,overdue:!!(s.dn&&due<=now),status,errQ:[...s.src.keys()],nq:(G.cq.get(c.id)||[]).length});
    }
    return out;
  }

  // raízes suspeitas de um conceito: pré-requisitos (até 2 níveis) ainda não dominados, o menos dominado primeiro
  function roots(G, M, id){ return (G.anc.get(id)||[]).map(([p,h])=>({id:p,h,...pick(M.get(p))})).filter(r=>r.status!=="dominado").sort((a,b)=>a.h-b.h||a.m-b.m); }
  function pick(s){ return s?{m:s.m,w:s.w,status:s.status}:{m:0.5,w:0,status:"novo"}; }

  // ordem de treino. opt.imp(id) → 0..1 (importância média das questões do conceito); opt.exam(id) → dias até a prova mais próxima ou null
  function need(G, M, id, opt){ const s=M.get(id); if(!s||!s.nq) return 0; opt=opt||{};
    const conf=s.w/(s.w+1.5), base=(1-s.m)*conf+(s.overdue&&s.status!=="novo"?0.25:0);
    const imp=opt.imp?0.6+0.6*opt.imp(id):1; const d=opt.exam?opt.exam(id):null; const ex=d==null?1:1+Math.exp(-Math.max(0,d)/7);
    return base*imp*ex; }
  function rank(G, M, opt){ return [...G.N.keys()].map(id=>({id,need:need(G,M,id,opt)})).filter(x=>x.need>0.05).sort((a,b)=>b.need-a.need); }

  // raízes mais suspeitas no conjunto: bases com dependentes fracos
  function rootRank(G, M){ const out=[];
    for(const c of G.N.values()){ const kids=G.kids.get(c.id)||[]; if(!kids.length) continue; const s=M.get(c.id);
      const weak=kids.filter(k=>{ const x=M.get(k); return x&&x.status==="fraco"; }); if(!weak.length||s.status==="dominado") continue;
      out.push({id:c.id,weak,score:weak.reduce((t,k)=>t+(1-M.get(k).m),0)*(1-s.m*(s.w/(s.w+1.5)))}); }
    return out.sort((a,b)=>b.score-a.score); }

  // questões para "treinar este conceito". Q(id) → {src: chave da fonte, pri: 1–3} ou null se a questão não está disponível;
  // R(id) → {ok, ts} (último resultado) ou undefined. Mistura fontes, puxa a raiz suspeita e privilegia fonte diferente da que gerou o erro.
  function train(G, M, id, Q, R, now, n){ now=now||Date.now(); n=n||P.TRAIN; const s=M.get(id); if(!s) return [];
    const errSrc=new Set((s.errQ||[]).map(q=>Q(q)?.src).filter(Boolean));
    const score=(q,main)=>{ const o=Q(q); if(!o) return null; const r=R(q); let v;
      if(!r) v=3; else if(!r.ok) v=2.5; else v=(now-r.ts>21*DAY)?1:0;
      if(!errSrc.has(o.src)) v+=1.5; if((G.qc.get(q)||[])[0]===main) v+=0.5; v+=0.3*(o.pri||2); return {q,src:o.src,v}; };
    const pool=(cid)=>(G.cq.get(cid)||[]).map(q=>score(q,cid)).filter(Boolean).sort((a,b)=>b.v-a.v);
    const take=(list,k,used)=>{ const by=new Map(); for(const x of list){ if(used.has(x.q)) continue; if(!by.has(x.src)) by.set(x.src,[]); by.get(x.src).push(x); }
      const out=[]; const keys=[...by.keys()].sort((a,b)=>by.get(b)[0].v-by.get(a)[0].v);
      for(let r=0;out.length<k;r++){ let any=false; for(const s of keys){ const x=by.get(s)[r]; if(x&&out.length<k){ out.push(x.q); used.add(x.q); any=true; } } if(!any) break; }
      return out; };
    const used=new Set(), rs=roots(G,M,id).filter(r=>r.h===1).slice(0,2);
    const nRoot=rs.length?Math.min(3,Math.floor(n*0.3)):0;
    let out=take(pool(id),n-nRoot,used);
    for(const r of rs){ if(out.length>=n) break; out=out.concat(take(pool(r.id),Math.ceil(nRoot/rs.length),used)); }
    if(out.length<n) out=out.concat(take(pool(id),n-out.length,used));
    if(out.length<n) for(const k of G.kids.get(id)||[]){ if(out.length>=n) break; out=out.concat(take(pool(k),Math.min(2,n-out.length),used)); }
    return out.slice(0,n); }

  return {P,VERSION:P.VERSION,build,mastery,roots,need,rank,rootRank,train};
});
