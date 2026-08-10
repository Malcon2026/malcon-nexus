const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function galleryHtml(feedBase: string, token: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>Malcon Gallery</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
:root{--bg:#09090b;--surface:rgba(24,24,27,.85);--border:rgba(255,255,255,.08);--text:#fafafa;--muted:#a1a1aa;--att:#22d3ee;--case:#a78bfa}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100dvh;background-image:radial-gradient(ellipse 80% 50% at 50% -20%,rgba(34,211,238,.08),transparent)}
.shell{max-width:720px;margin:0 auto;padding:0 16px 48px}
.hdr{position:sticky;top:0;z-index:20;padding:14px 0;border-bottom:1px solid var(--border);background:rgba(9,9,11,.85);backdrop-filter:blur(16px)}
.hdr-in{display:flex;align-items:center;gap:12px;max-width:720px;margin:0 auto;padding:0 16px}
.logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#22d3ee,#a78bfa);display:grid;place-items:center;font-size:14px}
.hdr h1{font-size:15px;font-weight:600}.hdr p{font-size:12px;color:var(--muted)}
.back{display:none;border:1px solid var(--border);background:var(--surface);color:var(--text);padding:8px 12px;border-radius:999px;font:500 13px Inter,sans-serif;cursor:pointer}
.back.show{display:inline-block}
.hero{padding:28px 0 8px}.hero h2{font-size:1.6rem;font-weight:700;letter-spacing:-.03em}.hero p{margin-top:8px;font-size:14px;color:var(--muted)}
.sec{margin-top:28px}.sec-h{display:flex;justify-content:space-between;margin-bottom:12px;font-size:13px;font-weight:600}
.album{display:flex;align-items:center;gap:14px;padding:10px;border:1px solid var(--border);border-radius:16px;background:var(--surface);cursor:pointer;margin-bottom:8px;transition:.2s}
.album:hover{border-color:rgba(255,255,255,.15);transform:translateY(-1px)}
.album.att{border-left:3px solid var(--att)}.album.case{border-left:3px solid var(--case)}
.thumbs{position:relative;width:56px;height:56px;flex-shrink:0}
.thumbs img,.ph{position:absolute;width:48px;height:48px;border-radius:10px;object-fit:cover;border:2px solid var(--bg)}
.thumbs img:nth-child(1){top:0;left:0;z-index:3}.thumbs img:nth-child(2){top:4px;left:4px;z-index:2;opacity:.7;transform:scale(.92)}.thumbs img:nth-child(3){top:8px;left:8px;z-index:1;opacity:.45;transform:scale(.84)}
.ph{display:grid;place-items:center;background:#27272a;color:#71717a;font-size:18px}
.album h3{font-size:15px;font-weight:600}.album p{font-size:12px;color:var(--muted);margin-top:2px}
.badge{min-width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-weight:700;font-size:14px}
.album.att .badge{background:rgba(34,211,238,.12);color:var(--att)}.album.case .badge{background:rgba(167,139,250,.12);color:var(--case)}
.chip{font-size:10px;font-weight:600;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:rgba(34,211,238,.15);color:var(--att);margin-left:6px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;border-radius:16px;overflow:hidden;background:var(--border)}
@media(min-width:520px){.grid{grid-template-columns:repeat(4,1fr);gap:4px}}
.cell{aspect-ratio:1;background:#18181b;cursor:pointer;overflow:hidden;position:relative}
.cell img{width:100%;height:100%;object-fit:cover;transition:transform .3s}.cell:hover img{transform:scale(1.05)}
.banner{padding:14px 16px;border-radius:16px;border:1px solid var(--border);background:var(--surface);margin-bottom:16px}
.pill{display:inline-block;font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;margin-bottom:8px}
.pill.att{background:rgba(34,211,238,.12);color:var(--att)}.pill.case{background:rgba(167,139,250,.12);color:var(--case)}
.lb{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.95);display:none;flex-direction:column;align-items:center;justify-content:center}
.lb.open{display:flex}
.lb img{max-width:min(92vw,720px);max-height:62vh;object-fit:contain;border-radius:8px}
.lb-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;padding:16px}
.lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:#fff;font-size:22px;cursor:pointer}
.lb-prev{left:12px}.lb-next{right:12px}
.lb-info{position:absolute;bottom:0;left:0;right:0;padding:24px;text-align:center;background:linear-gradient(transparent,rgba(0,0,0,.8))}
.err{margin:24px;padding:16px;border-radius:12px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;font-size:14px}
.load{text-align:center;padding:48px;color:var(--muted)}
.hidden{display:none}
.note{margin-top:32px;padding:14px;border-radius:12px;border:1px solid var(--border);font-size:12px;color:#71717a;line-height:1.6}
</style>
</head>
<body>
<header class="hdr"><div class="hdr-in">
<button type="button" class="back" id="backBtn">← Albums</button>
<div class="logo" id="logo">◆</div>
<div><h1 id="title">Malcon Gallery</h1><p id="sub">Attendance &amp; case photos</p></div>
</div></header>
<main class="shell">
<div id="loading" class="load">Loading albums…</div>
<div id="error" class="err hidden"></div>
<div id="home" class="hidden">
<div class="hero"><h2>Photo albums</h2><p>Punch-in selfies and case stage photos by date.</p></div>
<div class="sec"><div class="sec-h"><span>📸 Attendance</span><span id="attTotal" style="color:var(--muted);font-weight:500"></span></div><div id="attList"></div></div>
<div class="sec"><div class="sec-h"><span>📁 Cases</span><span id="caseTotal" style="color:var(--muted);font-weight:500"></span></div><div id="caseList"></div></div>
<p class="note">Attendance selfies ~24h in cloud. Case photos ~30 days. Older photos may be on office PC.</p>
</div>
<div id="view" class="hidden"><div class="banner" id="banner"></div><div class="grid" id="grid"></div></div>
</main>
<div class="lb" id="lb">
<div class="lb-top"><span id="lbCount" style="color:var(--muted);font-size:13px"></span><button class="lb-nav" style="position:static;width:40px;height:40px" id="lbClose">×</button></div>
<button class="lb-nav lb-prev" id="lbPrev">‹</button>
<img id="lbImg" alt=""/>
<button class="lb-nav lb-next" id="lbNext">›</button>
<div class="lb-info"><h4 id="lbCap"></h4><p id="lbSub" style="color:var(--muted);font-size:13px;margin-top:4px"></p></div>
</div>
<script>
const TOKEN=${JSON.stringify(token)};
const FEED=${JSON.stringify(feedBase)};
let todayKey='', albums=[], photos=[], open=null, lbIdx=0;

function titleFor(dk){if(dk===todayKey)return'Today';const y=new Date();y.setDate(y.getDate()-1);const yk=y.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});if(dk===yk)return'Yesterday';const [y,m,d]=dk.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})}
function labelFor(dk){const [y,m,d]=dk.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'})}
function timeIST(iso){return new Date(iso).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true})}

