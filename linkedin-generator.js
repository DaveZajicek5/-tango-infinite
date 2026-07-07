(() => {
  'use strict';
  const E = window.TangoEngine;
  if (!E || E.__liGenerator) return;
  const oldGenerate = E.generatePuzzle;
  const N = E.N;
  const ABC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-';
  const RATING_KEY = 'tangoGeneratorRatingsV1';
  const modes = [
    { id: 'hybrid', label: 'LI mix' }, { id: 'skeleton', label: 'LI skeleton' },
    { id: 'mutant', label: 'LI mutant' }, { id: 'grammar', label: 'LI grammar' },
    { id: 'archive', label: 'Archive replay' }, { id: 'original', label: 'Old generator' }
  ];
  const rint = (a,b)=>a+Math.floor(Math.random()*(b-a+1));
  const pick = a=>a[Math.floor(Math.random()*a.length)];
  const shuf = a=>E.shuffle(a.slice());
  const ix = (r,c)=>E.cellIndex(r,c);
  const rc = i=>[Math.floor(i/N),i%N];
  const un = ch=>Math.max(0,ABC.indexOf(ch));
  const sol = ()=>pick((E.NICE_BOARDS&&E.NICE_BOARDS.length)?E.NICE_BOARDS:E.ALL_BOARDS);

  function ratings(){ try{ const x=JSON.parse(localStorage.getItem(RATING_KEY)||'[]'); return Array.isArray(x)?x:[]; }catch(_){ return []; } }
  function avg(rows){ return rows.length ? rows.reduce((s,r)=>s+Number(r.rating||0),0)/rows.length : null; }
  function modeAvg(id){ return avg(ratings().filter(r=>(r.generator||r.selectedMode)===id)); }
  function seedAvg(gen,n){ return avg(ratings().filter(r=>r.generator===gen && Number(r.archiveId)===Number(n))); }
  function weightFromAvg(a){ if(a==null) return 1; if(a>=4.75) return 2.5; if(a>=4.25) return 1.75; if(a>=3.75) return 1.15; if(a<=2.5) return 0.18; if(a<=3.25) return 0.55; return 0.85; }
  function weightedPick(items, weightFn){
    if(!items.length) return null;
    let total=0; const ws=items.map(x=>{ const w=Math.max(0.01, weightFn(x)||1); total+=w; return w; });
    let r=Math.random()*total;
    for(let i=0;i<items.length;i++){ r-=ws[i]; if(r<=0) return items[i]; }
    return items[items.length-1];
  }

  function parsePack(){
    if (parsePack.cache) return parsePack.cache;
    const pack = window.LI_TANGO_LAYOUT_PACK || '';
    parsePack.cache = pack.split(';').filter(Boolean).map(x=>{
      const [n,s,g,e=''] = x.split(':');
      const edges=[];
      for(let i=0;i+2<e.length;i+=3){ const o=un(e[i]); edges.push({r:Math.floor(o/N),c:o%N,d:e[i+1],same:e[i+2]==='1'}); }
      return {n:+n,s,g:[...(g||'')].map(un),e:edges};
    }).filter(x=>x.s&&x.s.length===36&&x.g.length&&x.e.length);
    return parsePack.cache;
  }
  function ends(e){ const a=ix(e.r,e.c); return [a, e.d==='h'?a+1:a+N]; }
  function clues(givens,signs){ const out=[]; givens.forEach((v,i)=>{if(v!=null)out.push({t:'g',i,v});}); return out.concat(signs); }
  function cellT(i,t){ let [r,c]=rc(i); if(t===1)return ix(c,5-r); if(t===2)return ix(5-r,5-c); if(t===3)return ix(5-c,r); if(t===4)return ix(r,5-c); if(t===5)return ix(5-r,c); if(t===6)return ix(c,r); if(t===7)return ix(5-c,5-r); return i; }
  function edgeT(a,b){ const [ar,ac]=rc(a),[br,bc]=rc(b); if(ar===br&&Math.abs(ac-bc)===1)return{r:ar,c:Math.min(ac,bc),d:'h'}; if(ac===bc&&Math.abs(ar-br)===1)return{r:Math.min(ar,br),c:ac,d:'v'}; }
  function trans(L,t){ const g=[...new Set(L.g.map(i=>cellT(i,t)))], e=[], seen=new Set(); for(const s of L.e){ const [a,b]=ends(s), q=edgeT(cellT(a,t),cellT(b,t)); if(!q)continue; const k=`${q.r},${q.c},${q.d}`; if(!seen.has(k)){seen.add(k);e.push(q);} } return {n:L.n,g,e}; }
  function allEdges(){ const a=[]; for(let r=0;r<6;r++)for(let c=0;c<5;c++)a.push({r,c,d:'h'}); for(let r=0;r<5;r++)for(let c=0;c<6;c++)a.push({r,c,d:'v'}); return a; }
  function touch(e,g){ return ends(e).some(i=>g.has(i)); }
  function make(L,S,label,meta){
    const giv=Array(36).fill(null); for(const i of L.g) if(i>=0&&i<36) giv[i]=S[i];
    const signs=[], seen=new Set();
    for(const e of L.e){ if(e.r<0||e.c<0||e.r>5||e.c>5||(e.d==='h'&&e.c>4)||(e.d==='v'&&e.r>4))continue; const k=`${e.r},${e.c},${e.d}`; if(seen.has(k))continue; seen.add(k); const [a,b]=ends(e); signs.push({t:'s',r:e.r,c:e.c,d:e.d,same:S[a]===S[b]}); }
    return Object.assign(E.puzzleFromParts(giv,signs,S,label),meta);
  }
  function hiddenRate(p){ return p.signs.length ? p.signs.filter(s=>ends(s).every(i=>p.givens[i]==null)).length/p.signs.length : 0; }
  function emptyLines(g){ let rows=0,cols=0; for(let r=0;r<6;r++) if(!g.slice(r*6,r*6+6).some(v=>v!=null)) rows++; for(let c=0;c<6;c++){let h=false;for(let r=0;r<6;r++) if(g[ix(r,c)]!=null)h=true; if(!h)cols++;} return rows+cols; }
  function ok(p,opt={}){ if(!E.uniquelySolvable(clues(p.givens,p.signs),p.sol))return false; const tr=E.solveProfile(p); p.profile=tr; return tr.ok && (tr.abstractLine||0)<=(opt.abs??6) && (tr.relation||0)<=(opt.rel??24) && hiddenRate(p)>=(opt.hid??0.7); }
  function score(p){ return 120-Math.abs(p.givenCount-9)*4-Math.min(Math.abs(p.signCount-4),Math.abs(p.signCount-6),Math.abs(p.signCount-8))*5-Math.abs(emptyLines(p.givens)-4)*4+hiddenRate(p)*18-(p.profile?.abstractLine||0)*4; }
  function best(factory,n,opt){ let b=null,bs=-1e9; for(let i=0;i<n;i++){ const p=factory(); if(!p||!ok(p,opt))continue; const s=score(p); p.linkedinScore=Math.round(s); if(s>bs){b=p;bs=s;} if(s>112&&Math.random()<.25)return p; } return b; }
  function mutate(L){ const g=new Set(L.g), e=L.e.slice(), cells=[...Array(36).keys()]; if(g.size>4&&Math.random()<.45)g.delete(pick([...g])); if(g.size<14&&Math.random()<.82)g.add(pick(cells)); const gs=new Set(g), used=new Set(e.map(x=>`${x.r},${x.c},${x.d}`)); for(const ed of shuf(allEdges())){ if(e.length>=10||Math.random()<.42)break; const k=`${ed.r},${ed.c},${ed.d}`; if(!used.has(k)&&!touch(ed,gs)){used.add(k);e.push(ed);} } return {n:L.n,g:[...g],e}; }
  function baseWeight(gen,L){ return weightFromAvg(seedAvg(gen,L.n)) * weightFromAvg(seedAvg('skeleton',L.n)) * weightFromAvg(seedAvg('mutant',L.n)); }
  function skeleton(mut=false){
    const bank=parsePack(); if(!bank.length)return null; const gen=mut?'mutant':'skeleton';
    return best(()=>{const base=weightedPick(bank,L=>baseWeight(gen,L)); const L=mut?mutate(trans(base,rint(0,7))):trans(base,rint(0,7)); return make(L,sol(),mut?`LI mutant #${base.n}`:`LI skeleton #${base.n}`,{generator:gen,source:'li',archiveId:base.n});},mut?240:150,{hid:mut?.72:.85,abs:mut?5:4});
  }
  function grammar(){ return best(()=>{ const g=new Set(), kind=pick(['block','band','diag','sparse']); if(kind==='block'){let r=rint(0,3),c=rint(0,3); for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++){g.add(ix(r+dr,c+dc));g.add(ix(5-r-dr,5-c-dc));}} else if(kind==='band'){let col=Math.random()<.5;let b=pick([0,1,4,5]);for(let k=0;k<6;k++)if(Math.random()<.7)g.add(col?ix(k,b):ix(b,k));} else if(kind==='diag'){for(let r=0;r<6;r++)if(Math.random()<.75)g.add(ix(r,Math.random()<.5?r:5-r));} else while(g.size<rint(4,8))g.add(ix(rint(0,5),rint(0,5))); while(g.size<4)g.add(ix(rint(0,5),rint(0,5))); while(g.size>14)g.delete(pick([...g])); const gs=new Set(g), e=[]; for(const ed of shuf(allEdges()).filter(x=>!touch(x,gs))){ if(e.length>=pick([4,6,6,8,10]))break; e.push(ed); } return make({g:[...g],e},sol(),'LI grammar',{generator:'grammar',source:'grammar'});},300,{hid:.8,abs:6,rel:24}); }
  function archive(){ const bank=parsePack(); if(!bank.length)return null; return best(()=>{const L=weightedPick(bank,x=>baseWeight('archive',x)); return make(L,L.s,`Archive #${L.n}`,{generator:'archive',source:'archive',archiveId:L.n});},80,{hid:0,abs:9,rel:30}); }
  function mode(){ try{const m=localStorage.getItem('tangoGenerator'); if(modes.some(x=>x.id===m))return m;}catch(_){} return 'hybrid'; }
  function hybridPick(){
    const opts=[['mutant',0.48],['skeleton',0.35],['grammar',0.17]].map(([id,w])=>({id,w:w*weightFromAvg(modeAvg(id))}));
    return weightedPick(opts,x=>x.w).id;
  }
  function gen(m=mode()){
    if(m==='original')return oldGenerate(); if(m==='archive')return archive()||oldGenerate(); if(m==='skeleton')return skeleton(false)||oldGenerate(); if(m==='mutant')return skeleton(true)||skeleton(false)||oldGenerate(); if(m==='grammar')return grammar()||skeleton(false)||oldGenerate();
    const choice=hybridPick(); if(choice==='mutant') return skeleton(true)||skeleton(false)||grammar()||oldGenerate(); if(choice==='skeleton') return skeleton(false)||skeleton(true)||grammar()||oldGenerate(); return grammar()||skeleton(true)||skeleton(false)||oldGenerate();
  }
  E.generatePuzzle=()=>gen();
  E.generatorModes=modes;
  E.setGeneratorMode=id=>{ if(!modes.some(x=>x.id===id))throw Error('Unknown generator '+id); localStorage.setItem('tangoGenerator',id); return id; };
  E.currentGeneratorMode=mode;
  E.ratingAverages=()=>{ const out={}; for(const m of ['mutant','skeleton','grammar','archive']) out[m]=modeAvg(m); return out; };
  E.debugGenerate=(count=20,m=mode())=>{const rows=[]; for(let i=0;i<count;i++){const p=gen(m); rows.push({mode:p.generator,label:p.mode,given:p.givenCount,signs:p.signCount,score:p.linkedinScore,steps:p.profile?.steps,rel:p.profile?.relation,abs:p.profile?.abstractLine});} console.table(rows); return rows;};
  E.__liGenerator = true;
})();