function albumRow(type,a){
  const n=type==='att'?a.attCount:a.caseCount;const thumbs=type==='att'?a.attThumbs:a.caseThumbs;
  const isToday=a.dateKey===todayKey;const t=titleFor(a.dateKey);
  const thumbHtml=thumbs.length?thumbs.slice(0,3).map((u,i)=>'<img src="'+u+'" alt="" loading="lazy" style="'+(i?'top:'+(i*4)+'px;left:'+(i*4)+'px;':'')+'"/>').join(''):'<div class="ph">'+(type==='att'?'📸':'📁')+'</div>';
  return '<article class="album '+type+'" data-type="'+type+'" data-date="'+a.dateKey+'"><div class="thumbs">'+thumbHtml+'</div><div style="flex:1;min-width:0"><h3>'+t+(isToday?'<span class="chip">Today</span>':'')+'</h3><p>'+labelFor(a.dateKey)+' · '+(type==='att'?'Punch-in selfies':'Stage photos')+'</p></div><span class="badge">'+n+'</span></article>';
}

async function loadHome(){
  const res=await fetch(FEED+'?token='+encodeURIComponent(TOKEN));
  const data=await res.json();
  if(!res.ok)throw new Error(data.error||'Failed to load');
  todayKey=data.todayKey;albums=data.albums;
  document.getElementById('attTotal').textContent=data.attTotal+' photos';
  document.getElementById('caseTotal').textContent=data.caseTotal+' photos';
  const show=(a)=>a.attCount>0||a.caseCount>0||a.dateKey===todayKey;
  document.getElementById('attList').innerHTML=albums.filter(show).map(a=>albumRow('att',a)).join('');
  document.getElementById('caseList').innerHTML=albums.filter(show).map(a=>albumRow('case',a)).join('');
  document.querySelectorAll('.album').forEach(el=>el.onclick=()=>openAlbum(el.dataset.type,el.dataset.date));
}

async function openAlbum(type,dateKey){
  open={type,dateKey,title:titleFor(dateKey),label:labelFor(dateKey)};
  document.getElementById('home').classList.add('hidden');
  document.getElementById('view').classList.remove('hidden');
  document.getElementById('backBtn').classList.add('show');
  document.getElementById('logo').style.display='none';
  document.getElementById('title').textContent=open.title;
  document.getElementById('sub').textContent=open.label;
  document.getElementById('grid').innerHTML='<div class="load" style="grid-column:1/-1">Loading…</div>';
  const res=await fetch(FEED+'?token='+encodeURIComponent(TOKEN)+'&dateKey='+dateKey+'&type='+type);
  const data=await res.json();
  photos=data.photos||[];
  document.getElementById('banner').innerHTML='<span class="pill '+(type==='att'?'att':'case')+'">'+(type==='att'?'📸 Attendance':'📁 Cases')+'</span><h3 style="font-size:18px;font-weight:700;margin-top:6px">'+open.title+'</h3><p style="font-size:13px;color:var(--muted);margin-top:4px">'+photos.length+' photos · '+open.label+'</p>';
  if(!photos.length){document.getElementById('grid').innerHTML='<div class="load" style="grid-column:1/-1">No photos in cloud for this date.</div>';return}
  document.getElementById('grid').innerHTML=photos.map((p,i)=>'<div class="cell" data-i="'+i+'"><img src="'+p.url+'" alt="" loading="lazy"/></div>').join('');
  document.querySelectorAll('.cell').forEach(c=>c.onclick=()=>openLb(+c.dataset.i));
}

function goHome(){
  open=null;photos=[];lbIdx=0;
  document.getElementById('view').classList.add('hidden');
  document.getElementById('home').classList.remove('hidden');
  document.getElementById('backBtn').classList.remove('show');
  document.getElementById('logo').style.display='grid';
  document.getElementById('title').textContent='Malcon Gallery';
  document.getElementById('sub').textContent='Attendance & case photos';
  document.getElementById('lb').classList.remove('open');
}

function openLb(i){lbIdx=i;const p=photos[i];document.getElementById('lbImg').src=p.url;document.getElementById('lbCap').textContent=p.cap;document.getElementById('lbSub').textContent=p.sub+' · '+timeIST(p.at);document.getElementById('lbCount').textContent=(i+1)+' / '+photos.length;document.getElementById('lb').classList.add('open')}
function lbStep(d){if(!photos.length)return;openLb((lbIdx+d+photos.length)%photos.length)}

document.getElementById('backBtn').onclick=goHome;
document.getElementById('lbClose').onclick=()=>document.getElementById('lb').classList.remove('open');
document.getElementById('lbPrev').onclick=()=>lbStep(-1);
document.getElementById('lbNext').onclick=()=>lbStep(+1);
document.getElementById('lb').onclick=e=>{if(e.target.id==='lb')document.getElementById('lb').classList.remove('open')};
document.onkeydown=e=>{if(!document.getElementById('lb').classList.contains('open'))return;if(e.key==='Escape')document.getElementById('lb').classList.remove('open');if(e.key==='ArrowLeft')lbStep(-1);if(e.key==='ArrowRight')lbStep(+1)};

loadHome().then(()=>{document.getElementById('loading').classList.add('hidden');document.getElementById('home').classList.remove('hidden')}).catch(err=>{document.getElementById('loading').classList.add('hidden');const el=document.getElementById('error');el.textContent=err.message;el.classList.remove('hidden')});
</script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const expected = Deno.env.get('GALLERY_TOKEN') ?? '';

  if (!expected) {
    return new Response('Gallery not configured', { status: 503, headers: corsHeaders });
  }
  if (!token || !safeEqual(token, expected)) {
    return new Response('Invalid or missing token. Use ?token=YOUR_SECRET', {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const feedBase = `${supabaseUrl}/functions/v1/gallery-feed`;

  return new Response(galleryHtml(feedBase, token), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline; filename="gallery.html"',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
});
