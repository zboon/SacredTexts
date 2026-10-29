/* ================================================================
   CONTENT
   ----------------------------------------------------------------
   Every text lives in content/<section>/: one JSON file per piece,
   and an index.json listing the pieces in reading order. These
   arrays start empty; loadContent() fills them before the first
   render, so the rest of the script can treat them as ordinary
   arrays. How to write and add pieces: content/README.md.
   ================================================================ */
const CONTENT_ROOT = 'content/';
const CONTENT_SECTIONS = [];   // { folder, pieces }, in the order declared below
const CONTENT_MAPS = [];       // { folder, map } — sections that are one object, not a list of pieces

/* An empty array that loadContent() fills from content/<folder>/. */
function contentSection(folder){
  const pieces = [];
  CONTENT_SECTIONS.push({ folder, pieces });
  return pieces;
}

const QASIDAS            = contentSection('qasidas');
const SIRAH_CHAPTERS     = contentSection('sirah');
const BARZANJI_CHAPTERS  = contentSection('barzanji');
const DIYA_CHAPTERS      = contentSection('diya');
const BURDAH_CHAPTERS    = contentSection('burdah');
const DALAIL_CHAPTERS    = contentSection('dalail');
const LITANY_CHAPTERS    = contentSection('litanies');
const SILSILA_CHAPTERS   = contentSection('silsila');
const TURUQ_CHAPTERS     = contentSection('turuqs');
const SOHBET_CHAPTERS    = contentSection('sohbets');
const ILAHI_CHAPTERS     = contentSection('ilahis');
const QAWWALI_CHAPTERS   = contentSection('qawwalis');
const NASHEED_CHAPTERS   = contentSection('nasheeds');
const BIOGRAPHY_CHAPTERS = contentSection('biographies');
const OTTOMAN_CHAPTERS   = contentSection('ottoman');

/* A section that is ONE object rather than a list of pieces: each file holds a
   piece of the object, and loadContent() merges them in index.json order. Used
   for the Dalāʾil's Mughlay alternates, which are keyed "chapter:verse". */
function contentMap(folder){
  const map = {};
  CONTENT_MAPS.push({ folder, map });
  return map;
}

/* One JSON file. Every error names the file, so it's clear what to fix.
   'no-cache' always asks the server whether the file changed, so an edit
   shows on the next reload even before the service worker is running. */
async function fetchJSON(path){
  let resp;
  try { resp = await fetch(path, { cache: 'no-cache' }); }
  catch(e){ throw new Error(path + ': could not be fetched'); }
  if(!resp.ok) throw new Error(path + ': HTTP ' + resp.status);
  const text = await resp.text();
  try { return JSON.parse(text); }
  catch(e){ throw new Error(path + ': ' + e.message); }
}

/* One section, all or nothing: its pieces go in only once every file has
   arrived, so a failure can leave a section empty but never shift the
   positions the code relies on (the Dalāʾil days, the Aʿẓam and Istighfār
   days). Resolves with the section's error messages; none when it loaded. */
async function loadSection({ folder, pieces }){
  const dir = CONTENT_ROOT + folder + '/';
  let names;
  try { names = await fetchJSON(dir + 'index.json'); }
  catch(e){ return [e.message]; }
  if(!Array.isArray(names)) return [dir + 'index.json: should be a list of file names'];
  const results = await Promise.allSettled(names.map(name => fetchJSON(dir + name + '.json')));
  const errors = [];
  results.forEach((r, i) => {
    if(r.status === 'rejected') errors.push(r.reason.message);
    else if(!isPiece(r.value)) errors.push(dir + names[i] + '.json: needs "titleEnglish" (text) and "verses" (a list)');
  });
  if(!errors.length) pieces.push(...results.map(r => r.value));
  return errors;
}

/* The least a piece needs: search and the readers rely on both. */
function isPiece(p){
  return !!p && typeof p === 'object' && typeof p.titleEnglish === 'string' && Array.isArray(p.verses);
}

/* Every section, in parallel. nothingLoaded: not one section arrived. */
/* The same all-or-nothing rule as loadSection(): the object fills in only once every
   file has arrived. */
async function loadMap({ folder, map }){
  const dir = CONTENT_ROOT + folder + '/';
  let names;
  try { names = await fetchJSON(dir + 'index.json'); }
  catch(e){ return [e.message]; }
  if(!Array.isArray(names)) return [dir + 'index.json: should be a list of file names'];
  const results = await Promise.allSettled(names.map(name => fetchJSON(dir + name + '.json')));
  const errors = [];
  results.forEach((r, i) => {
    if(r.status === 'rejected') errors.push(r.reason.message);
    else if(!r.value || typeof r.value !== 'object' || Array.isArray(r.value)) errors.push(dir + names[i] + '.json: should be an object');
  });
  if(!errors.length) Object.assign(map, ...results.map(r => r.value));
  return errors;
}

async function loadContent(){
  const perSection = await Promise.all([...CONTENT_SECTIONS.map(loadSection), ...CONTENT_MAPS.map(loadMap)]);
  return {
    errors: perSection.flat(),
    nothingLoaded: perSection.every(errors => errors.length > 0),
  };
}

/* ---------------- app logic ---------------- */
const app = document.getElementById('app');
const AR_NUMS = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
// Devotion/verse number badges use standard (Western) numerals for easy reading;
// the gold-circle styling is unchanged. Swap to AR_NUMS mapping to go Arabic-script.
const toArNum = n => String(n);
/* The ‖ marker is Book-Version pagination only — it tells manuscriptPages where
   the printed page turns and must never reach the reader's eye, so the Study
   view strips it out. */
const stripBreaks = s => String(s).replace(/\s*\u2016\s*/g, ' ').trim();
/* Rosettes are always set in the same hand, whichever Arabic face the body text
   uses — otherwise a font whose ۞ is a heavy disc sits next to one whose ۞ is a
   star, and the page looks inconsistent. */
/* Dalāʾil highlight portions: break at each rosette ۞ AND comma ، (comma stays on the page, rosette drawn as its own mark). segParts=text, segWrap=HTML; both count identically so a flash targets the right portion. */
function segParts(s){ let out=[],buf=''; const push=t=>{ if(buf.trim()!=='') out.push(buf+t); buf=''; }; for(const ch of String(s)){ if(ch==='۞') push(''); else if(ch==='،') push('،'); else buf+=ch; } push(''); return out; }
function segWrap(s, rosClass){ let out='',buf='',sg=0; const emit=t=>{ if(buf.trim()!==''){ out+='<span class="seg" data-sg="'+sg+'">'+buf+t+'</span>'; sg++; } buf=''; }; for(const ch of String(s)){ if(ch==='۞'){ emit(''); out+='<span class="'+rosClass+'">۞</span>'; } else if(ch==='،'){ emit('،'); } else buf+=ch; } emit(''); return sg? out : '<span class="seg" data-sg="0">'+String(s)+'</span>'; }
function segWrapMark(s, rosClass, kind, idx, keyN, marks, placedHere, placedSeg){ let out='',buf='',sg=0; const emit=t=>{ if(buf.trim()!==''){ const k=kind+':'+idx+':'+keyN+':'+sg; const mk=marks[k]?' marked':''; const pl=(placedHere && placedSeg===sg)?' placed':''; out+='<span class="seg'+mk+pl+'" data-sg="'+sg+'" data-mk="'+k+'" onclick="markVerse(\''+kind+'\','+idx+',\''+keyN+'\','+sg+')">'+buf+t+'</span>'; sg++; } buf=''; }; for(const ch of String(s)){ if(ch==='۞'){ emit(''); out+='<span class="'+rosClass+'">۞</span>'; } else if(ch==='،'){ emit('،'); } else buf+=ch; } emit(''); if(!sg){ const k=kind+':'+idx+':'+keyN+':0'; out='<span class="seg" data-sg="0" data-mk="'+k+'" onclick="markVerse(\''+kind+'\','+idx+',\''+keyN+'\',0)">'+String(s)+'</span>'; } return out; }
const withRosettes = (s, seg) => seg ? segWrap(s, 'rosette') : String(s).split('۞').join('<span class="rosette">۞</span>');
const arHTML = (s, seg) => markInline(withRosettes(stripBreaks(s).replaceAll('\n','<br>'), seg), false);

/* ── Favourites ──────────────────────────────────────────────────
   Stored in this browser's localStorage, so they stay on the device and are
   never shared between people opening the same hosted link.
   The key is kind + titleEnglish (unique within every array) rather than an
   array index, so favourites survive adding, removing or reordering pieces.
   A favourite whose title is later edited is simply dropped. */
const FAV_KEY = 'mawlid-favs';
/* Titles edited since a favourite may have been saved under the old one
   (v456: the Opening Qasida was labelled as the Mawlid version). */
const FAV_RENAMES = { 'q|2 · The Opening Qasida — Yā Rabbi Ṣalli ʿalā Muḥammad': 'q|2 · The Opening Qasida — Mawlid version (Yā Rabbi Ṣalli ʿalā Muḥammad)' };

function loadFavs(){
  try { const v = JSON.parse(localStorage.getItem(FAV_KEY)); return Array.isArray(v) ? v.map(k => FAV_RENAMES[k] || k) : []; }
  catch(e){ return []; }
}
function saveFavs(){
  try { localStorage.setItem(FAV_KEY, JSON.stringify(state.favs)); } catch(e){}
}

/* ── Text size ──────────────────────────────────────
   Remembered across sessions on the owner's ask, so someone who needs large
   Arabic sets it once rather than on every open.

   The limits live here because three places need them and they must agree:
   the slider's own min/max, the clamp when a value comes back from storage,
   and the clamp in setTextScale. A stored value outside them would otherwise
   put the thumb off the end of its track.

   Written ONLY from setTextScale, the slider's own handler — the same
   discipline the Dalāʾil fork's view preference follows. Nothing else
   assigns state.arScale or state.latinScale, and nothing else should start:
   a size arriving from a live session or a restored screen must not quietly
   rewrite how the app opens afterwards. */
const SIZE_KEY = 'mawlid-size';
const SIZE_LIMITS = { ar: [0.7, 1.6], latin: [0.8, 1.8] };

function clampSize(which, v){
  const [lo, hi] = SIZE_LIMITS[which];
  v = +v;
  return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 1;
}
function loadTextScale(which){
  try {
    const v = JSON.parse(localStorage.getItem(SIZE_KEY));
    return (v && v[which] != null) ? clampSize(which, v[which]) : 1;
  } catch(e){ return 1; }
}
function saveTextScale(){
  try {
    localStorage.setItem(SIZE_KEY, JSON.stringify({ ar: state.arScale, latin: state.latinScale }));
  } catch(e){}
}
/* ── Transliteration and Translation ────────────────────────────
   **Both off for a reader who has never chosen**, on the owner's call — the
   page opens as the Arabic alone, the way the book reads, and either column
   is one tap away. They used to default on, which is why the first screen of
   every chapter arrived three deep.

   Once either is turned on it stays on, across sessions. Written ONLY from
   `toggle` and `toggleEn`, the reader's own chips — the same discipline the
   size and `dlk-view` follow. Nothing else assigns showTr or showEn today;
   in particular a live session does NOT sync them, so a follower keeps their
   own columns, and nothing a leader does should start rewriting them. */
const COLS_KEY = 'mawlid-cols';

function loadCols(which){
  try {
    const v = JSON.parse(localStorage.getItem(COLS_KEY));
    return !!(v && v[which]);
  } catch(e){ return false; }
}
function saveCols(){
  try {
    localStorage.setItem(COLS_KEY, JSON.stringify({ tr: state.showTr, en: state.showEn }));
  } catch(e){}
}

/* ── Where you left off (Dalāʾil only) ───────────────────────────
   A ribbon, not a shelf: exactly one place is kept, and saving a new one
   replaces it. This is deliberately separate from favourites — a favourite
   marks a piece you want to find again, a place marks how far you have read
   through a long portion you mean to finish. */
const PLACE_KEY = 'mawlid-dalail-place';
/* One saved place per version of the Dalāʾil. The Mughlay Version divides
   its text where the Mughlay printing does, so a phrase (and so a saved
   place) in one version is not the same phrase in the other. The Istanbul
   place keeps the original key, so places saved before there were two
   versions are still found. Read through a try because a place can be
   looked up before dalailEdition is declared further down. */
function placeKey(){
  let ed = 'istanbul';
  try { ed = dalailEdition; } catch(e){}
  return ed === 'sayyidina' ? PLACE_KEY + '-mughlay' : PLACE_KEY;
}

function loadPlace(){
  try {
    const p = JSON.parse(localStorage.getItem(placeKey()));
    return (p && typeof p.idx === 'number') ? p : null;
  } catch(e){ return null; }
}
function writePlace(p){ try { localStorage.setItem(placeKey(), JSON.stringify(p)); } catch(e){} }

/* The saved place is tied to the chapter's title as well as its index, so a
   place doesn't silently point at the wrong portion if the order ever changes. */
function placeChapter(){
  const p = loadPlace();
  if(!p) return null;
  const c = DALAIL_CHAPTERS[p.idx];
  if(!c) return null;
  if(p.title && c.titleEnglish !== p.title) return null;
  return { p, c };
}
/* True only while the CURRENT leaf is the one the bookmark actually sits on —
   not merely "this chapter has a bookmark somewhere." It used to be the
   latter, so "Place saved" stayed lit across the whole chapter as you paged
   forward, with nothing to say the bookmark was still back on the page you
   left. Book-Version only: a Study-view place has no leaf to compare against,
   so it never reads as "here" for the Book-Version button. */
function placeIsHere(idx){
  const cur = placeChapter();
  if(!cur || cur.p.idx !== idx || cur.p.view !== 'book') return false;
  const book = document.getElementById('ms-book');
  if(!book) return false;
  const p = cur.p;
  let sheet = null;
  if(p.verse != null){
    const vEl = msVerseEl(idx, p.verse, p.mk);
    if(vEl) sheet = vEl.closest('.ms-sheet');
  }
  if(!sheet && p.leaf != null) sheet = book.children[p.leaf];
  if(!sheet) return false;
  return Array.from(book.children).indexOf(sheet) === msCurrentPage();
}

/* The first verse still on screen — where the eye is, not where the page
   happens to begin. */
function topVisibleVerse(){
  const arts = document.querySelectorAll('main.verses article.verse[data-v]');
  for(let i=0;i<arts.length;i++){
    if(arts[i].getBoundingClientRect().bottom > 96) return +arts[i].dataset.v;
  }
  return arts.length ? +arts[arts.length-1].dataset.v : 0;
}

/* Bookmark one exact verse in the Study view. Tapping the ribbon on a verse
   moves the bookmark there; tapping the same verse again lifts it. Only one
   verse is ever marked, so the ribbon shows you precisely where you stopped
   rather than roughly how far down the page you were. */
function placeVerse(idx, n){
  const cur = loadPlace();
  const same = cur && cur.idx === idx && cur.view === 'study' && cur.verse === n;
  const prev = document.querySelector('article.verse.placed');
  if(prev) prev.classList.remove('placed');
  const btnPrev = document.querySelector('.verse-place.on');
  if(btnPrev) btnPrev.classList.remove('on');

  if(same){                       // tapping the marked verse lifts the bookmark
    try { localStorage.removeItem(placeKey()); } catch(e){}
    return;
  }
  const c = DALAIL_CHAPTERS[idx];
  if(!c) return;
  writePlace({ idx, title: c.titleEnglish || '', at: Date.now(), view: 'study', verse: n });
  const el = document.querySelector('article.verse[data-v="' + n + '"]');
  if(el){
    el.classList.add('placed');
    const b = el.querySelector('.verse-place');
    if(b) b.classList.add('on');
  }
}

/* Is this the verse currently bookmarked? */
function placedVerse(idx, n){
  const cur = loadPlace();
  return !!cur && cur.idx === idx && cur.view === 'study' && cur.verse === n;
}
/* ── Book-Version verse bookmarking ───────────────────────
   The Study view marks a verse with a ribbon; a Book leaf has no room for one
   per phrase without disturbing the leaf-fit engine, so instead the verse you
   last tapped (highlighted) becomes the candidate and "Save my place" stores
   it. Only one place exists app-wide, shared with the Study bookmark. */
let msPlaceCandidate = null;

/* The whole-verse index from a mark key "d:idx:n" or a split chunk "d:idx:n.c". */
function mkVerseIndex(mk){
  const parts = String(mk).split(':');
  return parseInt(parts[2], 10);        // parseInt stops at the dot for "n.c"
}

/* The Book-Version span for a verse. Pass the bookmark's own mk (a seg key
   like "d:6:33.0:0") and, if the verse was split across a page turn, this
   lands on the CHUNK that seg actually sits in — not just any chunk of the
   same verse number. Without it (or if that chunk isn't in the DOM), falls
   back to the first chunk, so the bookmark lands on the leaf where the verse
   begins rather than nowhere.

   The prefix search alone can't tell chunks apart: "d:6:33." matches both
   "d:6:33.0" and "d:6:33.1", and always returns whichever is first in the
   DOM — the earlier page, even when the bookmarked phrase is on the later
   one. That silently mis-targeted both the resume scroll and the "is this
   leaf the one" check the place chip depends on. */
function msVerseEl(idx, n, mk){
  if(mk){
    const parts = String(mk).split(':');
    if(parts.length > 3){
      const chunk = document.querySelector('[data-mk="' + parts.slice(0, 3).join(':') + '"]');
      if(chunk) return chunk;
    }
  }
  const base = 'd:' + idx + ':' + n;
  return document.querySelector('[data-mk="' + base + '"]')
      || document.querySelector('[data-mk^="' + base + '."]');
}

/* Where the reader is on the current leaf, for a switch to the Study view:
   the phrase they last highlighted, else the bookmarked phrase, if either is
   on this leaf; else the top verse on the leaf. Before this the switch always
   took the top verse, so a reader who had marked words lower down — or on a
   leaf that opens mid-verse — landed on a different verse in Study.

   The phrase travels as its text plus its position among the verse's
   phrases, because the two views number phrases differently: the Book
   Version restarts the count on each page a verse spans, and a page turn
   inside a phrase splits it in two there but not in Study. */
function bookSpotForSwitch(){
  const book = document.getElementById('ms-book');
  if(!book) return { n: null };
  const sheet = book.children[msCurrentPage()];
  let el = null;
  if(msPlaceCandidate && msPiece && msPlaceCandidate.idx === msPiece.idx && msPlaceCandidate.mk){
    const c = book.querySelector('.seg[data-mk="' + msPlaceCandidate.mk + '"]');
    if(c && sheet && sheet.contains(c)) el = c;
  }
  if(!el && sheet) el = sheet.querySelector('.seg.placed[data-mk]');
  if(!el) return { n: topVisibleMsVerse() };
  const mk = el.getAttribute('data-mk');
  const n = mkVerseIndex(mk);
  const base = mk.split(':').slice(0, 2).join(':') + ':' + n;
  const all = Array.from(book.querySelectorAll('.seg[data-mk^="' + base + ':"], .seg[data-mk^="' + base + '."]'));
  return { n, seg: { text: el.textContent, est: Math.max(0, all.indexOf(el)) } };
}

/* The Study phrase matching a phrase carried over from the Book Version: the
   one containing its words, nearest its position if the words recur. */
function studySegFor(art, spot){
  const segs = Array.from(art.querySelectorAll('.seg[data-sg]'));
  const norm = t => String(t).replace(/[\s،]+/g, '');
  const want = norm(spot.text);
  let best = null, bestD = Infinity;
  segs.forEach((sg, i) => {
    if(want && norm(sg.textContent).indexOf(want) !== -1){
      const d = Math.abs(i - spot.est);
      if(d < bestD){ bestD = d; best = sg; }
    }
  });
  return best || segs[Math.min(spot.est, segs.length - 1)] || null;
}

/* The top-most verse still on screen on the current leaf — the fallback when
   the reader saves without having tapped a verse. */
function topVisibleMsVerse(){
  const book = document.getElementById('ms-book');
  if(!book) return null;
  const sheet = book.children[msCurrentPage()];
  if(!sheet) return null;
  const vs = sheet.querySelectorAll('.ms-v[data-mk]');
  for(let i=0;i<vs.length;i++){
    if(vs[i].getBoundingClientRect().bottom > 96) return mkVerseIndex(vs[i].getAttribute('data-mk'));
  }
  return vs.length ? mkVerseIndex(vs[vs.length-1].getAttribute('data-mk')) : null;
}

/* Show which verse holds the bookmark — one at a time. */
/* Mark exactly the word group that was tapped — the .seg span carrying that
   data-mk, and nothing wider.

   This used to fall back to msVerseEl(), which returns the whole .ms-v verse
   element. A Dalāʾil verse can hold several ۞ internally, so that lit up
   rosette after rosette instead of the phrase the reader chose, and when the
   fallback fired it marked the top verse of the leaf — a highlight that began
   earlier than the tap and stopped before reaching it. Marking by exact key
   makes both impossible. */
function markPlacedMsVerse(idx, n, seg, mk){
  [].forEach.call(document.querySelectorAll('.placed'), el => el.classList.remove('placed'));
  const key = mk || (seg != null ? 'd:' + idx + ':' + n + ':' + seg : null);
  if(!key) return;
  const s = document.querySelector('[data-mk="' + key + '"]');
  if(s) s.classList.add('placed');
}

/* The place is shown as saved only while the word group holding it is still
   highlighted. Lift the highlight and the bookmark goes with it. */
function placeStillMarked(){
  const p = loadPlace();
  if(!p || !p.mk) return false;
  try { return !!loadMarks()[p.mk]; } catch(e){ return false; }
}
function placeBtnLabel(idx){
  return (placeIsHere(idx) && placeStillMarked()) ? 'Place saved' : 'Save my place';
}
function refreshPlaceBtn(){
  const btn = document.querySelector('.place-btn');
  if(!btn) return;
  const idx = Number(btn.dataset.idx);
  const on = placeIsHere(idx) && placeStillMarked();
  btn.textContent = on ? 'Place saved' : 'Save my place';
  btn.classList.toggle('on', on);
}

function saveDalailPlace(idx){
  const c = DALAIL_CHAPTERS[idx];
  if(!c) return;
  /* Ask the page which reader is showing rather than trusting the flag.
     When the two disagree the flag saves the wrong kind of place, and it is
     silent about it: a Book leaf on screen with state claiming Study stores
     verse 0 with no phrase key, so nothing highlights, the chip never lights
     and the bookmark points at the top of the chapter instead of where the
     reader was. That is what the full-screen menu produced by flipping the
     view without re-rendering. renderedView() documents the same trap. */
  const rv = (typeof renderedView === 'function') ? renderedView() : 'none';
  const p = { idx, title: c.titleEnglish || '', at: Date.now(),
              view: rv === 'none' ? (state.pageView ? 'book' : 'study') : rv };
  if(p.view === 'book'){
    /* The verse the reader last tapped in this chapter, else the top of the
       page they are on. Only fall back to a bare leaf if no verse is found. */
    const cand = (msPlaceCandidate && msPlaceCandidate.idx === idx) ? msPlaceCandidate : null;
    /* Tapping Save again with nothing newly highlighted must not move the
       bookmark. It used to: the candidate was cleared on every save, so the
       second tap fell through to the top verse of the leaf and quietly
       overwrote a good mark. A standing place is now left alone. */
    if(!cand && placeIsHere(idx) && placeStillMarked()){ refreshPlaceBtn(); return; }
    let n  = cand ? cand.n   : null;
    let sg = cand ? cand.seg : null;
    let mk = cand ? cand.mk  : null;
    if(n == null) n = topVisibleMsVerse();
    if(n == null) p.leaf = msCurrentPage();
    else { p.verse = n; if(sg != null) p.seg = sg; if(mk) p.mk = mk; markPlacedMsVerse(idx, n, sg, mk); }
  } else {
    p.verse = topVisibleVerse();
  }
  writePlace(p);
  refreshPlaceBtn();
}

function clearDalailPlace(){
  /* Guard against a stray tap: this wipes the saved place and every Dalāʾil
     verse bookmark. Favorites (mawlid-favs) are a separate store, untouched. */
  if(typeof confirm === 'function' &&
     !confirm('Clear your Dalāʾil bookmarks?\n\nThis removes your saved place and every verse bookmark in the Dalāʾil. Your favorites are not affected.')) return;
  try { localStorage.removeItem(PLACE_KEY); localStorage.removeItem(PLACE_KEY + '-mughlay'); } catch(e){}
  /* Clear every Book-Version verse bookmark in the Dalāʾil too (mark keys are
     "kind:idx:n", so Dalāʾil marks start "d:"), so Clear wipes the resume place
     and all gold-ring verse bookmarks together. */
  try {
    const m = readMarkStore('mawlid-marks');     // both versions' Dalāʾil highlights go
    let changed = false;
    Object.keys(m).forEach(k => { if(k.slice(0, 2) === 'd:'){ delete m[k]; changed = true; } });
    if(changed) localStorage.setItem('mawlid-marks', JSON.stringify(m));
    localStorage.removeItem('mawlid-marks-mughlay');
  } catch(e){}
  msPlaceCandidate = null;
  renderIndex();
}

/* Reopen the saved chapter in the view it was saved from and go to the spot.
   The jump is repeated once after a moment because the leaves are measured and
   fitted after the fonts land, which moves everything below them. */
function resumeDalail(){
  const cur = placeChapter();
  if(!cur) return;
  const { p, c } = cur;
  const hasPages = Array.isArray(c.folios) && c.folios.length > 0;
  state.pageView = (p.view === 'book') && hasPages;
  openDalail(p.idx);
  const go = (flash) => {
    if(state.pageView){
      const book = document.getElementById('ms-book');
      if(!book) return;
      let sheet = null, vEl = null;
      if(p.verse != null){
        vEl = msVerseEl(p.idx, p.verse, p.mk);
        if(vEl) sheet = vEl.closest('.ms-sheet');
      }
      if(!sheet && p.leaf != null) sheet = book.children[p.leaf];   // older page-level bookmark
      if(sheet){
        sheet.scrollIntoView({ block:'nearest', inline:'center' });
        if(typeof msSyncDots === 'function') msSyncDots();
      }
      if(vEl){
        markPlacedMsVerse(p.idx, p.verse, p.seg, p.mk);
        /* Aim at the saved phrase itself — the words between two rosettes —
           not the start of its verse. A long verse fills most of a leaf, so
           scrolling to where the verse begins left the phrase below the
           screen; and a verse that runs on from the previous page begins
           on a page the reader is not on. */
        const segEl = p.mk ? book.querySelector('.seg[data-mk="' + p.mk + '"]') : null;
        const target = segEl || vEl;
        const r = target.getBoundingClientRect();
        /* Low on the screen counts as out of view: the fixed leaf arrows sit
           over the bottom of it. */
        if(r.top < 84 || r.bottom > window.innerHeight * 0.75){
          window.scrollTo({ top: Math.max(0, r.top + window.scrollY - 160) });
        }
        if(flash){
          const cls = segEl ? 'seg-flash' : 'ms-flash';
          target.classList.remove(cls); void target.offsetWidth; target.classList.add(cls);
        }
      }
    } else if(p.verse != null){
      const el = document.querySelector('article.verse[data-v="' + p.verse + '"]');
      if(el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 84) });
    }
  };
  if(window.requestAnimationFrame) requestAnimationFrame(() => requestAnimationFrame(() => go(false)));
  else setTimeout(() => go(false), 40);
  setTimeout(() => go(true), 320);
}

/* The card that offers the place back, shown at the head of the Dalāʾil tab. */
function resumeCard(){
  const cur = placeChapter();
  if(!cur) return '';
  const { p, c } = cur;
  const where = p.view === 'book'
    ? (p.verse != null
        ? 'Book Version · verse ' + toArNum(verseNo('d', p.idx, p.verse))
        : 'Book Version · page ' + ((p.leaf || 0) + 1))
    : 'Study Version · verse ' + toArNum(verseNo('d', p.idx, p.verse || 0));
  return `<div class="resume-wrap">
      <button class="resume-card" onclick="resumeDalail()">
        <span class="resume-ribbon">${bookmarkIcon(true)}</span>
        <span class="resume-text">
          <span class="resume-label">Continue where you left off</span>
          <span class="resume-ar">${c.titleArabic}</span>
          <span class="resume-where">${where}</span>
        </span>
        <span class="chev">›</span>
      </button>
      <button class="resume-clear" onclick="clearDalailPlace()">Clear</button>
    </div>`;
}

const state = { showTr: loadCols('tr'), showEn: loadCols('en'), refrainOpen: false, arScale: loadTextScale('ar'), latinScale: loadTextScale('latin'), msZoom: 1, query: '', tab: 'home', burdahChapter: null, favs: loadFavs() , pageView:true, immersive:false};

/* The content arrays, keyed by the same letters as OPENERS. */
function arrayOf(kind){
  return kind === 'q' ? QASIDAS
       : kind === 'b' ? BURDAH_CHAPTERS
       : kind === 's' ? SIRAH_CHAPTERS
       : kind === 'i' ? ILAHI_CHAPTERS
       : kind === 'w' ? QAWWALI_CHAPTERS
       : kind === 'd' ? DALAIL_CHAPTERS
       : kind === 'z' ? BARZANJI_CHAPTERS
       : kind === 'y' ? DIYA_CHAPTERS
       : kind === 'l' ? LITANY_CHAPTERS
       : kind === 'c' ? SILSILA_CHAPTERS
       : kind === 't' ? TURUQ_CHAPTERS
       : kind === 'h' ? SOHBET_CHAPTERS
       : kind === 'g' ? BIOGRAPHY_CHAPTERS
       : kind === 'o' ? OTTOMAN_CHAPTERS
       : null;
}
function pieceOf(kind, idx){ const a = arrayOf(kind); return a ? a[idx] : null; }
function favKey(kind, piece){ return kind + '|' + piece.titleEnglish; }
function isFav(kind, idx){
  const p = pieceOf(kind, idx);
  return !!p && state.favs.includes(favKey(kind, p));
}
function toggleFav(kind, idx){
  const p = pieceOf(kind, idx);
  if(!p) return;
  const key = favKey(kind, p);
  const at = state.favs.indexOf(key);
  if(at >= 0) state.favs.splice(at, 1); else state.favs.push(key);
  saveFavs();
  updateFavUI(kind, idx);
}
/* Bookmark glyph: outline when unsaved, filled when saved. Drawn as SVG so it
   takes the app's gold via currentColor instead of an emoji's fixed colour. */
function bookmarkIcon(on){
  return `<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"
    fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M6.5 3.5h11a.9.9 0 0 1 .9.9v15.8a.5.5 0 0 1-.77.42L12 16.8l-5.63 3.82a.5.5 0 0 1-.77-.42V4.4a.9.9 0 0 1 .9-.9z"/>
  </svg>`;
}
/* Update the star in place, so tapping it never disturbs your scroll position */
function updateFavUI(kind, idx){
  const btn = document.querySelector('.fav-btn');
  if(!btn) return;
  const on = isFav(kind, idx);
  btn.innerHTML = bookmarkIcon(on);
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-label', on ? 'Remove bookmark' : 'Bookmark this');
}
/* Resolve saved keys back to live pieces, skipping any that no longer exist */
function favItems(){
  const out = [];
  state.favs.forEach(key => {
    const kind = key.slice(0, 1);
    const title = key.slice(2);
    const arr = arrayOf(kind);
    if(!arr) return;
    const idx = arr.findIndex(p => p.titleEnglish === title);
    if(idx >= 0) out.push({ kind, idx, piece: arr[idx] });
  });
  return out;
}

/* Fuzzy-normalize transliterated Arabic so different English spellings match.
   e.g. "Qaseeda", "kasida", "qasīda" all collapse to the same key.
   Steps: lowercase → strip diacritics/accents → drop non-letters →
   fold interchangeable sounds (q/k, ph/f, etc.) → collapse doubled letters. */
function normalize(str){
  if(!str) return '';
  let s = str.toLowerCase();
  // strip combining diacritical marks (ā ṣ ḥ ʿ etc.)
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // strip Arabic harakat/tatweel and fold letter variants, so searching Arabic
  // works whether or not the person types the vowel marks
  s = s.replace(/[\u064b-\u065f\u0670\u0640]/g, '');
  s = s.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه');
  // remove Arabic transliteration marks and punctuation, keep a-z and arabic block
  s = s.replace(/[ʿʾ'`’‘_\-.,;:!?()\[\]"۞·‖]/g, ' ');
  // sound-folding for common spelling variants
  s = s
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/q/g, 'k')      // qasida = kasida
    .replace(/dh/g, 'd')
    .replace(/th/g, 't')
    .replace(/gh/g, 'g')
    .replace(/kh/g, 'h')
    .replace(/sh/g, 's')
    .replace(/ee/g, 'i')     // nabee = nabi
    .replace(/ii/g, 'i')
    .replace(/ea/g, 'i')
    .replace(/oo/g, 'u')     // rasool = rasul
    .replace(/ou/g, 'u')
    .replace(/uu/g, 'u')
    .replace(/aa/g, 'a')     // salaam = salam
    .replace(/y/g, 'i')      // naby = nabi
    .replace(/w/g, 'u');
  // collapse any remaining doubled letters (rabbi = rabi, muhammad = muhamad)
  s = s.replace(/(.)\1+/g, '$1');
  // squeeze whitespace
  return s.replace(/\s+/g, ' ').trim();
}

/* Build a searchable haystack for each qasida (title + all verse text). */
function haystack(q){
  const parts = [q.titleEnglish, q.titleArabic];
  q.verses.forEach(v => { parts.push(v.tr, v.en, v.ar); });
  const joined = parts.join(' ');
  const norm = normalize(joined);
  return {
    norm,
    // space-free copy, so word breaks don't matter: "mawla ya" == "mawlaya".
    // Doubles are re-collapsed AFTER squeezing, since removing a space can
    // create one ("ar rahman" -> "arrahman" -> "arahman").
    tight: tighten(norm),
    raw: joined.toLowerCase(),
    ar: joined
  };
}

/* Space-free, double-free form used for spacing-insensitive matching. */
function tighten(normalized){
  return normalized.replace(/\s+/g, '').replace(/(.)\1+/g, '$1');
}

function matchesQuery(q, query){
  if(!query) return true;
  const nq = normalize(query);
  const h = haystack(q);
  // match on normalized (fuzzy) OR raw lowercase OR arabic-script substring
  if(nq && h.norm.includes(nq)) return true;
  // spacing-insensitive: "mawla ya" and "mawlaya" both find the same verse
  const tq = tighten(nq);
  if(tq && h.tight.includes(tq)) return true;
  const rawq = query.toLowerCase().trim();
  if(h.raw.includes(rawq)) return true;
  if(/[\u0600-\u06ff]/.test(query) && h.ar.includes(query.trim())) return true;
  return false;
}
/* ---------- Verse-level search: matching lines + jump-to-verse ---------- */
function escHTML(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* A snippet of `text` windowed around the query, the match wrapped in <mark>.
   Falls back to a plain truncation when the match was only via normalisation. */
function hitSnippet(text, q, win){
  const raw = String(text || ''); if(!raw) return '';
  win = win || 110;
  let i = -1, len = 0;
  const ql = (q||'').toLowerCase().trim();
  if(ql){ i = raw.toLowerCase().indexOf(ql); if(i>=0) len = ql.length; }
  if(i < 0 && /[\u0600-\u06ff]/.test(q||'')){ const qa=q.trim(); i = raw.indexOf(qa); if(i>=0) len = qa.length; }
  if(i < 0) return escHTML(raw.length > win ? raw.slice(0,win).trim()+'\u2026' : raw);
  const half = Math.floor(win/2);
  const a = Math.max(0, i-half), b = Math.min(raw.length, i+len+half);
  return (a>0?'\u2026':'') + escHTML(raw.slice(a,i)) + '<mark>' + escHTML(raw.slice(i,i+len)) + '</mark>' + escHTML(raw.slice(i+len,b)) + (b<raw.length?'\u2026':'');
}

/* Which lines of a chapter match the current query, and in which field. */
/* Which rosette-segment of a verse the search match sits in (Arabic = exact; tr/en = by position). */
function hitSeg(v, f, q){
  const ar = stripBreaks(v.ar || ''); const segs = segParts(ar);
  if(segs.length <= 1) return 0;
  const isAr = /[\u0600-\u06ff]/.test(q||'');
  if(f === 'ar' || isAr){ const nq = normalize(q); for(let i=0;i<segs.length;i++){ if(normalize(segs[i]).includes(nq)) return i; } }
  const field = String(v[f] || ''); const mi = field.toLowerCase().indexOf(String(q||'').toLowerCase().trim());
  if(mi < 0) return 0; const frac = field.length ? mi/field.length : 0;
  const target = frac * segs.reduce((a,p)=>a+p.length,0); let cum = 0;
  for(let i=0;i<segs.length;i++){ cum += segs[i].length; if(cum >= target) return i; } return segs.length - 1;
}
function verseHits(c){
  const q = state.query;
  if(!q || !c || !c.verses) return [];
  const nq = normalize(q), tq = tighten(nq), rawq = q.toLowerCase().trim(), isAr = /[\u0600-\u06ff]/.test(q);
  const test = raw => { if(!raw) return false; const nf = normalize(raw);
    return (nq && nf.includes(nq)) || (tq && tighten(nf).includes(tq)) || raw.toLowerCase().includes(rawq) || (isAr && raw.includes(q.trim())); };
  const out = [];
  for(let n=0; n<c.verses.length; n++){
    const v = c.verses[n], ar = stripBreaks(v.ar || '');
    if(v.omit) continue;
    let f = null;
    if(test(v.en)) f='en'; else if(test(v.tr)) f='tr'; else if(test(ar)) f='ar';
    if(!f) continue;
    out.push({ n, ar, sec: f==='ar' ? '' : (v[f]||''), seg: hitSeg(v, f, q) });
    if(out.length >= 40) break;
  }
  return out;
}

/* The matching-lines list rendered under a chapter card during a search. */
function hitList(kind, idx){
  if(!state.query) return '';
  const arr = arrayOf(kind); if(!arr) return '';
  const c = arr[idx]; if(!c) return '';
  const hits = verseHits(c); if(!hits.length) return '';
  const CAP = 6, shown = hits.slice(0, CAP);
  const rows = shown.map(h => {
    const ar = `<span class="h-ar">${hitSnippet(h.ar, state.query, 120)}</span>`;
    const tr = h.sec ? `<span class="h-tr">${hitSnippet(h.sec, state.query, 130)}</span>` : '';
    return `<button class="hit" onclick="jumpToVerse('${kind}',${idx},${h.n},${h.seg})">${ar}${tr}</button>`;
  }).join('');
  const extra = hits.length - CAP;
  const more = extra > 0 ? `<div class="hit-more">+${extra} more line${extra>1?'s':''} in this reading</div>` : '';
  return `<div class="hits">${rows}${more}</div>`;
}

/* Scroll to a specific verse in whichever view is open, and flash it. Both
   views share the verse index, so the same n lands on the same line. */
function scrollToVerse(kind, idx, n, seg){
  { const m = shownVerseN(kind, idx, n); if(m !== n){ n = m; seg = null; } }
  const book = document.getElementById('ms-book');
  if(book){
    const vEl = document.querySelector('[data-mk="'+kind+':'+idx+':'+n+'"]')
             || document.querySelector('[data-mk^="'+kind+':'+idx+':'+n+'."]');
    if(!vEl) return false;
    const sheet = vEl.closest('.ms-sheet');
    if(sheet){ sheet.scrollIntoView({ block:'nearest', inline:'center' }); if(typeof msSyncDots==='function') msSyncDots(); }
    const r = vEl.getBoundingClientRect();
    if(r.top < 84 || r.bottom > window.innerHeight - 8) window.scrollTo({ top: Math.max(0, r.top + window.scrollY - 96) });
    (()=>{ const sg=(seg!=null)?vEl.querySelector('.seg[data-sg="'+seg+'"]'):null; if(sg){ sg.classList.remove('seg-flash'); void sg.offsetWidth; sg.classList.add('seg-flash'); } else { vEl.classList.remove('ms-flash'); void vEl.offsetWidth; vEl.classList.add('ms-flash'); } })();
    return true;
  }
  const el = document.querySelector('article.verse[data-v="'+n+'"]');
  if(!el) return false;
  /* seg is a Study phrase index, or — coming from the Book Version — the
     phrase's text and position (bookSpotForSwitch). */
  const sgEl = (seg != null && typeof seg === 'object') ? studySegFor(el, seg)
             : (seg != null ? el.querySelector('.seg[data-sg="'+seg+'"]') : null);
  let y = el.getBoundingClientRect().top + window.scrollY - 84;
  /* A long verse can run several screens; keep its number in view if the
     phrase still shows, otherwise bring the phrase up. */
  if(sgEl){
    const sy = sgEl.getBoundingClientRect().top + window.scrollY;
    if(sy - y > window.innerHeight * 0.6) y = sy - 160;
  }
  window.scrollTo({ top: Math.max(0, y) });
  (()=>{ const sg=sgEl; if(sg){ sg.classList.remove('seg-flash'); void sg.offsetWidth; sg.classList.add('seg-flash'); } else { el.classList.remove('hit-flash'); void el.offsetWidth; el.classList.add('hit-flash'); } })();
  return true;
}

/* Run scrollToVerse once the (re)built leaves settle — the Book Version measures
   and fits after the fonts land, which shifts everything, so retry once. */
function afterViewScroll(kind, idx, n, seg){
  if(n == null) return;
  const run = () => { if(!scrollToVerse(kind, idx, n, seg)) setTimeout(() => scrollToVerse(kind, idx, n, seg), 280); };
  if(window.requestAnimationFrame) requestAnimationFrame(() => requestAnimationFrame(run));
  else setTimeout(run, 40);
}

/* Open a reader at a specific verse and flash it — Book or Study, any kind. */
function jumpToVerse(kind, idx, n, seg){
  const fn = window[openFnOf(kind)];
  if(typeof fn !== 'function') return;
  fn(idx);
  afterViewScroll(kind, idx, n, seg);
}

const CORNER_MOTIF = (cls, pid) => `<svg class="corner-motif ${cls}" viewBox="0 0 118 118" aria-hidden="true">
  <defs>
    <pattern id="${pid}" width="28" height="28" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="currentColor" stroke-width="1">
        <rect x="7.5" y="7.5" width="13" height="13"/>
        <rect x="7.5" y="7.5" width="13" height="13" transform="rotate(45 14 14)"/>
      </g>
    </pattern>
  </defs>
  <path d="M0 0 H118 L0 118 Z" fill="url(#${pid})"/>
</svg>`;

const STAR = `<svg class="star-band" viewBox="0 0 240 24" fill="none" aria-hidden="true">
  <line x1="0" y1="12" x2="96" y2="12" stroke="#B8934A" stroke-width="1"/>
  <line x1="144" y1="12" x2="240" y2="12" stroke="#B8934A" stroke-width="1"/>
  <path d="M120 2 L123 9 L130.5 5.5 L127 12 L134 15 L126.5 15.5 L128 23 L120 18 L112 23 L113.5 15.5 L106 15 L113 12 L109.5 5.5 L117 9 Z" fill="#B8934A"/>
</svg>`;

function sectionCards(cat){
  const q = state.query;
  let items = QASIDAS.map((qa,i)=>({q:qa,i}))
    .filter(x=>x.q.category===cat)
    .filter(x=>matchesQuery(x.q, q));
  if(q){
    // rank: title matches first, then body-only matches
    const nq = normalize(q);
    const titleHit = (qa) => {
      const t = normalize(qa.titleEnglish + ' ' + qa.titleArabic);
      return (nq && t.includes(nq)) || (qa.titleEnglish + qa.titleArabic).toLowerCase().includes(q.toLowerCase().trim());
    };
    items.sort((a,b)=> (titleHit(b.q)?1:0) - (titleHit(a.q)?1:0));
  }
  if(items.length === 0) return '';
  return items.map(({q:qa,i},n)=>`
        <button class="qcard" onclick="openQasida(${i})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar">${qa.titleArabic}</span>
            <span class="t-en">${qa.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>`).join('');
}
/* ---- Top-level sections shown as a left-to-right nav bar ---- */
/* Dalāʾil al-Khayrāt of Imam al-Jazūlī, divided for the week's reading.
   Pages are scaffolded empty; paste content in as it's verified. */
/* ── The Dalāʾil in two versions ─────────────────────────────────────────
   DALAIL_CHAPTERS above is the ISTANBUL version: collated word by word
   against the Istanbul printing, which removed 520 سيدنا the app had carried
   (one commit per day; Mawalid v388, the Dalāʾil app v66). The owner then
   asked for the earlier text to be offered too, as the Mughlay Version
   (first called "With Sayyidinā"; the code keeps that name, and the stored
   value 'sayyidina'), and for it to be read without the Arabic commas.

   DALAIL_WITH_SAYYIDINA holds the 153 verses those splices changed, keyed
   "chapter:verse", with ar, tr and en together (the splices moved all three).
   Each is the pre-collation verse carrying every fix made since: Saturday
   v15's شِيثَ and the two إِبْرَاهِيمَ tatweels. The build asserted that each
   differs from the Istanbul verse by exactly the collation's own changes,
   that every ۞ and ‖ was where it had been (Monday's rosettes have since
   moved to the Mughlay printing's; see below), and 520 restored in all: Mon1 119,
   Tue 35, Wed 25, Thu 63, Fri 134, Sat 94, Sun 28, Mon2 22. The data keeps
   its commas; the Mughlay Version drops every Arabic comma (U+060C)
   from the Arabic of the whole Dalāʾil as it is applied — all 1,065 sit as
   "word، next", so removing one leaves a single space. tr and en keep theirs.

   The owner then had سَيِّدُنَا put before each of the 200 Names of the
   Prophet (chapter 5, v2–v201) in this version only — new text, not a
   restoration: no copy of the app ever carried it there, and the Istanbul
   Names pages were not to hand. tr "Sayyidunā …", en "Our master, …". The
   bytes are Saturday v21's, the only nominative سَيِّدُنَا in the Dalāʾil.

   The Mughlay Version then follows the Mughlay printing itself, day by
   day, on the owner's rule. Monday P1 (chapter 6): six سيدنا the printing
   lacks came out (the alternates for v43, v45 and v47 then equalled
   Istanbul and were dropped), and v15, v23, v35 and v42 carry the Mughlay
   reading where the two books differ. Its rosettes then moved to where
   the Mughlay printing marks them (far fewer inside the verses; none after
   v44), and its English is the book's own. The ‖ page breaks stay
   Istanbul's, so leaves line up; phrases don't, which is why saved places
   are kept per version (placeKey). See CLAUDE.md for the list.

   The swap is done IN PLACE on DALAIL_CHAPTERS rather than by keeping a
   second array, so every reader of the text — both readers, search, saved
   places, live sessions — follows the chosen version without being taught
   about it. DALAIL_ISTANBUL is a startup snapshot of every Dalāʾil verse so
   the swap can go back. The source array itself is never edited: it stays
   byte-identical between the two apps, as non-negotiable 6 requires. */
const DALAIL_WITH_SAYYIDINA = contentMap('dalail-mughlay');   // filled by loadContent()
let DALAIL_ISTANBUL = [];
/* Where each chapter's last folio ends in Istanbul: the Mughlay appends verses to a
   chapter (Monday P2), so its folio is stretched to cover them and put back. */
let DALAIL_FOLIO_TO = [];
const stripArCommas = t => t.replace(/\u060C/g, '').replace(/ {2,}/g, ' ').trim();
/* 'istanbul' | 'sayyidina'; unset or unrecognised means Istanbul. Written
   only from setDalailEdition, the reader's own switch. Not synced in a live
   session: the two versions share every verse index, leaf and segment, so a
   leader and a follower on different versions still land on the same place. */
/* Which script the Arabic is set in: 'uthmani' (the standard, KFGQPC Hafs),
   'indopak' (DigitalKhatt IndoPak) or 'naskh' (Scheherazade New). Unset, or
   anything unrecognised, means the version's own default: IndoPak in the
   Mughlay Version, Uthmani in Istanbul (owner's call) — so a reader who
   has never chosen a script sees the Mughlay text in the script of its
   Indo-Pak printing, and switching versions carries the default with it.
   Once a script is chosen it holds in both versions. Written only from
   setArFont, the reader's own switch — like the size, the columns and the
   view, and for the same reason: a live session does not carry it, so a
   follower keeps their own script and nothing a leader does rewrites it.
   Only the font changes; the text is the same bytes either way. */
const FONT_KEY = 'mawlid-font';
const AR_FONTS = { uthmani: null, indopak: 'DKIndoPak', naskh: 'SchNew' };
let arFontChosen = (() => { try { const v = localStorage.getItem(FONT_KEY); return AR_FONTS[v] !== undefined ? v : null; } catch(e){ return null; } })();
/* dalailEdition is declared further down, so on the first call the stored
   version is read directly (the same key and rule as its initialiser). */
function defaultArFont(){
  let ed;
  try { ed = dalailEdition; }
  catch(e){ try { ed = localStorage.getItem('mawlid-edition') === 'sayyidina' ? 'sayyidina' : 'istanbul'; } catch(e2){ ed = 'istanbul'; } }
  return ed === 'sayyidina' ? 'indopak' : 'uthmani';
}
let arFont = arFontChosen || defaultArFont();
function applyArFont(){
  document.documentElement.classList.toggle('ar-indopak', arFont === 'indopak');
  document.documentElement.classList.toggle('ar-naskh', arFont === 'naskh');
}
applyArFont();
const EDITION_KEY = 'mawlid-edition';
let dalailEdition = (() => { try { return localStorage.getItem(EDITION_KEY) === 'sayyidina' ? 'sayyidina' : 'istanbul'; } catch(e){ return 'istanbul'; } })();
function applyDalailEdition(){
  const alt = dalailEdition === 'sayyidina';
  DALAIL_CHAPTERS.forEach((c, ci) => {
    /* The Mughlay prints more after Monday P2's last verse (the author's
       prayers, the four ṣalawāt, the poem), so its alternates may run on past
       the Istanbul verses: "13:14", "13:15"… Those are appended here and cut
       off again on the way back, and the chapter's last folio is stretched to
       cover them, so the Duʿāʾ after the Khatm stays its own chapter and the
       reader goes on to it with Next. */
    const base = DALAIL_ISTANBUL[ci].length;
    c.verses.length = base;
    if(alt) for(let vi = base; DALAIL_WITH_SAYYIDINA[ci + ':' + vi]; vi++){
      const x = DALAIL_WITH_SAYYIDINA[ci + ':' + vi];
      const nv = { ar: stripArCommas(x.ar), tr: x.tr, en: x.en };
      if(x.instruction) nv.instruction = true;
      if(x.noRosette) nv.noRosette = true;
      c.verses.push(nv);
    }
    if(DALAIL_FOLIO_TO[ci] != null) c.folios[c.folios.length - 1].to = c.verses.length > base ? c.verses.length - 1 : DALAIL_FOLIO_TO[ci];
    c.verses.forEach((v, vi) => {
    if(vi >= base) return;
    const ist = DALAIL_ISTANBUL[ci][vi];
    const src = (alt && DALAIL_WITH_SAYYIDINA[ci + ':' + vi]) || ist;
    v.ar = alt ? stripArCommas(src.ar) : src.ar;
    v.tr = src.tr; v.en = src.en;
    /* Where a verse closes differs between the printings too (Monday v44:
       the Mughlay prints no mark after it), so an alternate may carry its
       own noRosette; one that doesn't inherits Istanbul's. */
    const nr = ('noRosette' in src) ? src.noRosette : ist.noRosette;
    if(nr) v.noRosette = true; else delete v.noRosette;
    /* A verse this printing lacks altogether (the Mughlay has no Friday
       v11) is flagged, never deleted — see verseNo below. */
    if(alt && src.omit) v.omit = true; else delete v.omit;
    });
  });
}
/* An omitted verse stays in the array, so every later verse keeps its
   index — places, highlights and live sessions all key on it — and is
   simply not drawn. The verses after it number on as the book would, and
   anything sent to it (a session, an old place) lands on the next one. */
function verseNo(kind, idx, n){
  if(kind !== 'd') return n + 1;
  const vs = (DALAIL_CHAPTERS[idx] || {}).verses || [];
  let k = n + 1;
  for(let i = 0; i < n; i++) if(vs[i] && vs[i].omit) k--;
  return k;
}
function shownVerseN(kind, idx, n){
  if(kind !== 'd' || n == null) return n;
  const vs = (DALAIL_CHAPTERS[idx] || {}).verses || [];
  let m = Number(n);
  if(!(vs[m] && vs[m].omit)) return n;
  while(vs[m] && vs[m].omit) m++;
  if(m >= vs.length){ m = Number(n); while(m > 0 && vs[m].omit) m--; }
  return m;
}
/* Which chapters read differently in the two versions — those with a
   restored سيدنا or an Arabic comma. Only they carry the switch. */
let DALAIL_EDITION_CHAPTERS = [];
const dalailHasEditions = idx => !!DALAIL_EDITION_CHAPTERS[idx];
function editionSwitch(){
  return `<span class="view-switch edition-switch" role="group" aria-label="Version of the Dalāʾil">${
    [['istanbul', 'Istanbul'], ['sayyidina', 'Mughlay']].map(([v, l]) =>
      `<button data-ed="${v}" class="${dalailEdition === v ? 'on' : ''}" aria-pressed="${dalailEdition === v}" onclick="setDalailEdition('${v}')">${l}</button>`).join('')
  }</span>`;
}
/* Switching re-renders an open Dalāʾil reader (the words change, so the
   leaves must be rebuilt). The Book leaves break at the same ‖ in both
   versions, so the Book view keeps the leaf itself — going via the top verse
   landed one leaf early whenever a verse ran on from the previous page; the
   Study view keeps the verse at the top, as the Book/Study toggle does. */
/* A short note that the switch happened and that saved places and
   highlights don't carry across: the two versions divide the text differently, so a place saved in
   one would land on a different phrase in the other. */
function editionToast(msg){
  let t = document.getElementById('ed-toast');
  if(!t){ t = document.createElement('div'); t.id = 'ed-toast'; t.className = 'ed-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(editionToast.timer);
  editionToast.timer = setTimeout(() => t.classList.remove('show'), 3800);
}
function setDalailEdition(v){
  if((v !== 'istanbul' && v !== 'sayyidina') || v === dalailEdition) return;
  dalailEdition = v;
  try { localStorage.setItem(EDITION_KEY, v); } catch(e){}
  applyDalailEdition();
  // Never having chosen a script, the reader gets the version's own.
  if(!arFontChosen && defaultArFont() !== arFont) showArFont(defaultArFont());
  document.querySelectorAll('.edition-switch button').forEach(b => {
    b.classList.toggle('on', b.dataset.ed === v);
    b.setAttribute('aria-pressed', String(b.dataset.ed === v));
  });
  editionToast(v === 'sayyidina'
    ? 'Mughlay Version. Saved places and highlights are kept separately for each version.'
    : 'Istanbul Version. Saved places and highlights are kept separately for each version.');
  const view = renderedView();
  if(view === 'none' || !msPiece || msPiece.kind !== 'd'){
    /* On the Dalāʾil landing page the "Continue where you left off" card
       belongs to the version, so it has to be redrawn. */
    if(view === 'none' && typeof renderIndex === 'function') renderIndex();
    return;
  }
  const idx = msPiece.idx;
  if(view === 'book'){ const page = msCurrentPage(); reopen('d', idx); msGoToWhenReady(page); return; }
  const keep = topVisibleVerse();
  reopen('d', idx);
  afterViewScroll('d', idx, keep);
}
/* Mawlid al-Barzanjī — ʿIqd al-Jawhar fī Mawlid al-Nabī al-Azhar, by Jaʿfar
   ibn Ḥasan al-Barzanjī (d. 1764), Shāfiʿī muftī of Medina. The most widely
   recited mawlid in the world. Sections follow the narrative arc; qasidas are
   interjected between them, and the gathering stands at the birth (al-qiyām).
   Pages are scaffolded empty — paste content in as it's verified. */
/* The mawlid texts, gathered under one hub tab so more can be added
   without crowding the tab bar. */

/* The daily litanies (awrād). Each is read straight through, so each is one
   page rather than a set of chapters. Scaffolded empty for now. */

/* Run once the texts have arrived (see start()). Mawalid does this at load, because
   its texts are inlined in the page; here they are fetched, so at load the arrays are
   still empty. Snapshots the Istanbul text, works out which chapters carry the version
   switch, then applies the reader's stored choice. */
function initDalailEditions(){
  DALAIL_ISTANBUL = DALAIL_CHAPTERS.map(c => c.verses.map(v => ({ ar: v.ar, tr: v.tr, en: v.en, noRosette: !!v.noRosette })));
  DALAIL_FOLIO_TO = DALAIL_CHAPTERS.map(c => (c.folios && c.folios.length) ? c.folios[c.folios.length - 1].to : null);
  DALAIL_EDITION_CHAPTERS = DALAIL_ISTANBUL.map((vs, ci) =>
    vs.some((v, vi) => v.ar.includes('\u060C') || DALAIL_WITH_SAYYIDINA[ci + ':' + vi]));
  applyDalailEdition();
}
/* Everything under Additional Praises. */
const PRAISE_SECTIONS = [
  { id:'qasidas',  ar:'قصائد',          en:'Qasidas',    desc:'Poems in praise of the Prophet ﷺ.' },
  { id:'ilahis',   ar:'الإلهيات',        en:'Ilahis',     desc:'Devotional songs in Turkish, with translation.' },
  { id:'qawwalis', ar:'قوالي',           en:'Qawwalis',   desc:'Sufi devotional music in praise of the Prophet ﷺ.' },
];

/* The mawlid texts, gathered under one hub tab so more can be added
   without crowding the tab bar. */
const MAWLID_COLLECTIONS = [
  { id:'mawlid',   ar:'مولد الدّيبعي',  en:'Mawlid ad-Daybaʿi',  desc:'The mawlid of Imam ad-Daybaʿī — read straight through, in order.' },
  { id:'barzanji', ar:'مولد الْبرزنجي', en:'Mawlid al-Barzanjī', desc:'The most widely recited mawlid in the world, with the qiyām at the birth.' },
  { id:'diya',     ar:'الضياء اللّامع', en:'The Shimmering Light', desc:'Al-Ḥabīb ʿUmar bin Ḥafīẓ’s mawlid, in verse throughout, with the qiyām at the birth.' },
  { id:'burdah',   ar:'قصيدة الْبردة',  en:'Qasida Burdah',       desc:"Imam al-Būṣīrī’s celebrated poem, with audio for every chapter." },
];

/* Bumped with sw.js on every release. Shown small at the foot of the home page
   so you can tell at a glance which build a given phone is actually running. */
const APP_VERSION = 'v392';
/* Where the home-page feedback button sends corrections. Change to your address. */
const FEEDBACK_EMAIL = 'zayd.boon@gmail.com';

/* A very small build stamp: 'v110' shows as 'v11.0' (dot before the last digit),
   so you can tell at a glance which build a phone is running. Hidden on the
   Turkish Ilahis page and nowhere else. */
function versionTag(){
  if(state.tab !== 'ilahis') return '';
  const n = APP_VERSION.replace(/^v/, '');
  /* The point sits after the first digit: 151 shows as 1.51, 21 as 2.1. */
  const shown = n.length > 1 ? n.slice(0, 1) + '.' + n.slice(1) : n;
  return `<div class="build-tag">v${shown}</div>`;
}

/* Sohbets are grouped by who gave them: this list becomes the tiles on the
   Sohbets page, and each entry below names its shaykh with `shaykh:`. To add
   another shaykh, add a row here — the tile, its room and its back-link all
   follow by themselves, no other change needed. */
const SOHBET_SHAYKHS = [
  { id:'nazim',    ar:'الشَّيْخ نَاظِم الْحَقَّانِي',   en:'Shaykh Nazim',
    desc:'Sohbets of Mawlana Shaykh Muhammad Nazim Adil al-Haqqani.' },
  { id:'abdullah', ar:'الشَّيْخ عَبْد اللّٰه الدَّاغِسْتَانِي', en:'Grandshaykh Abdullah',
    desc:'Sohbets of Grandshaykh ʿAbdullah al-Faiz ad-Daghestani.' },
];

/* The home-page menu. theme:'green' is the app's existing brand color;
   the rest cycle through an Ottoman-illumination palette (see the
   --navy/--maroon/... custom properties near the top of the stylesheet).
   Sections not yet built (silsila, turuqs, sohbets, biographies, ottoman)
   render a placeholder() until content is added — see renderResults(). */
const TABS = [
  { id:'mawlids',      label:'Mawlid',              ar:'الْموالد',                theme:'green'   },
  { id:'dalail',       label:'Dalāʾil al-Khayrāt',  ar:'دلائل الْخيرات',          theme:'navy'    },
  { id:'silsila',      label:'Naqshbandi Silsila',  ar:'السِّلْسِلَة النَّقْشَبَنْدِيَّة', theme:'maroon'  },
  { id:'turuqs',       label:'Turuqs',              ar:'الطُّرُق الصُّوفِيَّة',        theme:'teal'    },
  { id:'sohbets',      label:'Sohbets',             ar:'الصُّحْبَة',               theme:'ochre'   },
  { id:'praises',      label:'Qasidas',             ar:'القصائد',                 theme:'plum'    },
  { id:'biographies',  label:'Biographies',         ar:'التَّرَاجِم',              theme:'rust'    },
  { id:'ottoman',      label:'Ottoman History',     ar:'التَّارِيخ الْعُثْمَانِي',      theme:'indigo'  },
  { id:'more',         label:'More Soon',           ar:'وَقَرِيبًا الْمَزِيد',        theme:'neutral' },
];

/* A hub tab stays highlighted while you're inside any of its sections.
   Entries for tabs that are no longer on the home menu (praises/litanies)
   are kept: their pages are still fully reachable (search, favorites,
   in-page links) and this keeps their own back-links correctly lit up. */
const TAB_CHILDREN = {
  dalail:  ['before','downloads'],
  litanies: ['azam','istighfar'],
  mawlids: ['mawlid','barzanji','diya','burdah'],
  praises: ['qasidas','qasidas-burdah','ilahis','qawwalis'],
  /* One child tab per shaykh: 'sohbet-nazim', 'sohbet-abdullah', … */
  sohbets: SOHBET_SHAYKHS.map(s => 'sohbet-' + s.id),
};

function tabIsActive(id){
  return state.tab === id || (TAB_CHILDREN[id] || []).indexOf(state.tab) !== -1;
}

/* Every tab/child id maps to the palette color of its top-level menu tile,
   so a section's whole chrome (header, reader bar, floating docks) follows
   its home-tile color. Built from TABS + TAB_CHILDREN so the two stay in
   sync; ids no longer on the home menu keep a sensible color rather than
   an error (they simply fall back to green if unlisted). */
const SECTION_THEME = { ilahis:'plum', praises:'plum', nasheeds:'plum', qasidas:'plum', qawwalis:'plum',
                         litanies:'navy', azam:'navy', istighfar:'navy', favs:'green', session:'green', home:'green' };
TABS.forEach(t => { SECTION_THEME[t.id] = t.theme; });
Object.keys(TAB_CHILDREN).forEach(parent => {
  const theme = SECTION_THEME[parent];
  if(theme) TAB_CHILDREN[parent].forEach(child => { SECTION_THEME[child] = theme; });
});
function sectionThemeOf(tab){ return SECTION_THEME[tab] || 'green'; }

function navBar(){
  return `<nav class="tabbar">${TABS.map(t=>`
    <button class="tab ${tabIsActive(t.id)?'active':''}" onclick="selectTab('${t.id}')">
      <span class="tab-en">${t.label}</span>
      <span class="tab-ar">${t.ar}</span>
    </button>`).join('')}</nav>`;
}

function selectTab(id){
  setImmersive(false);
  leftTheLeader();
  state.tab = id;
  state.query = '';
  state.burdahChapter = null;
  renderIndex();
  pushLoc();
}

/* Cards for a given group, honoring the search query. */
/* ── Mawlid ad-Daybaʿi: one ordered section ──────────────────────
   The mawlid's pieces live in two arrays: QASIDAS (its duas and qasidas)
   and SIRAH_CHAPTERS (its prose). Each carries its section number from the
   kitab in its title, e.g. "13b · …". We merge both and sort by that number
   so the tab follows the book's own order. A qasida with NO section number
   didn't come from the mawlid — it belongs under the Qasidas tab. */
const SECTION_RE = /^(\d+)(b?)\s*·\s*(.*)$/;

function sectionOf(title){
  const m = SECTION_RE.exec(title || '');
  if(!m) return null;
  return { num: +m[1] + (m[2] ? 0.5 : 0), label: m[1] + m[2], rest: m[3] };
}

function mawlidItems(){
  const items = [];
  QASIDAS.forEach((qa, i) => {
    const sec = sectionOf(qa.titleEnglish);
    if(sec) items.push({ sec, kind:'q', idx:i, piece:qa });
  });
  SIRAH_CHAPTERS.forEach((c, n) => {
    const sec = sectionOf(c.titleEnglish);
    if(sec) items.push({ sec, kind:'s', idx:n, piece:c });
  });
  items.sort((a,b) => a.sec.num - b.sec.num);
  /* Number them 1..N by their place in the kitab's order. The badge is a
     running position, not the kitab's own number, so the list never skips
     even though some of the kitab's sections aren't in the app yet. Adding a
     missing section later slots it in and renumbers everything automatically. */
  items.forEach((it, n) => { it.pos = n + 1; });
  return items;
}

function mawlidCards(){
  /* Position is assigned before filtering, so searching never renumbers. */
  const items = mawlidItems().filter(x => matchesQuery(x.piece, state.query));
  if(items.length === 0) return '';
  return items.map(({pos, kind, idx, piece}) => `
        <button class="qcard" onclick="${kind==='s' ? 'openSirah' : 'openQasida'}(${idx})">
          <span class="num">${toArNum(pos)}</span>
          <span class="titles">
            <span class="t-ar">${piece.titleArabic}</span>
            <span class="t-en">${sectionOf(piece.titleEnglish).rest}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList(kind, idx)).join('');
}

/* Qasidas that did not come from the Mawlid ad-Daybaʿi */
/* Qasidas that did not come from the mawlid — the source of truth for both
   the Qasidas tab and the landing page's count. */
function additionalQasidaItems(){
  return QASIDAS.map((qa,i) => ({q:qa, i}))
    .filter(x => x.q.group === 'qasidas' && !x.q.retired && !sectionOf(x.q.titleEnglish));
}
/* The qasidas sung within the Mawlid ad-Daybaʿī, in the kitab's order (v456,
   owner's call). The Qasidas page lists them too, after the rest so the
   numbers people already use there do not move. They are the same entries,
   not copies, so a fix or a recording shows in both places. */
function daybaiQasidaItems(){
  return mawlidItems().filter(x => x.kind === 'q' && x.piece.group === 'qasidas')
    .map(x => ({q:x.piece, i:x.idx}));
}

/* Qasida al-Burdah isn't a QASIDAS entry — it's a synthetic card that opens
   the full, 10-chapter, fully-diacritized Burdah (BURDAH_CHAPTERS) as its own
   styled sub-list, so a chapter is one tap further in rather than duplicating
   any of its content back into this array. */
const QASIDA_BURDAH_ENTRY = { titleArabic: "قَصِيدَةُ الْبُرْدَة", titleEnglish: "Qasida al-Burdah · 10 chapters", verses: [] };

function additionalQasidaCards(){
  const items = additionalQasidaItems().filter(x => matchesQuery(x.q, state.query));
  const showBurdah = matchesQuery(QASIDA_BURDAH_ENTRY, state.query);
  if(items.length === 0 && !showBurdah) return '';
  let n = 0, out = '';
  if(showBurdah){
    n++;
    out += `
        <button class="qcard" onclick="selectTab('qasidas-burdah')">
          <span class="num">${toArNum(n)}</span>
          <span class="titles">
            <span class="t-ar">${QASIDA_BURDAH_ENTRY.titleArabic}</span>
            <span class="t-en">${QASIDA_BURDAH_ENTRY.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>`;
  }
  const card = ({q:qa, i}) => {
    n++;
    const sec = sectionOf(qa.titleEnglish);
    return `
        <button class="qcard" onclick="openQasida(${i})">
          <span class="num">${toArNum(n)}</span>
          <span class="titles">
            <span class="t-ar">${qa.titleArabic}</span>
            <span class="t-en">${sec ? sec.rest : qa.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('q', i);
  };
  out += items.map(card).join('');
  /* A search already shows these under the Mawlid ad-Daybaʿī heading. */
  if(!state.query){
    const daybai = daybaiQasidaItems();
    if(daybai.length) out += label('From the Mawlid ad-Daybaʿī · من الْمولد الدّيبعي', true) + daybai.map(card).join('');
  }
  return out;
}

function groupCards(group){
  const q = state.query;
  let items = QASIDAS.map((qa,i)=>({q:qa,i}))
    .filter(x=>x.q.group===group)
    .filter(x=>matchesQuery(x.q, q));
  if(q){
    const nq = normalize(q);
    const titleHit = (qa) => {
      const t = normalize(qa.titleEnglish + ' ' + qa.titleArabic);
      return (nq && t.includes(nq)) || (qa.titleEnglish + qa.titleArabic).toLowerCase().includes(q.toLowerCase().trim());
    };
    items.sort((a,b)=> (titleHit(b.q)?1:0) - (titleHit(a.q)?1:0));
  }
  if(items.length === 0) return '';
  return items.map(({q:qa,i},n)=>`
        <button class="qcard" onclick="openQasida(${i})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar">${qa.titleArabic}</span>
            <span class="t-en">${qa.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('q', i)).join('');
}

function searchBox(atBottom){
  /* Resting placeholder is just "Search"; the fuller hint appears once you're
     actually typing, so the bar stays quiet on the page. */
  return `
      <div class="search-wrap${atBottom ? ' at-bottom' : ''}">
        <svg class="search-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"
             stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="7" cy="7" r="4.4"/><line x1="10.4" y1="10.4" x2="14.2" y2="14.2"/>
        </svg>
        <input id="search" class="search" type="search" inputmode="search"
          placeholder="Search"
          onfocus="this.placeholder='e.g. ya nabi, salaam, mercy…'"
          onblur="this.placeholder='Search'"
          autocomplete="off" autocapitalize="off" autocorrect="off"
          value="${state.query.replace(/"/g,'&quot;')}"
          oninput="updateSearch(this.value)">
        ${state.query ? '<button class="search-clear" onclick="clearSearch()">✕</button>' : ''}
      </div>`;
}

function updateSearch(val){
  state.query = val;
  const results = document.getElementById('results');
  if(results) results.innerHTML = renderResults() + versionTag();
}

/* Placeholder shown for sections whose content isn't added yet. */
function placeholder(title){
  return `<div class="placeholder">
      <div class="ph-star">۞</div>
      <p><strong>${title}</strong></p>
      <p>No entries here yet. This section is ready — its contents can be added whenever you like.</p>
    </div>`;
}

function burdahCards(){
  const items = BURDAH_CHAPTERS.map((c,n)=>({c,n})).filter(x=>matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({c,n})=>`
        <button class="qcard" onclick="openBurdah(${n})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar">${c.titleArabic}</span>
            <span class="t-en">${c.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('b', n)).join('');
}

function nasheedCards(){
  const items = NASHEED_CHAPTERS.map((c,n)=>({c,n})).filter(x=>matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({c,n})=>`
        <button class="qcard" onclick="openNasheed(${n})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar">${c.titleArabic}</span>
            <span class="t-en">${c.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('n', n)).join('');
}

/* A small circular portrait beside a master's name, badged with their place
   in the chain. `c.image` is a data: URI or https URL for a real portrait;
   most entries start with none, so this falls back to a plain initial drawn
   from the Arabic title — a placeholder ready to be swapped for a thumbnail
   once one is added to the entry. */
function silsilaAvatar(c, n){
  const initial = (c.titleArabic || '').trim().charAt(0);
  return `
        <span class="master-avatar" aria-hidden="true">
          ${c.image
            ? `<img src="${c.image}" alt="" loading="lazy">`
            : `<span class="ph-initial">${initial}</span>`}
          <span class="badge">${toArNum(n+1)}</span>
        </span>`;
}

/* Index rows for the Academy sections. Each mirrors nasheedCards():
   empty array in, empty string out, so renderResults() can fall through
   to placeholder() until the section has content. */
function silsilaCards(){
  const items = SILSILA_CHAPTERS.map((c,n)=>({c,n})).filter(x=>matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({c,n})=>`
        <button class="qcard qcard-silsila" onclick="openSilsila(${n})">
          ${silsilaAvatar(c, n)}
          <span class="titles">
            <span class="t-ar"${c.latin ? ` style="font-family:'Crimson Pro',serif;direction:ltr;text-align:left"` : ''}>${c.titleArabic}</span>
            <span class="t-en">${c.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('c', n)).join('');
}

function turuqCards(){
  const items = TURUQ_CHAPTERS.map((c,n)=>({c,n})).filter(x=>matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({c,n})=>`
        <button class="qcard" onclick="openTuruq(${n})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar"${c.latin ? ` style="font-family:'Crimson Pro',serif;direction:ltr;text-align:left"` : ''}>${c.titleArabic}</span>
            <span class="t-en">${c.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('t', n)).join('');
}

/* Where and when it was given, said plainly when it isn't known. */
function sohbetMeta(c){
  const where = (c.location || '').trim(), when = (c.date || '').trim();
  if(where && when) return where + ' · ' + when;
  if(where) return where + ' · date unknown';
  if(when)  return 'Location unknown · ' + when;
  return 'Location and date unknown';
}
function shaykhOf(id){ return SOHBET_SHAYKHS.find(s => s.id === id) || null; }

/* The Sohbets page itself: one tile per shaykh, each opening their own room. */
function sohbetsHub(){
  return SOHBET_SHAYKHS.map(s => {
    const n = SOHBET_CHAPTERS.filter(c => c.shaykh === s.id).length;
    return `
      <button class="home-card" onclick="selectTab('sohbet-${s.id}')">
        <span class="hc-ar">${s.ar}</span>
        <span class="hc-en">${s.en}</span>
        <span class="hc-count">${n ? n + (n === 1 ? ' sohbet' : ' sohbets') : 'Coming soon'}</span>
      </button>`;
  }).join('');
}

/* One shaykh's sohbets. Called with no argument (from search) it lists them
   all. n stays the index into SOHBET_CHAPTERS, so bookmarks and openSohbet()
   keep pointing at the right piece however the list is filtered. */
function sohbetCards(shaykhId){
  const items = SOHBET_CHAPTERS.map((c,n)=>({c,n}))
    .filter(x => !shaykhId || x.c.shaykh === shaykhId)
    .filter(x => matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({c,n})=>`
        <button class="qcard" onclick="openSohbet(${n})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar"${c.latin ? ` style="font-family:'Crimson Pro',serif;direction:ltr;text-align:left"` : ''}>${c.titleArabic}</span>
            ${sameTitle(c.titleEnglish, c.titleArabic) ? '' : `<span class="t-en">${c.titleEnglish}</span>`}
            <span class="t-meta">${sohbetMeta(c)}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('h', n)).join('');
}

function backToSohbets(){
  return `<button class="back-link" onclick="selectTab('sohbets')">‹ Sohbets</button>`;
}

function biographyCards(){
  const items = BIOGRAPHY_CHAPTERS.map((c,n)=>({c,n})).filter(x=>matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({c,n})=>`
        <button class="qcard" onclick="openBiography(${n})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar"${c.latin ? ` style="font-family:'Crimson Pro',serif;direction:ltr;text-align:left"` : ''}>${c.titleArabic}</span>
            <span class="t-en">${c.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('g', n)).join('');
}

function ottomanCards(){
  const items = OTTOMAN_CHAPTERS.map((c,n)=>({c,n})).filter(x=>matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({c,n})=>`
        <button class="qcard" onclick="openOttoman(${n})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar"${c.latin ? ` style="font-family:'Crimson Pro',serif;direction:ltr;text-align:left"` : ''}>${c.titleArabic}</span>
            <span class="t-en">${c.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('o', n)).join('');
}

function litanyCards(){
  /* Browsing, the seven daily portions of al-Ḥizb al-Aʿẓam are folded behind a
     single row that opens their own page. A search still lists them one by one,
     so no portion becomes unreachable from the search box. */
  const grouped = !state.query && (azamFilledDays().length || istighfarFilledDays().length);
  const items = LITANY_CHAPTERS.map((c,n)=>({c,n})).filter(x=>
    x.c.verses && x.c.verses.length
    && !(grouped && (isAzamDay(x.n) || isIstighfarDay(x.n)))
    && matchesQuery(x.c, state.query));
  let out = items.map(({c,n}, i)=>`
        <button class="qcard" onclick="openLitany(${n})">
          <span class="num">${toArNum(i+1)}</span>
          <span class="titles">
            <span class="t-ar">${c.titleArabic}</span>
            <span class="t-en">${c.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('l', n)).join('');
  if(grouped && azamFilledDays().length){
    const n = azamFilledDays().length;
    out += `
        <button class="qcard" onclick="selectTab('azam')">
          <span class="num">${toArNum(items.length + 1)}</span>
          <span class="titles">
            <span class="t-ar">${collectionTitle(AZAM_TITLE_IDX).ar}</span>
            <span class="t-en">${collectionTitle(AZAM_TITLE_IDX).en} · ${n} daily ${n === 1 ? 'portion' : 'portions'}</span>
          </span>
          <span class="chev">›</span>
        </button>`;
  }
  if(grouped && istighfarFilledDays().length){
    const n = istighfarFilledDays().length;
    const shown = items.length + (azamFilledDays().length ? 1 : 0) + 1;
    out += `
        <button class="qcard" onclick="selectTab('istighfar')">
          <span class="num">${toArNum(shown)}</span>
          <span class="titles">
            <span class="t-ar">${collectionTitle(ISTIGHFAR_TITLE_IDX).ar}</span>
            <span class="t-en">${collectionTitle(ISTIGHFAR_TITLE_IDX).en} · ${n} daily ${n === 1 ? 'portion' : 'portions'}</span>
          </span>
          <span class="chev">›</span>
        </button>`;
  }
  return out;
}

function praisesHub(){
  return PRAISE_SECTIONS.map(c=>`
      <button class="home-card" onclick="selectTab('${c.id}')">
        <span class="hc-ar">${c.ar}</span>
        <span class="hc-en">${c.en}</span>
        <span class="hc-count">${countLabel(c.id, sectionCount(c.id))}</span>
      </button>`).join('');
}

function backToPraises(){
  return `<button class="back-link" onclick="selectTab('praises')">‹ Qasidas</button>`;
}

function backToQasidasList(){
  return `<button class="back-link" onclick="selectTab('qasidas')">‹ Qasidas</button>`;
}

function backToDalail(){
  return `<button class="back-link" onclick="selectTab('dalail')">‹ Dalāʾil al-Khayrāt</button>`;
}

function mawlidsHub(){
  return MAWLID_COLLECTIONS.map(c=>`
      <button class="home-card" onclick="selectTab('${c.id}')">
        <span class="hc-ar">${c.ar}</span>
        <span class="hc-en">${c.en}</span>
        <span class="hc-count">${countLabel(c.id, sectionCount(c.id))}</span>
      </button>`).join('');
}

function backToMawlids(){
  return `<button class="back-link" onclick="selectTab('mawlids')">‹ Mawlid Collections</button>`;
}

/* The gathering's response is a practice, not part of the text, so it is
   stated once here rather than printed after every verse. */
function barzanjiResponseNote(){
  return `<div class="barz-note">${noteBlock("It is common practice for the gathering to respond with ṣallā Allāhu ʿalayh or Allāh after each verse the reciter reads.<span class=\"qnote-ar\">صَلَّى اللّٰهُ عَلَيْهِ · اللّٰه</span>")}</div>`;
}

function barzanjiCards(){
  const items = BARZANJI_CHAPTERS.map((c,n)=>({c,n})).filter(x=>matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({c,n})=>`
        <button class="qcard" onclick="openBarzanji(${n})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar">${c.titleArabic}</span>
            <span class="t-en">${c.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('z', n)).join('');
}
function diyaCards(){
  const items = DIYA_CHAPTERS.map((c,n)=>({c,n})).filter(x=>matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({c,n})=>`
        <button class="qcard" onclick="openDiya(${n})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar">${c.titleArabic}</span>
            <span class="t-en">${c.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('y', n)).join('');
}

/* One Dalāʾil chapter as an index card. Shared by the flat search list and the
   grouped browse index below, so both stay in step. */
function dalailCard(n){
  const c = DALAIL_CHAPTERS[n];
  return `
        <button class="qcard" onclick="openDalail(${n})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-en lead">${c.titleEnglish}</span>
            <span class="t-ar">${c.titleArabic}</span>
          </span>
          <span class="chev">›</span>
        </button>`;
}

/* SEARCH uses this — a flat, query-filtered list. The browse index uses
   dalailIndex() instead. Keep this filtered and flat. */
function dalailCards(){
  const items = DALAIL_CHAPTERS.map((c,n)=>({c,n})).filter(x=>x.n !== 0 && matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({n})=>dalailCard(n) + hitList('d', n)).join('');
}

/* The daily portion for today — Monday opens Part 1; the second Monday portion
   (Mon²) is reached from the strip. JS getDay(): 0=Sun … 6=Sat. */
const DALAIL_WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DALAIL_TODAY_IDX = { 1:6, 2:7, 3:8, 4:9, 5:10, 6:11, 0:12 };
function dalailTodayIdx(){ return DALAIL_TODAY_IDX[new Date().getDay()]; }

/* The week strip and the three collapsible groups. */
const DALAIL_DAYS = [
  {idx:6,  en:'Mon',        ar:'الِاثْنَيْن'},
  {idx:7,  en:'Tue',        ar:'الثُّلَاثَاء'},
  {idx:8,  en:'Wed',        ar:'الأَرْبِعَاء'},
  {idx:9,  en:'Thu',        ar:'الْخَمِيس'},
  {idx:10, en:'Fri',        ar:'الْجُمُعَة'},
  {idx:11, en:'Sat',        ar:'السَّبْت'},
  {idx:12, en:'Sun',        ar:'الأَحَد'},
  {idx:13, en:'Mon \u00B2', ar:'الِاثْنَيْن ٢'},
];
const DALAIL_ROWS = {
  before: {en:'Before the reading', ar:'قَبْلَ الْقِرَاءَةِ'},
  daily:  {en:'The daily portions', ar:'الْأَحْزَابُ الْيَوْمِيَّةُ'},
  done:   {en:'On completion',      ar:'عِنْدَ الْخَتْمِ'},
};
/* The Dalāʾil browse index — Option E: a today card, the resume ribbon, a week
   strip, then the parts in three collapsible groups. NOT used for search. */
function dalailIndex(){
  const today = dalailTodayIdx();
  const t = DALAIL_CHAPTERS[today];
  const todayCard = `<button class="dk-today" onclick="openDalail(${today})">
      <span class="dk-today-k">Today · ${DALAIL_WEEKDAYS[new Date().getDay()]}</span>
      <span class="dk-today-ar">${t.titleArabic}</span>
      <span class="dk-today-go">Open this portion ›</span></button>`;
  const rowlab = r => `<div class="dk-rowlab"><span class="l-en">${r.en}</span><span class="l-ar">${r.ar}</span></div>`;
  // The daily portions grid comes first — four to a line, Mon² last; today highlighted.
  const days = DALAIL_DAYS.map(d =>
    `<button class="dk-bubble${d.idx === today ? ' on' : ''}" onclick="openDalail(${d.idx})"><span class="b-en">${d.en}</span><span class="b-ar">${d.ar}</span></button>`).join('');
  // Secondary entries below a divider — one shared row style.
  const navRow = (action, en, ar) => `<button class="dk-nav" onclick="${action}"><span class="dk-nav-txt"><span class="b-en">${en}</span><span class="b-ar">${ar}</span></span><span class="dk-nav-go">›</span></button>`;
  const before = navRow("selectTab('before')", DALAIL_ROWS.before.en, DALAIL_ROWS.before.ar);
  const rows =
      navRow("openDalail(14)",        DALAIL_ROWS.done.en,   DALAIL_ROWS.done.ar)
    + navRow("selectTab('downloads')", 'Downloaded recitations', 'التَّسْجِيلَاتُ الْمَحْفُوظَةُ')
    + navRow("openDalail(0)",         'About Dalāʾil al-Khayrāt', 'دَلَائِلُ الْخَيْرَاتِ');
  return `<div class="edition-row"><span class="edition-k">Version</span>${editionSwitch()}</div>` + todayCard + resumeCard()
    + before
    + rowlab(DALAIL_ROWS.daily) + `<div class="dk-grid4">${days}</div>`
    + `<div class="dk-sep"></div>`
    + rows;
}
/* ── Al-Ḥizb al-Aʿẓam: the seven daily portions ──
   They sit at LITANY_CHAPTERS[4]…[10] in the book's own order, Saturday first.
   JS getDay(): 0=Sun … 6=Sat. */
const AZAM_FIRST = 4;
const AZAM_DAYS = [
  { idx:4,  en:'Sat', ar:'السَّبْت' },
  { idx:5,  en:'Sun', ar:'الأَحَد' },
  { idx:6,  en:'Mon', ar:'الِاثْنَيْن' },
  { idx:7,  en:'Tue', ar:'الثُّلَاثَاء' },
  { idx:8,  en:'Wed', ar:'الأَرْبِعَاء' },
  { idx:9,  en:'Thu', ar:'الْخَمِيس' },
  { idx:10, en:'Fri', ar:'الْجُمُعَة' },
];
const AZAM_TODAY_IDX = { 0:5, 1:6, 2:7, 3:8, 4:9, 5:10, 6:4 };
function azamTodayIdx(){ return AZAM_TODAY_IDX[new Date().getDay()]; }
function isAzamDay(n){ return n >= AZAM_FIRST && n <= AZAM_FIRST + 6; }
/* Only the portions that actually carry text — an unfilled day stays hidden,
   and reappears by itself once its verses are in. */
function azamFilledDays(){
  return AZAM_DAYS.filter(d => {
    const c = LITANY_CHAPTERS[d.idx];
    return c && c.verses && c.verses.length;
  });
}

/* The Aʿẓam sub-page: today's portion, then the week. Deliberately the same
   furniture as the Dalāʾil index — .dk-today and the 4-column bubble grid. */
function azamIndex(){
  const days = azamFilledDays();
  if(!days.length) return placeholder(collectionTitle(AZAM_TITLE_IDX).en);
  const today = azamTodayIdx();
  const t = LITANY_CHAPTERS[today];
  const todayCard = (t && t.verses && t.verses.length)
    ? `<button class="dk-today" onclick="openLitany(${today})">
      <span class="dk-today-k">Today · ${DALAIL_WEEKDAYS[new Date().getDay()]}</span>
      <span class="dk-today-ar">${t.titleArabic}</span>
      <span class="dk-today-go">Open this portion ›</span></button>`
    : '';
  const bubbles = days.map(d =>
    `<button class="dk-bubble${d.idx === today ? ' on' : ''}" onclick="openLitany(${d.idx})"><span class="b-en">${d.en}</span><span class="b-ar">${d.ar}</span></button>`).join('');
  const rowlab = `<div class="dk-rowlab"><span class="l-en">The daily portions</span><span class="l-ar">الْأَوْرَادُ الْيَوْمِيَّةُ</span></div>`;
  return todayCard + rowlab + `<div class="dk-grid4">${bubbles}</div>`;
}
/* ── al-Ḥizb al-Istighfār: seven daily portions ──────────────────
   Same shape as the Aʿẓam block above, but this work opens on FRIDAY in the
   printed edition (pp. 231 onward), so the week is ordered Fri → Thu and the
   getDay() map differs. [2] stays the reserved title slot, unfilled. */
/* The reserved title slots: LITANY_CHAPTERS[3] names al-Ḥizb al-Aʿẓam and
   [2] names Ḥizb al-Istighfār. They carry no verses — the seven daily
   portions of each live at [4]–[10] and [11]–[17] — so the slot's job is to
   hold the collection's own name, which the Al-Aḥzāb row and the sub-page
   header both read from here rather than repeating it as a literal. */
const AZAM_TITLE_IDX = 3;
const ISTIGHFAR_TITLE_IDX = 2;
function collectionTitle(i){
  const c = LITANY_CHAPTERS[i] || {};
  return { ar: c.titleArabic || '', en: c.titleEnglish || '' };
}

const ISTIGHFAR_FIRST = 11;
const ISTIGHFAR_DAYS = [
  { idx:11, en:'Fri', ar:'الْجُمُعَة' },
  { idx:12, en:'Sat', ar:'السَّبْت' },
  { idx:13, en:'Sun', ar:'الأَحَد' },
  { idx:14, en:'Mon', ar:'الِاثْنَيْن' },
  { idx:15, en:'Tue', ar:'الثُّلَاثَاء' },
  { idx:16, en:'Wed', ar:'الأَرْبِعَاء' },
  { idx:17, en:'Thu', ar:'الْخَمِيس' },
];
const ISTIGHFAR_TODAY_IDX = { 0:13, 1:14, 2:15, 3:16, 4:17, 5:11, 6:12 };
function istighfarTodayIdx(){ return ISTIGHFAR_TODAY_IDX[new Date().getDay()]; }
function isIstighfarDay(n){ return n >= ISTIGHFAR_FIRST && n <= ISTIGHFAR_FIRST + 6; }
function istighfarFilledDays(){
  return ISTIGHFAR_DAYS.filter(d => {
    const c = LITANY_CHAPTERS[d.idx];
    return c && c.verses && c.verses.length;
  });
}

function istighfarIndex(){
  const days = istighfarFilledDays();
  if(!days.length) return placeholder(collectionTitle(ISTIGHFAR_TITLE_IDX).en);
  const today = istighfarTodayIdx();
  const t = LITANY_CHAPTERS[today];
  const todayCard = (t && t.verses && t.verses.length)
    ? `<button class="dk-today" onclick="openLitany(${today})">
      <span class="dk-today-k">Today · ${DALAIL_WEEKDAYS[new Date().getDay()]}</span>
      <span class="dk-today-ar">${t.titleArabic}</span>
      <span class="dk-today-go">Open this portion ›</span></button>`
    : '';
  const bubbles = days.map(d =>
    `<button class="dk-bubble${d.idx === today ? ' on' : ''}" onclick="openLitany(${d.idx})"><span class="b-en">${d.en}</span><span class="b-ar">${d.ar}</span></button>`).join('');
  const rowlab = `<div class="dk-rowlab"><span class="l-en">The daily portions</span><span class="l-ar">الْأَوْرَادُ الْيَوْمِيَّةُ</span></div>`;
  return todayCard + rowlab + `<div class="dk-grid4">${bubbles}</div>`;
}

/* The collection's own name, heading its sub-page. */
function collectionLabel(i){
  const t = collectionTitle(i);
  return (t.en || t.ar) ? label(t.en + (t.ar ? ' · ' + t.ar : '')) : '';
}

function backToLitanies(){
  return `<button class="back-link" onclick="selectTab('litanies')">‹ Al-Aḥzāb</button>`;
}

/* The Dalāʾil intro line, made tappable — it opens the book's title page, which
   is otherwise unlisted (its content lives at chapter index 0). */
function dalailIntro(){
  const c = HOME_CARDS.find(x => x.id === 'dalail')
         || (typeof MAWLID_COLLECTIONS !== 'undefined' && MAWLID_COLLECTIONS.find(x => x.id === 'dalail'))
         || (typeof PRAISE_SECTIONS !== 'undefined' && PRAISE_SECTIONS.find(x => x.id === 'dalail'));
  const desc = (c && c.desc) ? c.desc : '';
  if(!desc) return sectionIntro('dalail');
  return `<button class="section-intro dalail-intro" onclick="openDalail(0)" aria-label="Open the title page of the book">${desc}<span class="di-go">›</span></button>`;
}

/* The "Before the reading" sub-page — the openings, idx 1–5. The title page
   (idx 0) is deliberately omitted; it is reached from the tappable intro. */
function dalailBeforeCards(){
  let out = '';
  for(let n = 1; n <= 5; n++) out += dalailCard(n);
  return out;
}

function ilahiCards(){
  const items = ILAHI_CHAPTERS.map((c,n)=>({c,n})).filter(x=>matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({c,n})=>`
        <button class="qcard" onclick="openIlahi(${n})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar" style="font-family:'Crimson Pro',serif;direction:ltr;text-align:left">${c.titleArabic}</span>
            <span class="t-en">${c.titleEnglish}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('i', n)).join('');
}

/* Qawwalis carry no separate English gloss of their title (unlike the Ilahis'
   "Title — meaning"), so the card's second line shows the poet/performer
   instead — still real, sourced data, not an invented translation. */
function qawwaliCards(){
  const items = QAWWALI_CHAPTERS.map((c,n)=>({c,n})).filter(x=>matchesQuery(x.c, state.query));
  if(items.length === 0) return '';
  return items.map(({c,n})=>`
        <button class="qcard" onclick="openQawwali(${n})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar" style="font-family:'Crimson Pro',serif;direction:ltr;text-align:left">${c.titleArabic}</span>
            <span class="t-en">${c.poet}</span>
          </span>
          <span class="chev">›</span>
        </button>` + hitList('w', n)).join('');
}

/* ONE table of reader openers, keyed by kind. openFnOf() and reopen() both
   read it, so the two can no longer drift — which is exactly how the Ḍiyāʾ
   ('y') came to be missing from reopen() while openFnOf() had it, sending
   every Ḍiyāʾ control and every follower in a live session into QASIDAS. */
const OPENERS = {
  q: 'openQasida',  b: 'openBurdah',   s: 'openSirah',
  i: 'openIlahi',   d: 'openDalail',   z: 'openBarzanji',
  y: 'openDiya',    n: 'openNasheed',  l: 'openLitany',
  w: 'openQawwali',
  c: 'openSilsila',
  t: 'openTuruq',
  h: 'openSohbet',
  g: 'openBiography',
  o: 'openOttoman'
};
function openFnOf(kind){ return OPENERS[kind] || 'openQasida'; }
/* Do these two titles say the same thing once the leading "N ·" is off? */
function sameTitle(a, b){
  const strip = t => { const s = sectionOf(String(t || '')); return (s ? s.rest : String(t || '')).trim(); };
  return !!a && !!b && strip(a) === strip(b);
}
/* Mawlid pieces carry their kitab number in the title; drop it for display. */
function displayTitle(piece){
  const s = sectionOf(piece.titleEnglish);
  return s ? s.rest : piece.titleEnglish;
}
/* ── Landing page ────────────────────────────────────────────────
   The app opens here rather than dropping straight into the mawlid, so the
   calligraphy has room and each section can introduce itself. Counts are
   computed live, so they stay right as content is added. */
/* The home-page tile grid. id/ar/en/desc mirror TABS; theme picks the
   tile's Ottoman-palette color (see TABS above — kept here too since
   homeCards() reads desc, which TABS doesn't carry). 'more' is an open
   placeholder tile, not a real destination yet. Favorites stays reachable
   via a small header icon (see favMark()) rather than a home tile, so
   bookmarking isn't lost even though it's off the main menu. */
const HOME_CARDS = [
  { id:'mawlids',     ar:'الْموالد',                       en:'Mawlid',             theme:'green',   desc:'The mawlid texts and Qasida Burdah — choose a collection to recite from.' },
  { id:'dalail',      ar:'دلائل الْخيرات',                  en:'Dalāʾil al-Khayrāt', theme:'navy',    desc:'Imam al-Jazūlī’s book of blessings upon the Prophet ﷺ, divided for the week.' },
  { id:'silsila',     ar:'السِّلْسِلَة النَّقْشَبَنْدِيَّة',            en:'Naqshbandi Silsila', theme:'maroon',  desc:'The chain of transmission connecting the Naqshbandi masters, shaykh to shaykh, back to the Prophet ﷺ.' },
  { id:'turuqs',      ar:'الطُّرُق الصُّوفِيَّة',                  en:'Turuqs',             theme:'teal',    desc:'An introduction to the Sufi orders (ṭuruq) and their paths of devotion.' },
  { id:'sohbets',     ar:'الصُّحْبَة',                        en:'Sohbets',            theme:'ochre',   desc:'Talks and spiritual counsel from the shaykhs, for reflection and practice.' },
  { id:'praises',     ar:'القصائد',                        en:'Qasidas',            theme:'plum',    desc:'Qasidas, ilahis and qawwalis.' },
  { id:'biographies', ar:'التَّرَاجِم',                       en:'Biographies',        theme:'rust',    desc:'Lives of the awliyā’ and scholars of the silsila, in brief.' },
  { id:'ottoman',     ar:'التَّارِيخ الْعُثْمَانِي',                en:'Ottoman History',    theme:'indigo',  desc:'The Ottoman caliphate’s history and its place in the transmission of the dīn.' },
  { id:'more',        ar:'وَقَرِيبًا الْمَزِيد',                  en:'More Soon',          theme:'more',    desc:'Further sections are on their way — check back as they’re added.' },
];

function sectionCount(id){
  return id === 'mawlids' ? MAWLID_COLLECTIONS.length
       : id === 'praises' ? PRAISE_SECTIONS.length
       : id === 'litanies'? LITANY_CHAPTERS.filter((c,n)=>c.verses && c.verses.length && !isAzamDay(n) && !isIstighfarDay(n)).length + (azamFilledDays().length ? 1 : 0) + (istighfarFilledDays().length ? 1 : 0)
       : id === 'azam'    ? azamFilledDays().length
       : id === 'istighfar'? istighfarFilledDays().length
       : id === 'qawwalis'? QAWWALI_CHAPTERS.length
       : id === 'mawlid'  ? mawlidItems().length
       : id === 'qasidas' ? additionalQasidaItems().length + daybaiQasidaItems().length + 1 /* +1 for the Qasida al-Burdah entry */
       : id === 'burdah'  ? BURDAH_CHAPTERS.length
       : id === 'dalail'  ? DALAIL_CHAPTERS.length
       : id === 'barzanji'? BARZANJI_CHAPTERS.length
       : id === 'diya'    ? DIYA_CHAPTERS.length
       : id === 'ilahis'  ? ILAHI_CHAPTERS.length
       : id === 'silsila' ? SILSILA_CHAPTERS.length
       : id === 'turuqs' ? TURUQ_CHAPTERS.length
       : id === 'sohbets' ? SOHBET_CHAPTERS.length
       : id === 'biographies' ? BIOGRAPHY_CHAPTERS.length
       : id === 'ottoman' ? OTTOMAN_CHAPTERS.length
       : id === 'more'    ? 0
       : favItems().length;
}
function countLabel(id, n){
  if(id === 'favs')    return n ? n + (n === 1 ? ' bookmark' : ' bookmarks') : 'Nothing saved yet';
  if(id === 'mawlids') return n + (n === 1 ? ' collection' : ' collections'); /* includes Burdah */
  if(id === 'praises') return n + (n === 1 ? ' section' : ' sections');
  if(id === 'litanies')return n + (n === 1 ? ' litany' : ' litanies');
  if(id === 'qawwalis') return n ? n + (n === 1 ? ' qawwali' : ' qawwalis') : 'Coming soon';
  if(id === 'mawlid')  return n + ' sections';
  if(id === 'burdah')  return n + ' chapters';
  if(id === 'dalail')  return n + ' parts';
  if(id === 'barzanji')return n + ' sections';
  if(id === 'diya')    return n + ' sections';
  if(id === 'qasidas') return n + (n === 1 ? ' qasida' : ' qasidas');
  if(id === 'ilahis') return n + (n === 1 ? ' ilahi' : ' ilahis');
  if(id === 'silsila') return n ? n + (n === 1 ? ' master' : ' masters') : 'Coming soon';
  if(id === 'turuqs') return n ? n + (n === 1 ? ' tariqa' : ' tariqas') : 'Coming soon';
  if(id === 'sohbets') return n ? n + (n === 1 ? ' sohbet' : ' sohbets') : 'Coming soon';
  if(id === 'biographies') return n ? n + (n === 1 ? ' life' : ' lifes') : 'Coming soon';
  if(id === 'ottoman') return n ? n + (n === 1 ? ' chapter' : ' chapters') : 'Coming soon';
  if(id === 'more')    return 'More sections soon';
  return n + (n === 1 ? ' ilahi' : ' ilahis');
}

/* Header artwork, served from img/ and cached by sw.js for offline use.
   HOME shows the medallion; inner pages and the reader show the bismillah. */
const MEDALLION_ICON = 'img/medallion.png';

/* On a wide screen the menu is laid out around the seal: the medallion has
   eight points (N, NE, E, SE, S, SW, W, NW), and each of the first eight
   tiles takes one, clockwise from the top, so every point aims at its tile.
   --dx/--dy are that tile's direction from the centre (cosine and sine of its
   angle) and --r how far out its centre sits, in units of the seal's width.
   --r is worked out from the tile's own shape: a tile wider than it is tall
   has to sit further out at 3 and 9 o'clock than at 12 and 6, or it would
   crowd the star there and float away from it elsewhere. 'More Soon' and any
   tile past the eighth have no point to claim, so they sit below the ring.
   On a narrow screen none of this applies: the seal lives in the header and
   the tiles stay a plain grid. */
const SEAL_POINTS = 8;
const SEAL_REACH = .53;                    /* seal's tips, from its centre, as a share of its width */
const RING_TILE  = { w:.50, h:.30 };       /* a ring tile's size, same units; keep in step with styles.css */
const RING_GAP   = .03;                    /* clear space between a tip and its tile */
function ringRadius(dx, dy){
  /* Distance from a tile's centre to its edge, looking back toward the seal. */
  const toEdge = Math.min(Math.abs(dx) > 1e-6 ? RING_TILE.w / 2 / Math.abs(dx) : Infinity,
                          Math.abs(dy) > 1e-6 ? RING_TILE.h / 2 / Math.abs(dy) : Infinity);
  return SEAL_REACH + RING_GAP + toEdge;
}
function homeCards(){
  let k = 0;
  const tiles = HOME_CARDS.map(c => {
    const onRing = c.id !== 'more' && k < SEAL_POINTS;
    let pos = '';
    if(onRing){
      const a = (-90 + k * (360 / SEAL_POINTS)) * Math.PI / 180;
      const dx = Math.cos(a), dy = Math.sin(a);
      pos = ` style="--dx:${dx.toFixed(4)};--dy:${dy.toFixed(4)};--r:${ringRadius(dx, dy).toFixed(4)}"`;
      k++;
    }
    return `
      <button class="home-card${onRing ? ' ring' : ''}" data-tile="${c.theme}"${pos} onclick="selectTab('${c.id}')">
        <span class="hc-ar">${c.ar}</span>
        <span class="hc-en">${c.en}</span>
        <span class="hc-count">${countLabel(c.id, sectionCount(c.id))}</span>
      </button>`;
  }).join('');
  return `<div class="home-grid radial">
      <img class="home-seal" src="${MEDALLION_ICON}" width="320" height="328" alt="" aria-hidden="true">${tiles}
</div>`;
}

/* Each section introduces itself at the top of its own page, rather than
   crowding the landing page. */
function sectionIntro(id){
  const c = HOME_CARDS.find(x => x.id === id) || MAWLID_COLLECTIONS.find(x => x.id === id)
         || PRAISE_SECTIONS.find(x => x.id === id);
  return c ? `<div class="section-intro">${c.desc}</div>` : '';
}

function goHome(){
  setImmersive(false);
  leftTheLeader();
  state.tab = 'home';
  state.query = '';
  renderIndex();
  pushLoc();
}

function favCards(){
  const items = favItems();
  if(items.length === 0) return '';
  return items.map(({kind, idx, piece}, n) => `
        <button class="qcard" onclick="${openFnOf(kind)}(${idx})">
          <span class="num">${toArNum(n+1)}</span>
          <span class="titles">
            <span class="t-ar"${piece.latin ? ` style="font-family:'Crimson Pro',serif;direction:ltr;text-align:left"` : ''}>${piece.titleArabic}</span>
            <span class="t-en">${displayTitle(piece)}</span>
          </span>
          <span class="chev">›</span>
        </button>`).join('');
}

function label(txt, top){
  return `<div class="index-label"${top?' style="margin-top:1.8rem"':''}>${txt}</div>`;
}

/* Content for the currently selected tab. */
function renderResults(){
  const tab = state.tab;
  const q = state.query;

  // ---- SEARCH MODE: search the whole app, from whichever tab you're on ----
  if(q){
    let html = '';
    const mawlid = mawlidCards();
    if(mawlid) html += label('Mawlid ad-Daybaʿi · مولد الدّيبعي') + mawlid;
    const barz = barzanjiCards();
    if(barz) html += label('Mawlid al-Barzanjī · مولد الْبرزنجي', !!mawlid) + barz;
    const diya = diyaCards();
    if(diya) html += label('The Shimmering Light · الضّياء اللّامع', !!mawlid || !!barz) + diya;
    const burd = burdahCards();
    if(burd) html += label('Qasida Burdah · قصيدة الْبردة', !!mawlid || !!barz || !!diya) + burd;
    const qas = additionalQasidaCards();
    if(qas) html += label('More Qasidas · قصائد أخرى', !!mawlid || !!barz || !!burd) + qas;
    const dal = dalailCards();
    if(dal) html += label('Dalāʾil al-Khayrāt · دلائل الْخيرات', !!mawlid || !!barz || !!burd || !!qas) + dal;
    const ilahis = ilahiCards();
    if(ilahis) html += label('Ilahis · الْإلهيات', !!mawlid || !!barz || !!burd || !!qas || !!dal || !!nash) + ilahis;
    const qaww = qawwaliCards();
    if(qaww) html += label('Qawwalis · قوالي', !!html) + qaww;
    /* The Academy sections search alongside everything else; each stays
       silent until it has content, so nothing shows an empty heading. */
    const silsila = silsilaCards();
    if(silsila) html += label('Naqshbandi Silsila · السِّلْسِلَة النَّقْشَبَنْدِيَّة', !!html) + silsila;
    const turuqs = turuqCards();
    if(turuqs) html += label('Turuqs · الطُّرُق الصُّوفِيَّة', !!html) + turuqs;
    const sohbets = sohbetCards();
    if(sohbets) html += label('Sohbets · الصُّحْبَة', !!html) + sohbets;
    const biographies = biographyCards();
    if(biographies) html += label('Biographies · التَّرَاجِم', !!html) + biographies;
    const ottoman = ottomanCards();
    if(ottoman) html += label('Ottoman History · التَّارِيخ الْعُثْمَانِي', !!html) + ottoman;
    if(!html) return `<div class="no-results">No matches for "${q.replace(/</g,'&lt;')}". Try a different spelling.</div>`;
    return html;
  }

  // ---- BROWSE MODE: just the current tab ----
  /* The home tab needs a branch here too, not only in renderIndex(): typing and
     then deleting a search calls updateSearch(), which re-renders this alone.
     Without it, clearing the query left the page blank with no way back. */
  if(tab === 'home')    return homeCards();
  if(tab === 'mawlids') return sectionIntro('mawlids') + label('Choose a mawlid · اختر مولداً') + `<div class="home-grid">${mawlidsHub()}</div>`;
  if(tab === 'mawlid')  return backToMawlids() + sectionIntro('mawlid') + label('Follow the mawlid in order · على ترتيب الْمولد') + mawlidCards();
  if(tab === 'praises') return sectionIntro('praises') + label('Choose a section · اختر قسماً') + `<div class="home-grid">${praisesHub()}</div>`;
  if(tab === 'nasheeds')return backToPraises() + sectionIntro('nasheeds') + (nasheedCards() || placeholder('Nasheeds'));
  if(tab === 'qasidas') return backToPraises() + sectionIntro('qasidas') + label('Select a qasida · اختر قصيدة') + (additionalQasidaCards() || placeholder('Qasidas'));
  if(tab === 'ilahis')  return backToPraises() + sectionIntro('ilahis') + label('Select an ilahi · ilahi seçin') + ilahiCards();
  if(tab === 'litanies')return backToDalail() + sectionIntro('litanies') + label('Select a litany · اختر حزباً') + litanyCards();
  if(tab === 'before')  return backToDalail() + label('Before the reading · قَبْلَ الْقِرَاءَةِ') + (DALAIL_CHAPTERS.length ? dalailBeforeCards() : placeholder('Before the reading'));
  if(tab === 'downloads') return downloadsScreen();
  if(tab === 'azam')    return backToLitanies() + collectionLabel(AZAM_TITLE_IDX) + azamIndex();
  if(tab === 'istighfar') return backToLitanies() + collectionLabel(ISTIGHFAR_TITLE_IDX) + istighfarIndex();
  if(tab === 'qawwalis') return backToPraises() + sectionIntro('qawwalis') + label('Select a qawwali · اختر قوالي') + (qawwaliCards() || placeholder('Qawwalis'));
  if(tab === 'favs'){
    const cards = favCards();
    return cards
      ? sectionIntro('favs') + label('Your favorites · الْمفضلة') + cards
      : `<div class="no-results">No favorites yet.<br><br>Open any piece and tap the bookmark beside its title to save it here.<br><br>Favorites are kept on this device only — they aren't shared with anyone else using the app.</div>`;
  }
  if(tab === 'burdah'){
    return backToMawlids() + sectionIntro('burdah') + label('Select a chapter · اختر فصلاً') + burdahCards();
  }
  if(tab === 'qasidas-burdah'){
    return backToQasidasList() + label('Qasida al-Burdah · قصيدة البردة', false) + label('Select a chapter · اختر فصلاً', true) + burdahCards();
  }
  if(tab === 'barzanji'){
    return backToMawlids() + sectionIntro('barzanji') + barzanjiResponseNote() + label('Select a section · اختر فصلاً') + barzanjiCards();
  }
  if(tab === 'diya'){
    return backToMawlids() + sectionIntro('diya') + label('Select a section · اختر فصلاً') + diyaCards();
  }
  if(tab === 'dalail'){
    /* Empty only when its files failed to load; the index assumes its portions. */
    return DALAIL_CHAPTERS.length ? dalailIndex() : placeholder('Dalāʾil al-Khayrāt');
  }
  if(tab === 'silsila') return sectionIntro('silsila') + (silsilaCards() ? label('Select a master · اختر شيخاً') + silsilaCards() : placeholder('Naqshbandi Silsila'));
  if(tab === 'turuqs') return sectionIntro('turuqs') + (turuqCards() ? label('Select a tariqa · اختر طريقة') + turuqCards() : placeholder('Turuqs'));
  if(tab === 'sohbets') return sectionIntro('sohbets') + label('Choose a shaykh · اختر شيخاً') + `<div class="home-grid">${sohbetsHub()}</div>`;
  /* A shaykh's room. Generic, so adding a shaykh to SOHBET_SHAYKHS needs no
     new route here. */
  if(tab.indexOf('sohbet-') === 0){
    const s = shaykhOf(tab.slice('sohbet-'.length));
    if(s){
      const cards = sohbetCards(s.id);
      return backToSohbets() + `<div class="section-intro">${s.desc}</div>`
           + (cards ? label('Select a sohbet · اختر صحبة') + cards : placeholder(s.en));
    }
  }
  if(tab === 'biographies') return sectionIntro('biographies') + (biographyCards() ? label('Select a life · اختر ترجمة') + biographyCards() : placeholder('Biographies'));
  if(tab === 'ottoman') return sectionIntro('ottoman') + (ottomanCards() ? label('Select a chapter · اختر فصلاً') + ottomanCards() : placeholder('Ottoman History'));
  if(tab === 'more'){
    const card = HOME_CARDS.find(c => c.id === tab);
    return sectionIntro(tab) + placeholder(card ? card.en : tab);
  }
  return '';
}

/* Which tabs get a search box — all of them. */
function tabHasSearch(){
  return true;
}

const HEADER_BISMILLAH = 'img/header-bismillah.png';
const HOME_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9.5a.5.5 0 0 0 .5.5H9.5v-6h5v6h4a.5.5 0 0 0 .5-.5V10"/></svg>';
const BACK_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const SUN_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const SWAP_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 4l3 3-3 3"/><path d="M20 7H9a4 4 0 0 0-4 4"/><path d="M7 20l-3-3 3-3"/><path d="M4 17h11a4 4 0 0 0 4-4"/></svg>';
const LOGO_ALT = 'مُحَمَّدٌ صَلَّى اللّٰهُ عَلَيْهِ وَسَلَّمَ';
const BISMILLAH_ALT = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

function themeGlyph(){ return document.documentElement.classList.contains('dark') ? SUN_ICON_SVG : MOON_ICON_SVG; }
function liveClass(){ return session.role ? ' live' : ''; }

/* Home keeps the large logo header + subhead. */
/* Favorites is no longer one of the home-page menu tiles, so it needs a
   way in from the header instead — same icon used on a reader's own
   bookmark button, just always "off" here since this isn't bookmarking
   any one piece. */
function favMark(){
  return `<button class="fav-mark" onclick="selectTab('favs')" aria-label="Favorites">${bookmarkIcon(false)}</button>`;
}

function bigMasthead(){
  return `<header class="masthead">
      <button class="header-mark" onclick="goHome()" aria-label="Home">${HOME_ICON_SVG}</button>
      ${favMark()}
      <button class="session-mark${liveClass()}" onclick="selectTab('session')" aria-label="Live session">Live</button>
      <button class="theme-toggle" onclick="toggleTheme()">${themeGlyph()}</button>
      <img class="medallion-mark" src="${MEDALLION_ICON}" width="320" height="328" alt="Sacred Texts">
    </header>`;
}

/* Every page below home: compact bar, no large logo, no tab bar. */
function compactMasthead(){
  return `<header class="masthead compact">
      <div class="mh-left">
        <button class="header-mark" onclick="goHome()" aria-label="Home">${HOME_ICON_SVG}</button>
        <button class="back-mark" onclick="goBack()" aria-label="Back">${BACK_ICON_SVG}</button>
      </div>
      <img class="bismillah-mark" src="${HEADER_BISMILLAH}" width="640" height="114" alt="${BISMILLAH_ALT}">
      <div class="mh-right">
        ${favMark()}
        <button class="session-mark${liveClass()}" onclick="selectTab('session')" aria-label="Live session">Live</button>
        <button class="theme-toggle" onclick="toggleTheme()">${themeGlyph()}</button>
      </div>
    </header>`;
}

/* Back = up one level: a section's child returns to its hub tab; a top-level
   tab (or the session screen) returns home. There is no tab bar, so Home and
   Back are the only way out of a section. */
function goBack(){
  const t = state.tab;
  let parent = null;
  for(const p in TAB_CHILDREN){ if(TAB_CHILDREN[p].indexOf(t) !== -1){ parent = p; break; } }
  if(parent) selectTab(parent);
  else goHome();
}

function renderIndex(){
  /* The index is about to replace whatever was on screen, so no reader is
     showing any more. See readerOpen's use in setSessionStatus below. */
  readerOpen = false;
  document.documentElement.style.setProperty('--ar-size', '1.9rem');
  document.documentElement.style.setProperty('--latin-scale', 1);
  /* Landing page: shown on first open, and whenever you tap the logo.
     A search from here still runs, so the box stays useful. */
  /* onHome: the home tab, searching or not — keeps the search bar, bismillah
     and hidden nav consistent so nothing jumps when you start typing.
     home: the landing cards specifically (i.e. not showing results). */
  const onHome = state.tab === 'home';
  const home = onHome && !state.query;
  const sessionScreen = state.tab === 'session' && !state.query;
  app.innerHTML = `
    <div class="topbar">
    ${onHome ? bigMasthead() : compactMasthead()}
    ${(onHome || sessionScreen) ? '' : navBar()}
    </div>
        <main class="index">
      ${(tabHasSearch() && !sessionScreen && !onHome) ? searchBox() : ''}
      <div id="results">${(home ? homeCards() : sessionScreen ? sessionPanel() : renderResults()) + versionTag()}</div>
      ${onHome ? searchBox(true) : ''}
    </main>
    ${onHome ? `<div class="home-feedback">
      <a class="feedback-btn" href="mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Sacred Texts — feedback')}">
        Spotted a correction? Send feedback
      </a>
      <div class="feedback-sub">Corrections to the Arabic or translation are welcome · جزاكم اللّٰه خيراً</div>
    </div>` : ''}
    <footer>Works offline once added to your home screen.</footer>`;
  document.documentElement.classList.toggle('is-home', state.tab === 'home');
  document.documentElement.setAttribute('data-theme', sectionThemeOf(state.tab));
  window.scrollTo(0,0);
  if(state.query){ const el=document.getElementById('search'); if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
  centerActiveTab();
}

/* Collapse the sticky header (logo + home subhead) on any downward scroll of an
   index/browse page, leaving the corner buttons and the tab bar pinned. */

/* The tab strip scrolls sideways on a phone, so the highlighted section can sit
   off the edge — Favorites and Turkish Ilahis especially, being last. Bring the
   active one to the middle whenever the view is rebuilt. */
function centerActiveTab(){
  const bar = document.querySelector('.tabbar');
  if(!bar) return;
  const active = bar.querySelector('.tab.active');
  if(!active) return;
  const run = () => {
    const max = bar.scrollWidth - bar.clientWidth;
    if(max <= 0) return;                       // whole strip already fits
    const wanted = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
    const left = Math.max(0, Math.min(wanted, max));
    if(Math.abs(bar.scrollLeft - left) < 2) return;
    if(bar.scrollTo) bar.scrollTo({ left, behavior:'smooth' });
    else bar.scrollLeft = left;
  };
  if(window.requestAnimationFrame) requestAnimationFrame(run); else run();
}

function clearSearch(){
  state.query = '';
  renderIndex();
}

/* Dark / light theme toggle, persisted where storage is available. */
function toggleTheme(){
  const root = document.documentElement;
  const dark = root.classList.toggle('dark');
  try { localStorage.setItem('mawlid-theme', dark ? 'dark' : 'light'); } catch(e){}
  /* Only the sun/moon glyph depends on the theme in JS — every other theme
     difference is CSS keyed off <html class="dark">. Swapping the glyph in
     place is enough, and it avoids the renderIndex() this used to call: now
     that the toggle also rides in the reader bar, re-rendering the index
     would throw the reader out of the piece it has open (and would lose the
     reading position even on an index page). */
  document.querySelectorAll('.theme-toggle').forEach(function(b){ b.innerHTML = themeGlyph(); });
}
(function initTheme(){
  let saved = null;
  try { saved = localStorage.getItem('mawlid-theme'); } catch(e){}
  /* Light is the standard first-open look, on the owner's call: a reader
     who has never chosen gets light whatever their phone's system setting
     says. Dark is only ever entered by tapping the toggle, and only then
     is it remembered. This deliberately does NOT consult
     prefers-color-scheme, which used to hand anyone with a dark phone a
     dark app before they had asked for one. */
  if(saved === 'dark'){
    document.documentElement.classList.add('dark');
  }
})();

/* ── Live session (optional) ─────────────────────────────────────────────
   Lets a gathering follow whoever is leading: when they open a piece, every
   joined device opens it too.

   This is the ONLY part of the app that touches the network. It is designed
   so it can never harm the rest:
     • The Supabase library is fetched only when someone taps Join/Start.
       Nothing is downloaded otherwise, so an offline launch never waits on it.
     • If it fails, it fails alone — browsing, search, bookmarks and
       auto-scroll are untouched and still work with no connection.
     • Losing signal just stops the following; you keep reading and navigate
       by hand exactly as before, and it resumes if you reconnect.

   To switch it on, paste your own Supabase project's URL and anon key below
   (see the README). Left blank, the feature simply stays off. */
const SESSION_CONFIG = {
  url: 'https://heduxokhztwdqcfamdfd.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZHV4b2toenR3ZHFjZmFtZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNDMzMjIsImV4cCI6MjA5OTcxOTMyMn0.8blm9OG4cHyHxsjMcnEVWjS2-dHRlPxFMda-ihCKTcI'
  // anon / public key — safe to publish. Never put the service_role key here.
};
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

/* A stable per-device id, so leadership claims can be resolved the same way
   on every phone. Random, local, never sent anywhere but the session channel. */
function myClientId(){
  try{
    let id = localStorage.getItem('mawlid-client-id');
    if(!id){ id = Math.random().toString(36).slice(2,10); localStorage.setItem('mawlid-client-id', id); }
    return id;
  }catch(e){ return Math.random().toString(36).slice(2,10); }
}

/* term: increments on every handoff. Every message carries it, and anything
   with an older term is ignored — that's what stops a phone that dropped out
   while leading from fighting the new leader when it wakes up. */
const session = { role:null, code:null, client:null, channel:null, paused:false, status:'',
                  lastNav:null, leaderAt:null, id:myClientId(), term:0, leaderless:false, claiming:false, probing:false, probeHeard:false, connecting:null,
                  presentTimer:null, lastWhereReply:0 };
let claimState = { term:0, ids:[], timer:null };

/* A short history of what the session machinery actually did. The faults left
   are transient — by the time anyone can open a panel to look, the moment has
   passed — so record as it happens and read it afterwards. Forty lines is
   about a minute of ordinary activity. */
const sesLog = [];
function slog(msg){
  try{
    const d = new Date();
    sesLog.push(String(d.getMinutes()).padStart(2,'0') + ':'
      + String(d.getSeconds()).padStart(2,'0') + '.'
      + String(d.getMilliseconds()).padStart(3,'0') + '  ' + msg);
    if(sesLog.length > 40) sesLog.shift();
  }catch(e){}
}
/* An exception inside a click handler kills the rest of that handler silently.
   If that is what is happening, it will show up here and nowhere else. */
try{
  window.addEventListener('error', e => slog('ERROR ' + (e.message || '?')
    + ' @' + (e.lineno || '?') + ':' + (e.colno || '?')));
  window.addEventListener('unhandledrejection', e => slog('REJECT '
    + String((e.reason && e.reason.message) || e.reason || '?')));
}catch(e){}
let suppressNavSignals = false;   // true during re-renders and remote-driven navigation

function sessionConfigured(){ return !!(SESSION_CONFIG.url && SESSION_CONFIG.key); }

/* Fetch the library on demand only. */
function loadSupabase(){
  if(window.supabase) return Promise.resolve(window.supabase);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SUPABASE_CDN;
    s.onload = () => window.supabase ? resolve(window.supabase) : reject(new Error('load failed'));
    s.onerror = () => reject(new Error('offline'));
    document.head.appendChild(s);
  });
}

function newSessionCode(){ return String(Math.floor(1000 + Math.random() * 9000)); }

function setSessionStatus(msg){
  session.status = msg;
  renderSessionBanner();                       /* the banner lives outside #app */
  /* Only paint the index when no reader is actually showing. This used to ask
     readerOpen, which is set while BUILDING reader markup and cleared by
     renderIndex — a stale false meant a status change threw the reader away
     and dropped you back on the index. Taking the mic sets a status, so the
     first tap bounced you out and the second, from the index, looked like it
     "worked". Same DOM question as everywhere else. */
  const repaint = state.tab === 'session' && renderedView() === 'none';
  slog('status "' + String(msg).slice(0,34) + '" role=' + session.role
    + ' view=' + renderedView() + ' repaint=' + repaint);
  if(repaint) renderIndex();
}

/* The last session this device joined, kept on the device. An accidental Leave
   — or the app being closed mid-gathering — shouldn't strand someone who never
   memorised the number. */
function rememberSession(code){
  try{ localStorage.setItem('mawlid-last-session', JSON.stringify({ code, at: Date.now() })); }catch(e){}
}

/* A code may be a venue's name or a short number — whatever is printed on the
   poster. Normalised so "Al-Noor", "al noor" and "ALNOOR" are all the same room. */
function normalizeCode(raw){
  return String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
}

function validCode(c){ return /^[a-z0-9]{3,24}$/.test(c); }

function rememberVenue(code){
  try{ localStorage.setItem('mawlid-venue-code', code); }catch(e){}
}

function lastVenue(){
  try{
    const v = localStorage.getItem('mawlid-venue-code');
    return validCode(v || '') ? v : '';
  }catch(e){ return ''; }
}

function lastSession(){
  try{
    const v = JSON.parse(localStorage.getItem('mawlid-last-session'));
    return (v && validCode(v.code)) ? v : null;
  }catch(e){ return null; }
}

function agoLabel(at){
  const m = Math.round((Date.now() - at)/60000);
  if(m < 1)  return 'a moment ago';
  if(m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
  const h = Math.round(m/60);
  if(h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  const d = Math.round(h/24);
  return d + (d === 1 ? ' day ago' : ' days ago');
}

function rejoinLast(){
  const v = lastSession();
  if(!v){ setSessionStatus('No recent session on this device.'); return; }
  connectSession(v.code, 'follower');
}

function forgetLastSession(){
  try{ localStorage.removeItem('mawlid-last-session'); }catch(e){}
  renderIndex();
}

function connectSession(code, role, opts){
  if(!sessionConfigured()){ setSessionStatus("Sessions aren't set up yet — see the README."); return; }
  session.connecting = code;
  setSessionStatus('Connecting…');
  /* If the channel never answers, don't leave the panel stuck on "Joining…". */
  const attempt = code;
  setTimeout(() => {
    if(session.connecting !== attempt) return;
    session.connecting = null;
    setSessionStatus('Could not reach that session. Check your connection and try again.');
  }, 12000);
  loadSupabase().then(sb => {
    const client = sb.createClient(SESSION_CONFIG.url, SESSION_CONFIG.key);
    const channel = client.channel('mawlid:' + code, { config: { broadcast: { self: false } } });

    channel.on('broadcast', { event: 'nav' }, ({ payload }) => {
      noteLeaderAlive();
      if(!payload || typeof payload.idx !== 'number') return;
      if(typeof payload.term === 'number'){
        if(payload.term < session.term) return;          // a stale leader talking
        if(payload.term > session.term){                 // someone took the mic
          session.term = payload.term;
          session.leaderless = false;
          if(session.role === 'leader'){
            slog('DEMOTE nav higher term ' + payload.term + ' > ' + session.term);
            session.role = 'follower'; setSessionStatus('Following the leader.');
          }
        }
      }
      if(session.probing) session.probeHeard = true;   // someone is already here
      if(session.leaderless){ session.leaderless = false; setSessionStatus('Following the leader.'); }
      if(session.role !== 'follower' || session.paused) return;
      applyRemoteNav(payload.kind, payload.idx, payload.book, payload.page);
    });
    /* Live page-turns inside the Book Version. */
    channel.on('broadcast', { event: 'page' }, ({ payload }) => {
      noteLeaderAlive();
      if(!payload || typeof payload.page !== 'number') return;
      if(typeof payload.term === 'number' && payload.term < session.term) return;
      if(session.role !== 'follower' || session.paused) return;
      applyRemotePage(payload.kind, payload.idx, payload.page);
    });
    /* The leader's place within the piece, line by line. */
    channel.on('broadcast', { event: 'spot' }, ({ payload }) => {
      if(!payload || typeof payload.verse !== 'number') return;
      if(typeof payload.term === 'number' && payload.term < session.term) return;
      noteLeaderAlive();
      if(session.role !== 'follower') return;
      /* Note it even while paused — applyRemoteSpot records his place and
         then declines to move us. That way Resume lands on his current line. */
      applyRemoteSpot(payload.kind, payload.idx, payload.verse, payload.frac);
    });
    /* The leader's heartbeat. Any message would do, but he may sit still on
       one page for a long stretch, so he says so explicitly. */
    channel.on('broadcast', { event: 'alive' }, ({ payload }) => {
      if(payload && typeof payload.term === 'number' && payload.term < session.term) return;
      noteLeaderAlive();
      /* A beat proves someone is leading, so it ends a probe just as a nav
         does. Without this a leader sitting still on one page was invisible
         to anyone joining. */
      if(session.probing) session.probeHeard = true;
      /* Two leaders can only arise if both probed a room that sounded empty
         at the same moment. Settle it the same way a contested claim is
         settled: the lower client id keeps the mic, and both sides reach that
         answer alone. */
      if(session.role === 'leader' && payload && payload.id && payload.id < session.id
         && (typeof payload.term !== 'number' || payload.term === session.term)){
        slog('DEMOTE alive tiebreak: other=' + String(payload.id).slice(0,6)
          + ' me=' + String(session.id).slice(0,6) + ' term=' + payload.term);
        session.role = 'follower'; session.leaderless = false; session.paused = false;
        stopBeating(); startWatchingLeader();
        setSessionStatus('Following the leader.');
        return;
      }
      if(session.role === 'follower' && session.leaderless){
        clearLeaderPending('Following the leader.');
      }
    });
    /* "Someone here is following a leader." Deliberately NOT an 'alive': that
       carries a client id and would drag a real leader through the demotion
       tiebreak against a follower. This says only that the room is not empty. */
    channel.on('broadcast', { event: 'present' }, () => {
      if(session.presentTimer){ clearTimeout(session.presentTimer); session.presentTimer = null; }
      if(session.probing) session.probeHeard = true;
      /* A 'present' only vouches that the room is occupied. It deliberately
         does not clear `leaderless` — the flag it used to clear was never set,
         so this handler has never touched leader state, and making it do so
         now would be a live-session behaviour change, not a cleanup. */
    });
    channel.on('broadcast', { event: 'lead' }, ({ payload }) => {
      if(session.probing) session.probeHeard = true;
      handleLeadMsg(payload);
    });
    /* A late joiner asks where everyone is; the leader answers. */
    channel.on('broadcast', { event: 'where' }, () => {
      /* A follower corroborates. Discovery used to rest on the leader alone,
         so one dropped reply told a joiner the room was empty. Everyone who
         is following answers instead — but after a random pause, and only if
         nobody else has answered first, so a hall of thirty phones still
         produces about one reply rather than thirty. */
      if(session.role === 'follower' && !session.leaderless && !session.presentTimer){
        session.presentTimer = setTimeout(() => {
          session.presentTimer = null;
          if(session.role !== 'follower' || session.leaderless || !session.channel) return;
          try{ session.channel.send({ type:'broadcast', event:'present', payload:{} }); }catch(e){}
        }, 250 + Math.random() * 2250);   /* wide: keeps it near one reply even in a full hall */
        return;
      }
      if(session.role !== 'leader') return;
      /* Each joiner asks up to five times and every ask drew three messages
         back. Thirty phones arriving together made hundreds in a couple of
         seconds, past what the channel will carry, and the drops fell on the
         very packets discovery depends on. One answer per burst is enough. */
      const now = Date.now();
      if(session.lastWhereReply && now - session.lastWhereReply < 700) return;
      session.lastWhereReply = now;
      /* A leader that isn't beating can't be heard. Cheap net against any
         future path that sets the role without starting the clock. */
      if(!beatTimer) startBeating();
      /* Answer FIRST with a bare "I'm here". A leader who hasn't opened a
         piece yet has no lastNav and used to answer NOTHING AT ALL — which
         told the joiner the room was empty, so it offered itself the mic and
         never moved. The place, if there is one, follows. */
      sendAlive();
      if(session.lastNav){
        sendNav(session.lastNav.kind, session.lastNav.idx);
        /* …and where in it we are. Without this a joiner arrived at the top of
           the chapter and stayed there until the leader happened to move. */
        sendSpotNow();
      }
    });

    channel.subscribe(status => {
      if(status === 'SUBSCRIBED'){
        session.connecting = null;
        rememberSession(code);          /* recorded only once actually in */
        session.client = client; session.channel = channel;
        session.code = code; session.paused = false;
        /* Anyone arriving on a shared code listens first. Two phones at one hall
           must never both take the mic, and the first to arrive at an empty room
           shouldn't be left following nobody. */
        const wantsLead = role === 'leader' && !!(opts && opts.probe);
        const listens = wantsLead || role === 'follower';
        session.role = wantsLead ? 'follower' : role;
        session.probing = listens; session.probeHeard = false; session.leaderless = false;
        if(listens){
          setSessionStatus(wantsLead ? 'Checking whether anyone is already leading…' : 'Joining…');
          const askWhere = () => {
            if(!session.probing || session.code !== code) return;
            try{ channel.send({ type:'broadcast', event:'where', payload:{} }); }catch(e){}
          };
          const decide = () => {
            if(!session.probing || session.code !== code) return;
            /* Belt and braces: if anything has settled the role since the
               probe began, its answer stands, not ours. */
            if(session.role === 'leader' || session.claiming){
              session.probing = false;
              slog('probe expired — role already settled, ignoring');
              return;
            }
            session.probing = false;
            slog('probe decided: heard=' + session.probeHeard);
            if(session.probeHeard){
              session.role = 'follower'; session.leaderless = false;
              noteLeaderAlive(); stopBeating(); startWatchingLeader();
              setSessionStatus(wantsLead
                ? "Someone is already leading here — you've joined them. Take the lead if you need to."
                : 'Following the leader.');
            } else if(wantsLead){
              becomeLeader(code);
              setSessionStatus('Leading — others can join with this code.');
            } else {
              /* A silent probe now means an empty room, and the mic opens at
                 once. The extra waiting stage that used to sit here was added
                 when the probe was unreliable: it closed before a heartbeat
                 could arrive, so silence proved nothing. It spans a full beat
                 now, and any follower already in the room vouches for its
                 leader, so a probe that hears nothing across all of that has
                 genuinely found an empty room.

                 Keeping the delay after fixing the probe just meant the first
                 person into a new session waited on a leader who did not
                 exist. The watchdog stays armed either way, so a late beat
                 still pulls this device quietly back to following. */
              session.role = 'follower';
              session.leaderless = true;
              stopBeating(); startWatchingLeader();
              setSessionStatus("No one is leading here yet — take the lead when you're ready.");
            }
            renderSessionBanner();
            if(state.tab === 'session' && renderedView() === 'none') renderIndex();
          };
          /* One 'where' used to be the entire handshake. If that packet or the
             reply was dropped — routine on a phone network — the joiner
             concluded nobody was leading, which is both halves of the bug the
             user reported: the mic offered while a leader sits there, and a
             joiner left on its own page. Ask again, and settle the moment
             anyone answers. */
          askWhere();
          PROBE_TRIES.forEach(t => setTimeout(() => {
            if(!session.probing || session.code !== code) return;
            if(session.probeHeard) return decide();
            askWhere();
          }, t));
          setTimeout(decide, PROBE_MS);
        } else {
          becomeLeader(code);
          setSessionStatus('Leading — others can join with this code.');
        }
      } else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'){
        session.connecting = null;
        setSessionStatus('Could not connect. Check your connection and try again.');
      }
    });
  }).catch(() => {
    session.connecting = null;
    setSessionStatus("Couldn't connect — you're offline. Everything else still works; navigate by hand.");
  });
}
function startSession(){
  const el = document.getElementById('start-code');
  const code = normalizeCode(el ? el.value : '');
  if(!code){ connectSession(newSessionCode(), 'leader'); return; }
  if(!validCode(code)){ setSessionStatus('A venue code is 3–24 letters or numbers — or leave it blank for a random one.'); return; }
  connectSession(code, 'leader', { probe:true });
}
function joinSession(){
  const el = document.getElementById('join-code');
  const code = normalizeCode(el ? el.value : '');
  if(!validCode(code)){ setSessionStatus('Enter the code from the poster, or the one read aloud.'); return; }
  connectSession(code, 'follower');
}
function leaveSession(){
  slog('leaveSession CALLED');
  /* Hand the mic back to the room rather than leaving everyone following a ghost. */
  if(session.role === 'leader' && session.channel){
    try{ session.channel.send({ type:'broadcast', event:'lead', payload:{ t:'release', term: session.term + 1 } }); }catch(e){}
  }
  if(claimState.timer){ clearTimeout(claimState.timer); claimState.timer = null; }
  claimState = { term:0, ids:[], timer:null };
  clearSessionHash();
  try { if(session.channel) session.channel.unsubscribe(); } catch(e){}
  try { if(session.client) session.client.removeAllChannels(); } catch(e){}
  if(session.presentTimer){ clearTimeout(session.presentTimer); session.presentTimer = null; }
  session.lastWhereReply = 0;
  session.role = null; session.code = null; session.channel = null;
  session.client = null; session.paused = false; session.lastNav = null;
  session.term = 0; session.leaderless = false; session.claiming = false; session.leaderAt = null;
  session.lastBeat = 0; stopBeating(); stopWatchingLeader();
  session.probing = false; session.probeHeard = false; session.connecting = null;
  setSessionStatus('');
}
/* A follower steps out of step the moment they navigate themselves — whether
   that's opening another reading, a section list, or the home page. Pausing
   here (rather than only in the readers) means Resume is offered everywhere. */
function leftTheLeader(){
  if(suppressNavSignals) return;
  if(session.role === 'follower' && !session.leaderless) pauseFollowing();
}

function pauseFollowing(){
  spotStopAnim();
  spotExpectedY = null;
  if(session.role !== 'follower' || session.paused) return;
  session.paused = true;
  setSessionStatus('Paused — you moved on your own.');
}
function resumeFollowing(){
  if(session.role !== 'follower') return;
  session.paused = false;
  /* Go straight back to where the leader was, so Resume works even if they're
     mid-recitation and slow to answer; the 'where' reply then confirms it. */
  spotExpectedY = null;          /* or the watcher re-pauses us at once */
  const at = session.leaderAt;   /* read before applyRemoteNav rewrites it */
  if(at){
    applyRemoteNav(at.kind, at.idx);
    /* Come back to the leader's LINE, not just his chapter. */
    if(typeof at.verse === 'number') spotGoTo(at.kind, at.idx, at.verse, at.frac);
  }
  spotExpectedY = null;
  setSessionStatus('Following the leader.');
  if(session.channel) session.channel.send({ type:'broadcast', event:'where', payload:{} });
}

/* Apply a leader's move without echoing it back or counting it as manual. */
function applyRemoteNav(kind, idx, book, page){
  const arr = arrayOf(kind);
  if(!arr || !arr[idx]) return;
  suppressNavSignals = true;
  try {
    const c = arr[idx];
    const hasPages = Array.isArray(c.folios) && c.folios.length > 0;
    if(typeof book === 'boolean') state.pageView = book && hasPages;   // match the leader's view
    reopen(kind, idx);
  } finally { suppressNavSignals = false; }
  session.lastNav = { kind, idx };
  /* Keep any line/fraction we already knew for this same piece — a nav event
     that repeats the current chapter must not erase where in it he is. */
  const samePiece = session.leaderAt && session.leaderAt.kind === kind && session.leaderAt.idx === idx;
  session.leaderAt = Object.assign({}, samePiece ? session.leaderAt : {}, { kind, idx, page: page || 0 });
  /* We just moved the page ourselves, so any previous expectation is void. */
  spotExpectedY = null;
  /* Landed on his piece but with no line for it — ask, rather than waiting
     for him to move. The beat would answer within four seconds anyway; this
     makes the join feel immediate. */
  if(session.role === 'follower' && session.channel && !session.paused
     && !(session.leaderAt && typeof session.leaderAt.verse === 'number')){
    setTimeout(() => {
      if(session.role !== 'follower' || !session.channel) return;
      if(session.leaderAt && typeof session.leaderAt.verse === 'number') return;
      try{ session.channel.send({ type:'broadcast', event:'where', payload:{} }); }catch(e){}
    }, 400);
  }
  if(page) msGoToWhenReady(page);   // land on the leader's page
}
/* ── Following the leader within a piece ──────────────────────────────────
   Page sync moves everyone between leaves; this moves them between LINES.
   The unit sent is a verse index, never a scroll offset: followers differ in
   text size, in whether translation and transliteration are showing, and in
   screen height, so the same pixel — or the same percentage down the page —
   is a different place on every device. A verse index is the same line
   everywhere, and both views already share it. */

let spotProgrammatic = false;   /* true while WE are doing the scrolling */
let spotLastSent = 0, spotLastVerse = -1, spotTimer = null;
/* Position within the top verse, 0 at its first line and 1 at its last, so a
   leader nudging the page a few lines inside one long verse still moves his
   followers. A fraction travels safely between devices where a pixel offset
   would not: font size, translation toggles and screen height all differ. */
let spotLastFrac = -1;
/* Where we last put a follower. Compared against the real scroll position to
   tell the app's own scrolling apart from the reader's — a timer can't, now
   that we scroll several times a second. */
let spotExpectedY = null;
const SPOT_PAD = 96;            /* matches topVisibleVerse's sticky-bar offset */
const SPOT_MS = 80;             /* mirror rate; was 900, then 120 */

/* The element for a verse in whichever view is open. */
function verseEl(kind, idx, n){
  /* Study first, scoped to the verse flow so a hidden Book leaf elsewhere in
     the DOM can't win and hand back a zero-height rectangle. Then the Book
     wrapper, then its first segment — the segment key is colon-separated
     (d:idx:n:sg), and this last selector had a full stop, so it never matched
     anything and Book-Version targets fell through to nothing. */
  const tries = [
    'main.verses article.verse[data-v="' + n + '"]',
    '[data-mk="' + kind + ':' + idx + ':' + n + '"]',
    '[data-mk^="' + kind + ':' + idx + ':' + n + ':"]'
  ];
  for(const sel of tries){
    const el = document.querySelector(sel);
    /* An element that isn't laid out has no position to scroll to. */
    if(el && el.offsetParent !== null) return el;
  }
  return null;
}

/* Comfortably on screen — not merely intersecting it by a pixel. Followers
   stay put while the leader is reading the same lines they are; the screen
   only moves once he has genuinely gone past. */
function verseOnScreen(kind, idx, n, slack){
  const el = verseEl(kind, idx, n);
  if(!el) return false;
  const r = el.getBoundingClientRect();
  const pad = slack || 0;
  return r.bottom > 84 - pad && r.top < window.innerHeight - 24 + pad;
}

/* Wrap any scroll we perform ourselves, so the follower's own-movement
   watcher below doesn't mistake it for the reader wandering off. */
function spotScroll(fn){
  spotProgrammatic = true;
  try { fn(); } finally { setTimeout(() => { spotProgrammatic = false; }, 700); }
}

function sendSpot(verse, frac){
  if(!session.channel || session.role !== 'leader' || !session.lastNav) return;
  session.dbgSent = (session.dbgSent || 0) + 1;
  frac = typeof frac === 'number' ? frac : 0;
  /* Resend when the line changes, or when we have slid far enough within it
     to be worth a message. */
  if(verse === spotLastVerse && Math.abs(frac - spotLastFrac) < 0.005) return;
  spotLastVerse = verse; spotLastFrac = frac; spotLastSent = Date.now();
  const k = session.lastNav.kind, i = session.lastNav.idx;
  try { session.channel.send({ type:'broadcast', event:'spot',
    payload:{ kind:k, idx:i, verse, frac, term: session.term } }); } catch(e){}
}

/* How far the viewport has travelled into the top visible verse. */
/* The leader's current line and how far into it the screen has travelled.
   One definition, used by the scroll sampler, the heartbeat and the reply to
   a joiner's 'where' — they used to disagree. */
/* Which reader is actually on the screen, as opposed to which one the user
   last asked for. state.pageView is the Dalāʾ il's Book toggle and it STAYS SET
   when you move to a piece that has no folios — a qasida, a mawlid — which
   renders in Study. The sampler trusted it, went looking for a manuscript line
   that could not exist, found nothing and fell silent, on every piece except
   the Dalāʾil. Ask the page instead. */
function renderedView(){
  if(document.querySelector('main.verses article.verse[data-v]')) return 'study';
  if(document.querySelector('.ms-v[data-mk]')) return 'book';
  return 'none';
}

function currentSpot(){
  if(!session.lastNav) return null;
  const view = renderedView();
  if(view === 'none') return null;
  const book = view === 'book' && typeof topVisibleMsVerse === 'function';
  /* Ask the DOM whether a reader is on screen rather than trusting a flag.
     readerOpen is set while BUILDING the markup and cleared by renderIndex, so
     any path that renders out of that order leaves it lying — and a stale
     false silenced this sampler entirely, while a deliberate tap on a line,
     which checks the DOM instead, went on working. Hence the reported split:
     tapping a verse moved every follower, scrolling moved none. Same question,
     asked the same way, in both places now. */
  const v = book ? topVisibleMsVerse() : topVisibleVerse();
  if(typeof v !== 'number' || v < 0) return null;
  /* A Book-Version leaf doesn't scroll, so there is no fraction to send. */
  return { verse: v, frac: book ? 0 : spotFracOf(session.lastNav.kind, session.lastNav.idx, v) };
}

/* sendSpot stays silent when the position hasn't changed, which is right for
   scrolling and WRONG for anyone who has just walked in: a leader sitting
   still on one line had nothing to say, so a joiner landed on the piece and
   then sat at the top of it. This says it anyway. */
/* The leader's position was published only from a scroll handler. If those
   events don't arrive — a momentum gesture that fires nothing until it
   settles, a view whose scrolling isn't the window's — followers never hear
   anything and sit still. A timer doesn't care how the page moved. sendSpot
   still drops unchanged positions, so a leader sitting still costs nothing. */
let spotTick = null;
function startSpotTicker(){
  stopSpotTicker();
  spotTick = setInterval(() => {
    if(session.role !== 'leader' || !session.channel || !session.lastNav) return;
    const c = currentSpot();
    if(!c){
      session.dbgWhy = !session.lastNav ? 'noNav'
        : (renderedView() === 'none' ? 'noReader' : 'noVerse');
      return;
    }
    session.dbgWhy = '';
    session.dbgSpot = c.verse + '@' + (c.frac||0).toFixed(2);
    sendSpot(c.verse, c.frac);
  }, 250);
}
function stopSpotTicker(){ if(spotTick){ clearInterval(spotTick); spotTick = null; } }

function sendSpotNow(){
  if(session.role !== 'leader') return;
  const c = currentSpot();
  if(!c) return;
  spotLastVerse = -1; spotLastFrac = -1;      /* past the no-change guard */
  sendSpot(c.verse, c.frac);
}

function spotFracOf(kind, idx, n){
  const el = verseEl(kind, idx, n);
  if(!el) return 0;
  const r = el.getBoundingClientRect();
  if(!r.height) return 0;
  return Math.max(0, Math.min(1, (SPOT_PAD - r.top) / r.height));
}

/* Where the follower's page should sit right now, recomputed from the DOM
   each frame so it stays right even if the layout shifts under us. */
let spotTarget = null, spotAnim = null;

function spotTargetY(){
  if(!spotTarget) return null;
  const el = verseEl(spotTarget.kind, spotTarget.idx, spotTarget.verse);
  if(!el) return null;
  const r = el.getBoundingClientRect();
  return Math.max(0, window.scrollY + r.top + (spotTarget.frac || 0) * r.height - SPOT_PAD);
}

/* Messages arrive in steps; the eye wants continuous motion. So rather than
   snapping to each one, ease toward the latest position every frame. Between
   two updates the page keeps gliding, which is what makes it read as the
   leader's screen rather than a slideshow of his positions. */
function spotStep(){
  spotAnim = null;
  if(session.role !== 'follower' || session.paused) return;
  const target = spotTargetY();
  if(target === null) return;
  const cur = window.scrollY;
  const d = target - cur;
  if(Math.abs(d) < 0.6){ spotExpectedY = target; return; }
  /* A big jump — a page turn, or a tap on a distant line — is taken at once;
     ordinary reading movement is eased. */
  const step = Math.abs(d) > window.innerHeight * 0.9 ? d : d * 0.34;
  const want = Math.max(0, cur + step);
  window.scrollTo(0, want);
  /* Record what we ASKED for. Reading scrollY back here is unreliable —
     Safari updates it asynchronously, so we would store the old position and
     then mistake our own scroll for the reader grabbing the page. */
  spotExpectedY = want;
  spotAnim = requestAnimationFrame(spotStep);
}

function spotGoTo(kind, idx, verse, frac){
  spotTarget = { kind, idx, verse, frac: frac || 0 };
  if(!spotAnim) spotAnim = requestAnimationFrame(spotStep);
}

/* The leader's own scrolling, throttled: at most one message a second, and
   only when the top line actually changes. */
function spotOnScroll(){
  if(session.role !== 'leader' || !session.lastNav || spotProgrammatic) return;
  if(spotTimer) return;
  const wait = Math.max(0, SPOT_MS - (Date.now() - spotLastSent));
  spotTimer = setTimeout(() => {
    spotTimer = null;
    if(session.role !== 'leader' || !session.lastNav) return;
    const c = currentSpot();
    if(!c) return;
    sendSpot(c.verse, c.frac);
  }, wait);
}

function applyRemoteSpot(kind, idx, verse, frac){
  session.dbgRecv = (session.dbgRecv || 0) + 1;
  session.dbgLast = kind + ':' + idx + ':' + verse;
  /* Only meaningful if we're on the same piece; otherwise the nav event
     that brings us there will carry its own position. */
  if(!session.lastNav || session.lastNav.kind !== kind || session.lastNav.idx !== idx) return;
  session.leaderAt = Object.assign({}, session.leaderAt || {}, { kind, idx, verse, frac });
  if(session.role !== 'follower' || session.paused) return;
  /* Track him continuously rather than only when he leaves our screen — the
     old "already on screen" test let a follower sit a whole page out of step. */
  spotGoTo(kind, idx, verse, frac);
}

/* A follower who scrolls away far enough that the leader's line has left the
   screen has chosen to look elsewhere — stop dragging them back. Small
   adjustments are ignored, so glancing up a line doesn't break the link. */
function spotStopAnim(){
  if(spotAnim){ cancelAnimationFrame(spotAnim); spotAnim = null; }
  spotTarget = null;
}

function spotWatchFollower(){
  if(session.role !== 'follower' || session.paused || spotProgrammatic) return;
  if(spotExpectedY === null) return;
  /* Drifting more than half a screen from where we placed them means the
     reader took hold of the page themselves. */
  if(Math.abs(window.scrollY - spotExpectedY) > window.innerHeight * 0.5) pauseFollowing();
}

window.addEventListener('scroll', () => { spotOnScroll(); spotWatchFollower(); }, { passive:true });

/* Tap a line while leading and everyone jumps to it. Study view only: in the
   Book Version a tap already places the gold ring, and pages are synced
   anyway. Buttons inside a verse keep their own actions. */
document.addEventListener('click', (e) => {
  if(session.role !== 'leader' || !session.lastNav) return;
  if(e.target.closest('button, a')) return;
  const art = e.target.closest('main.verses article.verse[data-v]');
  if(!art) return;
  const n = +art.dataset.v;
  spotLastVerse = -1;                       // a deliberate tap always sends
  sendSpot(n);
  art.classList.remove('hit-flash'); void art.offsetWidth; art.classList.add('hit-flash');
}, true);

/* A follower turns to the leader's Book-Version page. */
function applyRemotePage(kind, idx, page){
  session.leaderAt = { kind, idx, page };
  if(!session.lastNav || session.lastNav.kind !== kind || session.lastNav.idx !== idx) return;
  msGoToWhenReady(page);
}
function msGoToWhenReady(page, tries){
  tries = tries || 0;
  const book = document.getElementById('ms-book');
  if(book && book.children[page]){
    suppressNavSignals = true;
    try { msGoTo(page); } finally { setTimeout(() => { suppressNavSignals = false; }, 400); }
  } else if(tries < 12){
    setTimeout(() => msGoToWhenReady(page, tries + 1), 120);
  }
}
function sendNav(kind, idx){
  if(!session.channel) return;
  const page = (typeof msCurrentPage === 'function') ? msCurrentPage() : 0;
  /* Tell followers what is on screen here, not what this device's Book toggle
     happens to be left on — they were being asked to switch to a Book view of
     a piece that has no folios. */
  const book = renderedView() === 'book';
  try { session.channel.send({ type:'broadcast', event:'nav', payload:{ kind, idx, page, book, term: session.term } }); } catch(e){}
}
/* ── Passing the mic ──────────────────────────────────────────────────────
   The leader releases; the session then has no leader and anyone may claim it.
   Simultaneous taps are settled deterministically: claims are gathered for a
   short window and the lowest client id wins, so every device reaches the same
   answer without needing a server to arbitrate. */
/* ── Liveness ─────────────────────────────────────────────────────────────
   A leader who passes the mic says so. A leader whose phone locks, loses
   signal or closes the app says nothing at all, and the session used to sit
   there for ever with no one able to take over. So the leader beats quietly
   and followers give up on him after a while, which opens the mic through the
   claim machinery that already exists. */
const PROBE_TRIES = [400, 1100, 2200, 3600];  /* re-ask at these marks */
/* The probe must outlast a whole heartbeat, or a joiner can decide a busy room
   is empty without that being detectable. It used to be 2800ms against a
   4000ms beat: the window shut 1200ms BEFORE the next natural beat could
   arrive, so discovery rested entirely on a 'where' packet AND its reply both
   surviving. With two phones that nearly always happened; with a hall full it
   often didn't, and the joiner was offered the mic while someone was leading.
   At 5200 the ambient beat alone settles it even if every 'where' is lost. */
const PROBE_MS = 5200;        /* only then is the room really empty */
const BEAT_MS = 4000;         /* leader's heartbeat */
const BEAT_LOST_MS = 14000;   /* followers wait this long before opening the mic */
let beatTimer = null, beatWatch = null;

const LEADER_PENDING_MS = 9000;  /* keep listening this long before opening the mic */

function noteLeaderAlive(){ session.lastBeat = Date.now(); }

/* A leader turned up while this device was still marked leaderless. Named for
   a `leaderPending` flag that no longer exists — nothing ever set it, so it
   was removed; this is now reached only down the leaderless path. */
function clearLeaderPending(msg){
  session.leaderless = false;
  noteLeaderAlive();
  stopBeating(); startWatchingLeader();
  setSessionStatus(msg);
  renderSessionBanner();
}

function sendAlive(){
  if(!session.channel) return;
  try{ session.channel.send({ type:'broadcast', event:'alive',
    payload:{ term: session.term, id: session.id } }); }catch(e){}
}
/* Every path that puts the mic in this device's hands runs through here.
   It used to be written out three times, and the copy for "start a new
   session" — the ordinary case — left out startBeating() altogether. That
   leader never sent a heartbeat, and once the position sampler was hung off
   the same call it never sent its place either: followers landed on the
   leader's page and then sat there. Taking the mic and handing it back goes
   through one of the other two copies, which is why one pass appeared to
   fix it. */
/* A probe is a question: "is anyone leading here?" Once this device has
   answered it by ACTING — claiming the mic, or being handed it — the question
   is moot, and the timer still counting down must not be allowed to answer it
   later. It was: the probe fired a second after a won claim and reset the
   device to "No one is leading here yet", losing the lead the user had just
   taken. */
function cancelProbe(){
  if(session.probing){ session.probing = false; slog('probe cancelled by action'); }
}

function becomeLeader(code){
  slog('becomeLeader');
  cancelProbe();
  session.role = 'leader';
  session.leaderless = false;
  session.paused = false;
  stopWatchingLeader();
  startBeating();
  if(code) rememberVenue(code);
}

function startBeating(){
  stopBeating();
  startSpotTicker();
  beatTimer = setInterval(() => {
    if(session.role !== 'leader' || !session.channel) return;
    sendAlive();
    /* Re-state the position every beat. Any single dropped 'spot' used to
       leave a follower stranded until the leader next moved; now the worst a
       lost message costs is one beat. */
    sendSpotNow();
  }, BEAT_MS);
}
function stopBeating(){
  stopSpotTicker(); if(beatTimer){ clearInterval(beatTimer); beatTimer = null; } }

function startWatchingLeader(){
  stopWatchingLeader();
  beatWatch = setInterval(() => {
    if(session.role !== 'follower' || session.leaderless || !session.channel) return;
    if(!session.lastBeat) return;
    if(Date.now() - session.lastBeat < BEAT_LOST_MS) return;
    session.leaderless = true;
    session.paused = false;
    setSessionStatus('The leader dropped out — the mic is open.');
  }, 3000);
}
function stopWatchingLeader(){ if(beatWatch){ clearInterval(beatWatch); beatWatch = null; } }

/* A locked phone suspends both the timers and the socket. On waking, the
   watchdog measures a clock that stopped minutes ago and declares the mic open
   while the leader is still reciting. So on waking we reset the clock and ask
   where everyone is, rather than trusting a measurement taken across a gap. */
function sessionWake(){
  if(!session.channel || !session.code) return;
  noteLeaderAlive();
  if(session.role === 'leader') sendAlive();
  else { try{ session.channel.send({ type:'broadcast', event:'where', payload:{} }); }catch(e){} }
}
try{
  document.addEventListener('visibilitychange', () => { if(!document.hidden) sessionWake(); });
  window.addEventListener('online', sessionWake);
}catch(e){}

function releaseLead(){
  if(session.role !== 'leader' || !session.channel) return;
  session.term += 1;
  session.role = 'follower';
  session.leaderless = true;
  session.paused = false;
  stopBeating(); stopWatchingLeader();
  try{ session.channel.send({ type:'broadcast', event:'lead', payload:{ t:'release', term: session.term } }); }catch(e){}
  setSessionStatus('You passed the mic — anyone can take the lead.');
}

function takeLead(){
  slog('takeLead tap: role=' + session.role + ' leaderless=' + session.leaderless
    + ' term=' + session.term + ' claimTerm=' + claimState.term
    + ' chan=' + !!session.channel);
  if(!session.channel || session.role === 'leader'){ slog('takeLead REFUSED'); return; }
  /* Cancel here as well as in becomeLeader: the claim window is 700ms and the
     probe could otherwise expire inside it. */
  cancelProbe();
  /* Works whether or not we heard the release: the term simply moves past
     whatever the old leader was on, and their later messages are ignored. */
  /* Past the highest term anyone has claimed, not just our own — claimState
     outlives a session, and a leftover higher term made addClaim discard the
     claim silently. */
  const term = Math.max(session.term, claimState.term) + 1;
  session.claiming = true;
  addClaim(term, session.id);
  try{ session.channel.send({ type:'broadcast', event:'lead', payload:{ t:'claim', term, id: session.id } }); }catch(e){}
  setSessionStatus('Taking the lead…');
}

function addClaim(term, id){
  if(term < claimState.term){ slog('addClaim DROPPED t=' + term + ' < ' + claimState.term); return; }
  slog('addClaim t=' + term + ' id=' + String(id).slice(0,6));
  if(term > claimState.term){ claimState.term = term; claimState.ids = []; }
  if(claimState.ids.indexOf(id) === -1) claimState.ids.push(id);
  if(claimState.timer) clearTimeout(claimState.timer);
  claimState.timer = setTimeout(settleClaims, 700);
}

function settleClaims(){
  claimState.timer = null;
  const term = claimState.term;
  const ids = claimState.ids.slice().sort();
  slog('settle t=' + term + ' ids=' + ids.length + ' winner='
    + (ids.length ? (ids[0] === session.id ? 'ME' : 'other') : 'NONE'));
  claimState.ids = [];
  if(!ids.length || !session.channel) return;
  session.term = Math.max(session.term, term);
  session.leaderless = false;
  session.claiming = false;
  if(ids[0] === session.id){
    becomeLeader();
    slog('WON lead t=' + session.term);
    try{ session.channel.send({ type:'broadcast', event:'lead', payload:{ t:'lead', term: session.term, id: session.id } }); }catch(e){}
    if(session.lastNav) sendNav(session.lastNav.kind, session.lastNav.idx);
    setSessionStatus('You have the lead.');
  } else {
    /* Every other route to follower stops the beat and starts the watchdog.
       This one didn't: the device went on holding a leader's timers while
       calling itself a follower, and never noticed if the new leader went
       quiet. */
    slog('DEMOTE settleClaims lost claim');
    session.role = 'follower';
    session.paused = false;
    stopBeating(); noteLeaderAlive(); startWatchingLeader();
    setSessionStatus('Following the leader.');
  }
}

function handleLeadMsg(p){
  slog('lead msg ' + (p && p.t) + ' t=' + (p && p.term) + ' mine=' + session.term);
  if(!p || typeof p.term !== 'number' || p.term < session.term){ slog('lead msg IGNORED'); return; }
  if(p.t === 'release'){
    if(session.role === 'leader') slog('DEMOTE release t=' + p.term);
    session.term = p.term;
    session.role = 'follower';
    session.leaderless = true;
    session.paused = false;
    stopBeating(); stopWatchingLeader();
    session.claiming = false;
    setSessionStatus('The mic is open — anyone can take the lead.');
  } else if(p.t === 'claim'){
    addClaim(p.term, p.id);
  } else if(p.t === 'lead'){
    /* If we both think we won the same term, the lower id wins — same rule
       everywhere, so the disagreement resolves itself. */
    if(session.role === 'leader' && p.term === session.term && p.id > session.id){
      slog('kept lead over ' + String(p.id).slice(0,6)); return;
    }
    if(session.role === 'leader') slog('DEMOTE lead msg from '
      + String(p.id).slice(0,6) + ' t=' + p.term + ' mine=' + session.term);
    if(claimState.timer){ clearTimeout(claimState.timer); claimState.timer = null; }
    claimState.ids = [];
    session.term = p.term;
    session.leaderless = false;
    session.claiming = false;
    session.role = 'follower';
    session.paused = false;
    /* A new leader has the mic — stop beating if we had it, and start
       watching them instead. */
    stopBeating(); noteLeaderAlive(); startWatchingLeader();
    setSessionStatus('Following the leader.');
  }
}

/* Called by every open*() — the single place navigation is signalled. */
function onNavigated(kind, idx){
  if(suppressNavSignals) return;
  pushLoc();   /* after the gate: reopen() and remote navs must not push */
  /* Recorded even before a session exists: a leader who opened the piece
     first and started the session second would otherwise have nothing to
     answer a joiner's 'where' with. */
  session.lastNav = { kind, idx };
  if(session.role === 'leader'){ sendNav(kind, idx); }
  else if(session.role === 'follower' && !session.leaderless){ pauseFollowing(); }
}

/* The banner lives on <body>, outside #app, so re-rendering never wipes it. */
function renderSessionBanner(){
  let el = document.getElementById('session-banner');
  if(!session.role){ if(el) el.remove(); return; }
  if(!el){ el = document.createElement('div'); el.id = 'session-banner'; document.body.appendChild(el); }
  el.className = 'session-banner' + (session.paused && !session.leaderless ? ' paused' : '') + (session.leaderless ? ' open-mic' : '');
  const label = session.leaderless ? 'Mic open'
              : session.role === 'leader' ? 'Leading'
              : (session.paused ? 'Paused' : 'Following');
  const mic = session.leaderless
    ? `<button class="mic" onclick="takeLead()">Take the lead</button>`
    : session.role === 'leader'
      ? `<button onclick="releaseLead()">Pass the mic</button>` : '';
  el.innerHTML = `
    <span class="dot"></span>
    <span class="txt" onclick="toggleSessionDbg()">${label} · ${session.code}</span>
    ${session.dbg ? `<span class="txt dbg" id="session-dbg">${dbgLine()}</span>` : ''}
    ${mic}
    ${(session.paused && !session.leaderless) ? `<button onclick="resumeFollowing()">Resume</button>` : ''}
    <button onclick="shareSession()" aria-label="Share this session">Share</button>
    <button onclick="leaveSession()">Leave</button>`;
}

/* Tapping the banner's status shows the counters. Two people on two phones
   can then say exactly where the chain breaks — sent but not received is the
   network, received but not moved is the target lookup. */
let dbgTimer = null;
function toggleSessionDbg(){
  session.dbg = !session.dbg;
  if(dbgTimer){ clearInterval(dbgTimer); dbgTimer = null; }
  /* These were a snapshot taken at the moment of the tap, which made a leader
     that hadn't sent anything YET look identical to one that could never send
     — two very different faults reading as the same zero. Keep them moving. */
  if(session.dbg) dbgTimer = setInterval(() => {
    const el = document.getElementById('session-dbg');
    if(el) el.textContent = dbgLine(); else renderSessionBanner();
  }, 500);
  renderSessionBanner();
}
function dbgLine(){
  const view = renderedView();
  if(session.role === 'leader'){
    return 's' + (session.dbgSent||0)
         + ' · at ' + (session.dbgSpot || '—')
         + (session.dbgWhy ? '(' + session.dbgWhy + ')' : '')
         + ' · ' + (spotTick ? 'tick' : 'NO TICK')
         + ' · ' + view;
  }
  const mine = session.lastNav ? (session.lastNav.kind + ':' + session.lastNav.idx) : '—';
  const t = spotTarget ? (spotTarget.verse + '@' + (spotTarget.frac||0).toFixed(2)) : '—';
  const el = spotTarget ? (verseEl(spotTarget.kind, spotTarget.idx, spotTarget.verse) ? 'found' : 'MISSING') : '—';
  return 'r' + (session.dbgRecv||0)
       + ' · got ' + (session.dbgLast||'—')
       + ' · mine ' + mine
       + ' · tgt ' + t + ' ' + el
       + (session.paused ? ' · PAUSED' : '')
       + ' · ' + view;
}

/* A shareable link that drops someone straight into the session — the code
   lives in the URL fragment, so it never reaches a server. Sending this over
   WhatsApp reaches the whole room at once, which a QR code can't do. */
/* ── QR encoder ───────────────────────────────────────────────────────────
   Byte mode, error-correction level M, versions 1–10 (up to 216 bytes) —
   ample for a session link. Written out in full because the app must work
   with no network at all, so a CDN library is not an option. */

const QR_TOTAL = [0,26,44,70,100,134,172,196,242,292,346];
/* per version: [EC codewords per block, blocks in group 1, data codewords in
   each, blocks in group 2, data codewords in each] — level M only. */
const QR_M = [null,
  [10,1,16,0,0], [16,1,28,0,0], [26,1,44,0,0], [18,2,32,0,0], [24,2,43,0,0],
  [16,4,27,0,0], [18,4,31,0,0], [22,2,38,2,39], [22,3,36,2,37], [26,4,43,1,44]];
const QR_ALIGN = [null,[],[6,18],[6,22],[6,26],[6,30],[6,34],
  [6,22,38],[6,24,42],[6,26,46],[6,28,50]];

/* GF(256) with the QR primitive polynomial 0x11D. */
const GF_EXP = new Uint8Array(512), GF_LOG = new Uint8Array(256);
(function(){
  let x = 1;
  for(let i=0;i<255;i++){
    GF_EXP[i] = x; GF_LOG[x] = i;
    x <<= 1; if(x & 0x100) x ^= 0x11D;
  }
  for(let i=255;i<512;i++) GF_EXP[i] = GF_EXP[i-255];
})();
function gfMul(a,b){ return (a===0||b===0) ? 0 : GF_EXP[GF_LOG[a]+GF_LOG[b]]; }

/* Generator polynomial for n error-correction codewords. */
function qrGenPoly(n){
  let p = [1];
  for(let i=0;i<n;i++){
    const q = new Array(p.length+1).fill(0);
    for(let j=0;j<p.length;j++){
      q[j] ^= gfMul(p[j], 1);
      q[j+1] ^= gfMul(p[j], GF_EXP[i]);
    }
    p = q;
  }
  return p;
}

/* Remainder of the data polynomial divided by the generator. */
function qrEC(data, n){
  const gen = qrGenPoly(n);
  const rem = new Array(data.length + n).fill(0);
  for(let i=0;i<data.length;i++) rem[i] = data[i];
  for(let i=0;i<data.length;i++){
    const c = rem[i];
    if(!c) continue;
    for(let j=0;j<gen.length;j++) rem[i+j] ^= gfMul(gen[j], c);
  }
  return rem.slice(data.length);
}

function qrBytes(str){
  const out = [];
  for(let i=0;i<str.length;i++){
    let c = str.codePointAt(i);
    if(c > 0xFFFF) i++;
    if(c < 0x80) out.push(c);
    else if(c < 0x800){ out.push(0xC0|(c>>6), 0x80|(c&63)); }
    else if(c < 0x10000){ out.push(0xE0|(c>>12), 0x80|((c>>6)&63), 0x80|(c&63)); }
    else { out.push(0xF0|(c>>18), 0x80|((c>>12)&63), 0x80|((c>>6)&63), 0x80|(c&63)); }
  }
  return out;
}

function qrDataCapacity(v){
  const s = QR_M[v];
  return s[1]*s[2] + s[3]*s[4];
}
/* ── The bit stream ─────────────────────────────────────────────────────── */
function qrBitStream(bytes, v){
  const bits = [];
  const push = (val, len) => { for(let i=len-1;i>=0;i--) bits.push((val>>i)&1); };
  push(0b0100, 4);                       /* byte mode */
  push(bytes.length, v < 10 ? 8 : 16);   /* character count */
  for(const b of bytes) push(b, 8);
  const cap = qrDataCapacity(v) * 8;
  for(let i=0;i<4 && bits.length<cap;i++) bits.push(0);   /* terminator */
  while(bits.length % 8) bits.push(0);
  const pads = [0xEC, 0x11];
  for(let i=0; bits.length < cap; i++) push(pads[i%2], 8);
  const cw = [];
  for(let i=0;i<bits.length;i+=8){
    let b = 0;
    for(let j=0;j<8;j++) b = (b<<1) | bits[i+j];
    cw.push(b);
  }
  return cw;
}

/* Split into blocks, add error correction, then interleave — the spread that
   lets a torn or shadowed corner lose part of every block rather than all of
   one. */
function qrCodewords(str, v){
  const cw = qrBitStream(qrBytes(str), v);
  const [ecLen, g1, d1, g2, d2] = QR_M[v];
  const blocks = [], ecs = [];
  let at = 0;
  for(let i=0;i<g1;i++){ blocks.push(cw.slice(at, at+d1)); at += d1; }
  for(let i=0;i<g2;i++){ blocks.push(cw.slice(at, at+d2)); at += d2; }
  for(const b of blocks) ecs.push(qrEC(b, ecLen));
  const out = [];
  const maxData = Math.max(d1, d2);
  for(let i=0;i<maxData;i++) for(const b of blocks) if(i < b.length) out.push(b[i]);
  for(let i=0;i<ecLen;i++) for(const e of ecs) out.push(e[i]);
  return out;
}

/* ── The grid ───────────────────────────────────────────────────────────── */
function qrBlank(size){
  const m = [], f = [];
  for(let i=0;i<size;i++){ m.push(new Array(size).fill(0)); f.push(new Array(size).fill(0)); }
  return { m, f };
}

function qrFunctions(m, f, v, size){
  const set = (r,c,val) => { if(r<0||c<0||r>=size||c>=size) return; m[r][c]=val; f[r][c]=1; };
  /* finders + their separators */
  const finder = (R,C) => {
    for(let r=-1;r<=7;r++) for(let c=-1;c<=7;c++){
      const inner = r>=0&&r<=6&&c>=0&&c<=6;
      const on = inner && (r===0||r===6||c===0||c===6||(r>=2&&r<=4&&c>=2&&c<=4));
      set(R+r, C+c, on ? 1 : 0);
    }
  };
  finder(0,0); finder(0,size-7); finder(size-7,0);
  /* timing */
  for(let i=8;i<size-8;i++){ set(6,i,(i%2===0)?1:0); set(i,6,(i%2===0)?1:0); }
  /* alignment, skipping the three finder corners */
  const ap = QR_ALIGN[v];
  for(const r of ap) for(const c of ap){
    if((r<=8&&c<=8)||(r<=8&&c>=size-9)||(r>=size-9&&c<=8)) continue;
    for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++){
      const on = Math.max(Math.abs(dr),Math.abs(dc)) !== 1;
      set(r+dr, c+dc, on ? 1 : 0);
    }
  }
  /* the always-dark module, and space reserved for format info */
  set(size-8, 8, 1);
  for(let i=0;i<=8;i++){ if(i!==6) set(8,i,0); if(i!==6) set(i,8,0); }
  for(let i=0;i<8;i++){ set(8,size-1-i,0); set(size-1-i,8,0); }
  /* version blocks, v7 and up */
  if(v >= 7){
    const bits = qrVersionBits(v);
    for(let i=0;i<18;i++){
      const b = (bits >> i) & 1;
      set(Math.floor(i/3), size-11+(i%3), b);
      set(size-11+(i%3), Math.floor(i/3), b);
    }
  }
}

function qrVersionBits(v){
  let d = v << 12;
  for(let i=0;i<6;i++) if((d >> (17-i)) & 1) d ^= 0x1F25 << (5-i);
  return (v << 12) | d;
}

function qrFormatBits(mask){
  const data = (0b00 << 3) | mask;          /* 00 = level M */
  let d = data << 10;
  for(let i=0;i<5;i++) if((d >> (14-i)) & 1) d ^= 0x537 << (4-i);
  return ((data << 10) | d) ^ 0x5412;
}

function qrPlaceFormat(m, v, size, mask){
  const bits = qrFormatBits(mask);
  const bit = i => (bits >> i) & 1;
  for(let i=0;i<=5;i++) m[8][i] = bit(i);
  m[8][7] = bit(6); m[8][8] = bit(7); m[7][8] = bit(8);
  for(let i=9;i<15;i++) m[14-i][8] = bit(i);
  for(let i=0;i<8;i++) m[size-1-i][8] = bit(i);
  for(let i=8;i<15;i++) m[8][size-15+i] = bit(i);
  m[size-8][8] = 1;
}

function qrMaskFn(k){
  return [
    (i,j)=>((i+j)%2)===0,
    (i,j)=>(i%2)===0,
    (i,j)=>(j%3)===0,
    (i,j)=>((i+j)%3)===0,
    (i,j)=>((Math.floor(i/2)+Math.floor(j/3))%2)===0,
    (i,j)=>(((i*j)%2)+((i*j)%3))===0,
    (i,j)=>((((i*j)%2)+((i*j)%3))%2)===0,
    (i,j)=>((((i+j)%2)+((i*j)%3))%2)===0
  ][k];
}

/* Walk the data up and down in pairs of columns, right to left, stepping over
   the vertical timing line. */
function qrPlaceData(m, f, size, cw){
  let bit = 0;
  const total = cw.length * 8;
  const next = () => {
    if(bit >= total) return 0;
    const b = (cw[bit >> 3] >> (7 - (bit & 7))) & 1;
    bit++;
    return b;
  };
  let upward = true;
  for(let right=size-1; right>0; right-=2){
    if(right === 6) right = 5;             /* the timing column is not data */
    for(let k=0;k<size;k++){
      const r = upward ? size-1-k : k;
      for(let c of [right, right-1]){
        if(f[r][c]) continue;
        m[r][c] = next();
      }
    }
    upward = !upward;
  }
}

function qrPenalty(m, size){
  let p = 0;
  /* runs of five or more */
  for(let i=0;i<size;i++){
    for(const row of [true,false]){
      let run = 1, prev = row ? m[i][0] : m[0][i];
      for(let j=1;j<size;j++){
        const v = row ? m[i][j] : m[j][i];
        if(v === prev) run++;
        else { if(run >= 5) p += 3 + (run-5); run = 1; prev = v; }
      }
      if(run >= 5) p += 3 + (run-5);
    }
  }
  /* solid two-by-two squares */
  for(let i=0;i<size-1;i++) for(let j=0;j<size-1;j++){
    const v = m[i][j];
    if(v===m[i][j+1] && v===m[i+1][j] && v===m[i+1][j+1]) p += 3;
  }
  /* the finder-lookalike sequence, either way round */
  const A = [1,0,1,1,1,0,1,0,0,0,0], B = [0,0,0,0,1,0,1,1,1,0,1];
  const runs = (get) => {
    for(let i=0;i<size;i++) for(let j=0;j<=size-11;j++){
      let a = true, b = true;
      for(let k=0;k<11;k++){ const v = get(i,j+k); if(v!==A[k]) a=false; if(v!==B[k]) b=false; }
      if(a) p += 40; if(b) p += 40;
    }
  };
  runs((i,j)=>m[i][j]); runs((i,j)=>m[j][i]);
  /* balance of dark to light */
  let dark = 0;
  for(let i=0;i<size;i++) for(let j=0;j<size;j++) dark += m[i][j];
  const pct = dark * 100 / (size*size);
  p += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return p;
}

/* The matrix for a string: smallest version that fits, best of the eight
   masks. Returns { size, m } with m[row][col] as 0 or 1. */
function qrMatrix(str){
  const bytes = qrBytes(str);
  let v = 0;
  for(let i=1;i<=10;i++){
    const head = 4 + (i < 10 ? 8 : 16);
    if(qrDataCapacity(i)*8 >= head + bytes.length*8){ v = i; break; }
  }
  if(!v) return null;                      /* too long — caller falls back */
  const size = 17 + 4*v;
  const cw = qrCodewords(str, v);
  let best = null;
  for(let mask=0; mask<8; mask++){
    const { m, f } = qrBlank(size);
    qrFunctions(m, f, v, size);
    qrPlaceData(m, f, size, cw);
    for(let i=0;i<size;i++) for(let j=0;j<size;j++)
      if(!f[i][j] && qrMaskFn(mask)(i,j)) m[i][j] ^= 1;
    qrPlaceFormat(m, v, size, mask);
    const p = qrPenalty(m, size);
    if(!best || p < best.p) best = { p, m, mask };
  }
  return { size, m: best.m, version: v, mask: best.mask };
}

/* An SVG of the matrix, with the quiet zone the spec requires — without it
   many scanners simply will not see the code. */
function qrSVG(str, px){
  const q = qrMatrix(str);
  if(!q) return '';
  const quiet = 4, dim = q.size + quiet*2;
  let path = '';
  for(let r=0;r<q.size;r++) for(let c=0;c<q.size;c++)
    if(q.m[r][c]) path += 'M' + (c+quiet) + ' ' + (r+quiet) + 'h1v1h-1z';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '"'
       + ' width="' + (px||220) + '" height="' + (px||220) + '" shape-rendering="crispEdges" role="img" aria-label="Session QR code">'
       + '<rect width="' + dim + '" height="' + dim + '" fill="#FAF5EA"/>'
       + '<path d="' + path + '" fill="#123528"/></svg>';
}
/* ── Scan to join ─────────────────────────────────────────────────────────
   In a hall, reading a code aloud is slow and a link needs a group chat that
   not everyone is in. A code on the leader's screen is the shortest path from
   "can I follow?" to following. */
function showSessionQR(){
  hideSessionQR();
  const url = sessionLink();
  const svg = qrSVG(url, 260);
  const wrap = document.createElement('div');
  wrap.id = 'qr-wrap';
  wrap.className = 'qr-wrap';
  wrap.innerHTML = `<div class="qr-card">
      <div class="qr-t">Scan to join</div>
      <div class="qr-code">${svg || '<div class="qr-fail">Show the code instead.</div>'}</div>
      <div class="qr-num">${attrEsc(session.code || '')}</div>
      <div class="qr-link">${attrEsc(url)}</div>
      <div class="qr-btns">
        <button class="session-btn" onclick="copySessionLink()">Copy link</button>
        ${navigator.share ? '<button class="session-btn" onclick="nativeShare()">Share\u2026</button>' : ''}
        <button class="session-btn primary" onclick="hideSessionQR()">Done</button>
      </div>
    </div>`;
  wrap.addEventListener('click', e => { if(e.target === wrap) hideSessionQR(); });
  document.body.appendChild(wrap);
}
function hideSessionQR(){
  const el = document.getElementById('qr-wrap');
  if(el) el.remove();
}
document.addEventListener('keydown', e => { if(e.key === 'Escape') hideSessionQR(); });

function sessionLink(code){
  const c = code || session.code;
  return location.origin + location.pathname + '#s=' + c;
}
/* Share now shows the code on screen; the phone's own share sheet is one tap
   further in, for sending it to someone who isn't in the room. */
function shareSession(){ showSessionQR(); }
function nativeShare(){
  const url = sessionLink();
  if(navigator.share){
    navigator.share({ title: 'Mawlid session', text: 'Follow along with the gathering:', url })
      .catch(() => {});   // the person simply dismissed the share sheet
  } else {
    copySessionLink();
  }
}
function copySessionLink(){
  const url = sessionLink();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url)
      .then(() => setSessionStatus('Link copied — paste it to the group.'))
      .catch(() => setSessionStatus('Copy failed. The code is ' + session.code + '.'));
  } else {
    setSessionStatus('Share the code: ' + session.code);
  }
}
/* Everything about this device's session in one screenful, so a fault can be
   reported by screenshot instead of squinting at a banner and retyping it.
   Each line answers one of the conditions that has to hold for the leader's
   position to reach anybody at all. */
function sessionReport(){
  const n = s => { try { return document.querySelectorAll(s).length; } catch(e){ return -1; } };
  let spot = null, spotErr = '';
  try { spot = currentSpot(); } catch(e){ spotErr = String((e && e.message) || e); }
  return [
    'Sacred Texts ' + APP_VERSION + '  —  session report',
    'role      ' + (session.role || '—') + '   code ' + (session.code || '—') + '   term ' + session.term,
    'paused    ' + !!session.paused + '   leaderless ' + !!session.leaderless,
    'channel   ' + (session.channel ? 'yes' : 'NO')
      + '   beat ' + (beatTimer ? 'on' : 'OFF')
      + '   tick ' + (spotTick ? 'on' : 'OFF'),
    'lastNav   ' + (session.lastNav ? session.lastNav.kind + ':' + session.lastNav.idx : 'NONE'),
    'leaderAt  ' + (session.leaderAt ? JSON.stringify(session.leaderAt) : 'NONE'),
    'view      rendered ' + renderedView() + '   pageView ' + !!state.pageView
      + '   tab ' + state.tab + '   readerOpen ' + readerOpen,
    'dom       study ' + n('main.verses article.verse[data-v]')
      + '   book ' + n('.ms-v[data-mk]'),
    'spot      ' + (spotErr ? 'THREW ' + spotErr : JSON.stringify(spot))
      + '   why ' + (session.dbgWhy || '—'),
    'counts    sent ' + (session.dbgSent || 0) + '   recv ' + (session.dbgRecv || 0)
      + '   last ' + (session.dbgLast || '—'),
    'target    ' + JSON.stringify(spotTarget || null),
    '',
    'recent — newest last',
    (sesLog.length ? sesLog.join('\n') : '(nothing recorded)')
  ].join('\n');
}

function showSessionReport(){
  hideSessionQR();
  const wrap = document.createElement('div');
  wrap.id = 'qr-wrap';
  wrap.className = 'qr-wrap';
  wrap.innerHTML = '<div class="qr-card"><div class="qr-t">Session report</div>'
    + '<pre class="rep">' + attrEsc(sessionReport()) + '</pre>'
    + '<div class="qr-btns">'
    + '<button class="session-btn" onclick="copySessionReport()">Copy</button>'
    + '<button class="session-btn primary" onclick="hideSessionQR()">Done</button>'
    + '</div></div>';
  wrap.addEventListener('click', e => { if(e.target === wrap) hideSessionQR(); });
  document.body.appendChild(wrap);
}

function copySessionReport(){
  const txt = sessionReport();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt)
      .then(() => setSessionStatus('Report copied — paste it into the chat.'))
      .catch(() => setSessionStatus('Copy failed — screenshot the report instead.'));
  } else {
    setSessionStatus('Screenshot the report — this browser blocks copying.');
  }
}

/* A session code arriving in the URL, e.g. …/#s=4821 */
function pendingSessionCode(){
  const m = /[#&?]s=([A-Za-z0-9._-]{3,30})/.exec(location.hash || '');
  const c = m ? normalizeCode(m[1]) : null;
  return validCode(c || '') ? c : null;
}
function clearSessionHash(){
  if(location.hash && /[#&?]s=/.test(location.hash)){
    try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}
  }
}

/* The link is just the code — it says nothing about who's leading — so anyone
   in the session can pass it on. Followers get the same buttons as the leader,
   which means a latecomer can be pulled in without interrupting whoever is
   reciting. */
function shareRow(){
  return `<div class="session-share">
    <button class="session-btn primary" onclick="shareSession()">Share link</button>
    <button class="session-btn" onclick="copySessionLink()">Copy link</button>
    <button class="session-btn" onclick="showSessionReport()">Report</button>
  </div>`;
}

function sessionPanel(){
  if(!sessionConfigured()){
    return `<div class="no-results">Live sessions aren't set up yet.<br><br>
      They need a free Supabase project — see the README for the two values to paste in.<br><br>
      Everything else in the app works without it.</div>`;
  }
  const note = session.status ? `<div class="session-status">${session.status}</div>` : '';
  if(session.connecting && !session.role){
    return `<div class="session-panel">
      <div class="session-code">${session.connecting}</div>
      <p>Joining…</p>
      ${note}
      <button class="session-btn quiet" onclick="leaveSession()">Cancel</button>
    </div>`;
  }
  if(session.role === 'leader'){
    return `<div class="session-panel">
      <div class="session-code">${session.code}</div>
      <p>Send the link to your group — tapping it joins them straight away. Or read the code aloud for anyone who can't open it.</p>
      ${shareRow()}
      ${note}
      <button class="session-btn" onclick="releaseLead()">Pass the mic</button>
      <button class="session-btn quiet" onclick="leaveSession()">End session</button>
    </div>`;
  }
  if(session.role === 'follower' && session.leaderless){
    return `<div class="session-panel">
      <div class="session-code">${session.code}</div>
      <p>No one is leading right now. Whoever takes the mic chooses what the gathering reads next.</p>
      <button class="session-btn primary" onclick="takeLead()">Take the lead</button>
      <p class="session-hint">If several people tap at once, one is chosen and the rest keep following — nobody has to sort it out.</p>
      ${shareRow()}
      ${note}
      <button class="session-btn quiet" onclick="leaveSession()">Leave session</button>
    </div>`;
  }
  if(session.role === 'follower'){
    return `<div class="session-panel">
      <div class="session-code">${session.code}</div>
      <p>You're following the leader. Open anything yourself and you'll take over — tap Resume in the banner to follow again.</p>
      ${session.paused
        ? `<button class="session-btn" onclick="takeLead()">Take the lead</button>
      <p class="session-hint">The leader has gone quiet — their phone may have dropped out. Take the lead if the gathering needs to carry on.</p>`
        : `<p class="session-hint">Someone is leading right now, so the mic isn't offered here. If they go quiet, a Take the lead button will appear.</p>`}
      <p class="session-hint">Someone just arrived? Send them the link yourself — no need to interrupt the leader.</p>
      ${shareRow()}
      ${note}
      <button class="session-btn quiet" onclick="leaveSession()">Leave session</button>
    </div>`;
  }
  const last = lastSession();
  const rejoin = last ? `
    <button class="session-btn primary" onclick="rejoinLast()">Rejoin ${last.code}</button>
    <p class="session-hint">You were in this session ${agoLabel(last.at)}. If it's still running you'll rejoin it; if not, you can take the lead yourself. <button class="link-btn" onclick="forgetLastSession()">Forget it</button></p>` : '';
  return `<div class="session-panel">
    <p>Everyone's screen follows whoever is leading. Needs internet — without it, the app still works and you navigate by hand.</p>
    ${rejoin}
    <div class="session-join">
      <input id="start-code" maxlength="24" placeholder="venue name" aria-label="Venue code" value="${lastVenue()}">
      <button class="session-btn${last ? '' : ' primary'}" onclick="startSession()">Start a session</button>
    </div>
    <p class="session-hint">Leave it blank for a random number. Or give the venue a name of its own — <em>alnoor</em>, <em>masjidtaqwa</em> — and it stays the same every week, so a QR printed at the door always joins that night's session. Names are far safer than numbers: two gatherings could both pick 1111, but not both pick your masjid's name.</p>
    <div class="session-join">
      <input id="join-code" maxlength="24" placeholder="code" aria-label="Session code">
      <button class="session-btn" onclick="joinSession()">Join</button>
    </div>
    ${note}
  </div>`;
}

/* The green chapter note. Anything past a couple of lines is folded behind a
   disclosure so the reader meets the prayer first and opens the background only
   if they want it; short notes are left showing, since hiding a single line
   costs a tap and saves nothing. Length is measured on the text, not the
   markup, because some notes carry an Arabic line in a span. */
const NOTE_FOLD_AT = 160;

/* The top of a Dalāʾil or ḥizb reader (the other collections keep noteBlock
   and their full-width bars).

   The chapter note is HIDDEN for now (owner's call, v428 / v99): the owner
   may want it back, so it is switched off here rather than removed. Set
   SHOW_CHAPTER_NOTES to true and it returns as a small "About · نُبْذَة"
   button that opens the note beneath it (a short note simply shows). The
   notes themselves are untouched in the data.

   Listen is the full-width bar again ("wider again", owner's call — v427
   had shrunk it to a small button beside About). In the Book Version it
   sits in #ms-tune, offered from the opening leaf only, as before. */
const SHOW_CHAPTER_NOTES = false;
function readerActions(q, kind, idx, book){
  const note = (SHOW_CHAPTER_NOTES && q.note) ? String(q.note) : '';
  const plain = note.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const folds = plain.length > NOTE_FOLD_AT;
  const shortNote = (note && !folds) ? `<div class="qnote">${note}</div>` : '';
  const about = folds ? `<div class="reader-actions"><button class="ra-btn" onclick="toggleAbout(this)" aria-expanded="false">About · نُبْذَة</button></div>
    <div class="qnote about-body" hidden>${note}</div>` : '';
  const listen = `${(q.video || audioFor(kind, idx).length) ? `<button class="qtune" onclick="openPlayerFor('${kind}',${idx},1)">▶ Listen to this ḥizb</button>` : ''}
    ${q.video2 ? `<button class="qtune" onclick="openPlayerFor('${kind}',${idx},2)">▶ Listen — alternate version</button>` : ''}`;
  const block = about + listen;
  if(!block.trim()) return shortNote;
  return shortNote + (book ? `<div class="ms-tune" id="ms-tune">${block}</div>` : block);
}
function toggleAbout(btn){
  const body = btn.parentElement && btn.parentElement.nextElementSibling;
  if(!body || !body.classList.contains('about-body')) return;
  const open = body.hidden;
  body.hidden = !open;
  btn.classList.toggle('on', open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
/* Opens and closes in place — like the refrain markers and the size sliders,
   never through reopen(), so the reader keeps its scroll. state.aaOpen is in
   memory only, so it survives the re-render a column toggle makes but a
   chapter still opens with the panel shut. */
function toggleAa(){
  state.aaOpen = !state.aaOpen;
  document.querySelectorAll('.aa-panel').forEach(p => p.classList.toggle('open', !!state.aaOpen));
  document.querySelectorAll('.aa-btn').forEach(b => {
    b.classList.toggle('on', !!state.aaOpen);
    b.setAttribute('aria-expanded', state.aaOpen ? 'true' : 'false');
  });
}
function noteBlock(note){
  if(!note) return '';
  const plain = String(note).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if(plain.length <= NOTE_FOLD_AT) return `<div class="qnote">${note}</div>`;
  return `<details class="qnote">
      <summary>About this section · نُبْذَة <span class="qnote-chev">›</span></summary>
      <div class="qnote-body">${note}</div>
    </details>`;
}

/* Opening a reader swaps #app's contents without touching state.tab, so a
   follower who joined from the session tab still counts as being "on" it.
   Session-status updates used to re-render the index on that basis and paint
   over the piece the leader had just sent them to — about a second after they
   arrived. This flag lets those re-renders tell the difference. */
let readerOpen = false;
function readerHTML(q, backOnclick, kind, idx){
  readerOpen = true;
  msPiece = { kind, idx };
  /* Readers write directly to app.innerHTML and bypass renderIndex(), so
     the section color has to be set here too — otherwise a reader opened
     straight from a fresh app.innerHTML call (rather than a tab switch)
     would keep whatever theme was last set. */
  document.documentElement.setAttribute('data-theme', sectionThemeOf(state.tab));
  const empty = !q.verses || q.verses.length === 0;
  /* Turkish ilahis carry their own name in both title fields, so the subheader
     would read it twice — keep only the translation after the dash. */
  let enTitle = (q.latin && q.titleEnglish && q.titleEnglish.indexOf(' \u2014 ') !== -1)
    ? q.titleEnglish.split(' \u2014 ').slice(1).join(' \u2014 ')
    : q.titleEnglish;
  /* Same reasoning one step further: when a latin piece names itself
     identically in both fields (a sohbet given in English, say), the
     subheader is just the title again. Drop it rather than repeat. */
  if(q.latin && sameTitle(enTitle, q.titleArabic)) enTitle = '';
  const controlsTarget = `'${kind}',${idx}`;
  /* Some pieces ship the illuminated pages they were transcribed from. Those are
     read as they were printed — no transliteration or translation over them. */
  const hasPages = Array.isArray(q.folios) && q.folios.length > 0;
  const pageView = hasPages && state.pageView;
  /* The compact top — Aa panel, slim About · Listen row — is for the Dalāʾil
     and the aḥzāb only (owner's call); every other collection keeps its
     settings in the open and its full-width bars. The Aa panel holds the
     columns and the text size, Study only. */
  const compact = kind === 'd' || kind === 'l';
  const aaHas = compact && (!pageView || !q.latin);
  const fav = isFav(kind, idx);
  /* Nothing to reveal, no toggle: an English-only sohbet has no translation
     line under each paragraph. */
  const hasEn = Array.isArray(q.verses) && q.verses.some(v => v && String(v.en || '').trim() !== '');
  return `
    <div class="reader-bar">
      <div class="rside"><button class="back" onclick="${backOnclick}">‹ Back</button></div>
      <img class="reader-bismillah" src="${HEADER_BISMILLAH}" width="640" height="114"
           alt="\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0647\u0650 \u0627\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064e\u062d\u0650\u064a\u0645\u0650">
      <div class="rside end"><button class="theme-toggle bar-theme" onclick="toggleTheme()" aria-label="Day or night">${themeGlyph()}</button>${(hasPages && !empty) ? `<button class="view-swap" onclick="setPageView(${!pageView},${controlsTarget})" aria-label="Switch to ${pageView?'Study':'Book'} Version">${SWAP_ICON_SVG}<span>${pageView?'Study':'Book'}</span></button>` : ''}<button class="fav-btn ${fav?'on':''}" onclick="toggleFav(${controlsTarget})"
              aria-label="${fav?'Remove bookmark':'Bookmark this'}">${bookmarkIcon(fav)}</button></div>
    </div>
    <div class="piece-head">
      <div class="piece-title-ar">${q.titleArabic}</div>
      ${enTitle ? `<div class="piece-title-en">${enTitle}</div>` : ''}
      ${('date' in q || 'location' in q) ? `<div class="piece-meta">${sohbetMeta(q)}</div>` : ''}
    </div>
    ${empty ? '' : `<div class="controls">
      ${kind === 'd' && pageView ? `<button class="chip place-btn ${placeIsHere(idx)&&placeStillMarked()?'on':''}"
        data-idx="${idx}" onclick="saveDalailPlace(${idx})">${placeBtnLabel(idx)}</button>` : ''}
      ${hasPages ? `<span class="view-switch" role="group" aria-label="How to read this">
        <button class="${pageView?'on':''}" onclick="setPageView(true,${controlsTarget})">Book Version</button>
        <button class="${pageView?'':'on'}" onclick="setPageView(false,${controlsTarget})">Study Version</button>
        </span>
      ${pageView && spreadOffered() ? `<button class="chip ${spreadOn()?'on':'off'}"
        onclick="toggleSpread(${controlsTarget})">Two pages</button>` : ''}
      ${pageView ? `<button class="chip icon" onclick="setImmersive(true)" aria-label="Full screen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/></svg>
      </button>` : ''}` : ''}
      ${aaHas ? `<button class="chip aa-btn${state.aaOpen?' on':''}" onclick="toggleAa()" aria-expanded="${state.aaOpen?'true':'false'}"
        aria-label="Reading settings">Aa</button>
      <div class="aa-panel${state.aaOpen?' open':''}">
        ${q.latin ? '' : `<div class="aa-row"><span class="view-switch script-switch" role="group" aria-label="Arabic script">${[['uthmani','Uthmani'],['indopak','IndoPak'],['naskh','Naskh']].map(([v,l]) =>
          `<button data-font="${v}" class="${arFont===v?'on':''}" aria-pressed="${arFont===v}" onclick="setArFont('${v}')">${l}</button>`).join('')}</span></div>`}
        ${pageView ? '' : `<div class="aa-row">
        ${q.latin ? '' : `<button class="chip ${state.showTr?'':'off'}" onclick="toggle(${controlsTarget})">Transliteration</button>`}
        <button class="chip ${state.showEn?'':'off'}" onclick="toggleEn(${controlsTarget})">Translation</button></div>
        <div class="size-row">
          ${q.latin ? '' : sizeSlider('ar', state.arScale)}
          ${sizeSlider('latin', state.latinScale)}
        </div>`}
      </div>` : compact ? '' : `
      ${pageView ? '' : `
      ${q.latin ? '' : `<button class="chip ${state.showTr?'':'off'}" onclick="toggle(${controlsTarget})">Transliteration</button>`}
          ${hasEn ? `<button class="chip ${state.showEn?'':'off'}" onclick="toggleEn(${controlsTarget})">Translation</button>` : ''}
      <div class="size-row">
        ${q.latin ? '' : sizeSlider('ar', state.arScale)}
        ${sizeSlider('latin', state.latinScale)}
      </div>`}
      `}
    </div>`}
    <main class="verses${pageView ? ' ms-view' : ''}${(kind === 'd' || kind === 'l') ? ' paper' : ''}">
      ${pageView ? manuscriptPages(q, kind, idx) : empty ? placeholder(q.titleEnglish) : `
      ${compact ? readerActions(q, kind, idx, false) : `${noteBlock(q.note)}
      ${(q.video || audioFor(kind, idx).length) ? `<button class="qtune" onclick="openPlayerFor('${kind}',${idx},1)">▶ Listen to the tune</button>` : ''}
      ${q.video2 ? `<button class="qtune" onclick="openPlayerFor('${kind}',${idx},2)">▶ Listen — alternate version</button>` : ''}`}
      ${q.verses.map((v,n)=> v.omit ? '' : `
        <article class="verse ${v.refrain||v.refrainCont?'refrain':''} ${v.instruction?'v-instruction':''}${kind==='d'&&placedVerse(idx,n)?' placed':''}" data-v="${n}">
          ${kind === 'd' ? `<button class="verse-place ${placedVerse(idx,n)?'on':''}"
            onclick="placeVerse(${idx},${n})"
            aria-label="${placedVerse(idx,n)?'Remove my place':'Mark my place here'}"
            title="${placedVerse(idx,n)?'Remove my place':'Mark my place here'}">${bookmarkIcon(placedVerse(idx,n))}</button>` : ''}
          <div class="v-num">${toArNum(verseNo(kind, idx, n))}</div>
          ${v.refrain?'<div class="refrain-note">Chorus · يُرَدَّد</div>':''}
          ${v.instruction?'<div class="instruction-note">Instruction · إِرْشَاد</div>':''}
          ${v.note?`<div class="v-note">${v.note}</div>`:''}
          ${q.latin
            ? `<div class="v-latin${q.prose ? ' v-prose' : ''}">${stripBreaks(v.ar).replaceAll('\n','<br>')}</div>`
            : `${(() => {
                const sp = splitBasmala(stripBreaks(v.ar));
                if(!sp) return `<div class="v-ar">${arHTML(v.ar, kind==='d')}${v.sep ? ` <span class="v-salawat">${v.sep}</span>` : ''}</div>`;
                return `${sp.pre ? `<div class="v-ar">${arHTML(sp.pre)}</div>` : ''}
                        <div class="v-ar v-basmala">${arHTML(sp.basmala)}</div>
                        ${sp.rest ? `<div class="v-ar">${arHTML(sp.rest)}</div>` : ''}`;
              })()}
          ${v.tr ? `<div class="v-tr ${state.showTr?'':'hide'}">${v.tr.replaceAll('\n','<br>')}</div>` : ''}`}
          ${v.en ? `<div class="v-en ${state.showEn?'':'hide'}">${v.en.replaceAll('\n','<br>')}</div>` : ''}
          ${v.times ? `<div class="refrain-times">${v.times === 2 ? `Sing the whole ${v.refrain ? 'chorus' : 'verse'} twice · مَرَّتَيْنِ` : `Sing the whole ${v.refrain ? 'chorus' : 'verse'} ` + v.times + ' times'}</div>` : ''}
        </article>${v.repeatRefrain ? refrainRepeatHTML(q, n) : ''}`).join('')}`}
      ${pageView ? '' : chapterNav(kind, idx)}
    </main>
`;
}
function openQasida(i){
  applyTextScale();
  app.innerHTML = readerHTML(QASIDAS[i], 'renderIndex()', 'q', i);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('q', i);
}

function openBurdah(n){
  /* Reached either from the Mawlid Collections > Burdah tab, or from the
     synthetic "Qasida al-Burdah" card inside the Qasidas list — the back
     button should return wherever the chapter list itself was opened from. */
  const backTab = state.tab === 'qasidas-burdah' ? 'qasidas-burdah' : 'burdah';
  state.burdahChapter = n;
  applyTextScale();
  app.innerHTML = readerHTML(BURDAH_CHAPTERS[n], `selectTab('${backTab}')`, 'b', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('b', n);
}

function openNasheed(n){
  document.documentElement.style.setProperty('--ar-size', (1.9*state.arScale)+'rem');
  document.documentElement.style.setProperty('--latin-scale', state.latinScale);
  app.innerHTML = readerHTML(NASHEED_CHAPTERS[n], "selectTab('nasheeds')", 'n', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('n', n);
}

/* Academy-section readers. Same shape as openNasheed(): the shared
   readerHTML() does the work, and 'Back' returns to the section's tab. */
function openSilsila(n){
  document.documentElement.style.setProperty('--ar-size', (1.9*state.arScale)+'rem');
  document.documentElement.style.setProperty('--latin-scale', state.latinScale);
  app.innerHTML = readerHTML(SILSILA_CHAPTERS[n], "selectTab('silsila')", 'c', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('c', n);
}

function openTuruq(n){
  document.documentElement.style.setProperty('--ar-size', (1.9*state.arScale)+'rem');
  document.documentElement.style.setProperty('--latin-scale', state.latinScale);
  app.innerHTML = readerHTML(TURUQ_CHAPTERS[n], "selectTab('turuqs')", 't', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('t', n);
}

function openSohbet(n){
  document.documentElement.style.setProperty('--ar-size', (1.9*state.arScale)+'rem');
  document.documentElement.style.setProperty('--latin-scale', state.latinScale);
  const c = SOHBET_CHAPTERS[n];
  const back = c && c.shaykh ? "selectTab('sohbet-" + c.shaykh + "')" : "selectTab('sohbets')";
  app.innerHTML = readerHTML(c, back, 'h', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('h', n);
}

function openBiography(n){
  document.documentElement.style.setProperty('--ar-size', (1.9*state.arScale)+'rem');
  document.documentElement.style.setProperty('--latin-scale', state.latinScale);
  app.innerHTML = readerHTML(BIOGRAPHY_CHAPTERS[n], "selectTab('biographies')", 'g', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('g', n);
}

function openOttoman(n){
  document.documentElement.style.setProperty('--ar-size', (1.9*state.arScale)+'rem');
  document.documentElement.style.setProperty('--latin-scale', state.latinScale);
  app.innerHTML = readerHTML(OTTOMAN_CHAPTERS[n], "selectTab('ottoman')", 'o', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('o', n);
}

function openLitany(n){
  applyTextScale();
  app.innerHTML = readerHTML(LITANY_CHAPTERS[n], "selectTab('" + (isAzamDay(n) ? 'azam' : isIstighfarDay(n) ? 'istighfar' : 'litanies') + "')", 'l', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('l', n);
}

function openDiya(n){
  applyTextScale();
  app.innerHTML = readerHTML(DIYA_CHAPTERS[n], "selectTab('diya')", 'y', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('y', n);
}

function openBarzanji(n){
  applyTextScale();
  app.innerHTML = readerHTML(BARZANJI_CHAPTERS[n], "selectTab('barzanji')", 'z', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('z', n);
}

function openDalail(n){
  applyTextScale();
  document.documentElement.style.setProperty('--ms-zoom', state.msZoom);
  app.innerHTML = readerHTML(DALAIL_CHAPTERS[n], "selectTab('dalail')", 'd', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('d', n);
}


/* Book Version sizing — one page size for the whole chapter, text filling each
   page, at a size that is actually readable.

   The leaves of a printed chapter hold nearly the same amount of text (Monday's
   thirteen pages vary by under ten percent), which is what lets a calligrapher
   fill every page in a fixed frame. We do the same thing: measure every leaf,
   take the fullest one as the height of ALL leaves, then scale each leaf's
   Arabic to fill that shared frame. A page therefore stands taller than the
   screen and is read by scrolling — the alternative is squeezing a whole book
   page into a phone's height, which forces the text down to an unreadable size.
   The closing leaf of a chapter is left at its natural size, as in the book,
   where the last page runs short and gives way to the tailpiece. */
function msAutoFit(){
  const book = document.getElementById('ms-book');
  if(!book) return;
  const pages = Array.from(book.querySelectorAll('.ms-page'));
  if(!pages.length) return;

  /* Release every leaf to its natural height at the base size, so we can see
     how tall each printed page actually wants to be. */
  const leaves = [];
  pages.forEach(p => {
    const t = p.querySelector('.ms-text');
    if(!t) return;
    t.style.fontSize = '';
    /* Clear the CSS floor while measuring — full screen sets min-height:100dvh,
       which would otherwise mask how tall the page's text actually is. */
    p.style.minHeight = '0px';
    p.style.height = 'auto';
    leaves.push({ p, t, base: parseFloat(getComputedStyle(t).fontSize) || 24 });
  });
  if(!leaves.length) return;
  leaves.forEach(o => { o.nat = o.p.offsetHeight; });

  /* One height for the whole chapter, taken at a high percentile rather than
     the very tallest leaf: the few densest pages give up a little size (the
     spread across a chapter is under ten percent, so it doesn't show) and no
     page is left with a gap at its foot. The closing leaf is left out so a
     short final page can't shrink the rest. */
  const shortLeaf = o => o.p.classList.contains('ms-short');
  let pool = leaves.length > 1 ? leaves.slice(0, -1) : leaves;
  /* A deliberately short leaf must not drag the chapter's height down. */
  if(pool.some(o => !shortLeaf(o))) pool = pool.filter(o => !shortLeaf(o));
  const sorted = pool.map(o => o.nat).sort((a, b) => a - b);
  let H = sorted[Math.min(sorted.length - 1, Math.round((sorted.length - 1) * 0.8))];
  /* In full screen a leaf should at least fill the screen; in the normal reader
     it sits at book proportions. */
  const immersive = document.documentElement.classList.contains('immersive');
  /* Width of one leaf, which is half the scroller in a spread. */
  const leafW = (book.firstElementChild && book.firstElementChild.clientWidth) || book.clientWidth || 360;
  H = Math.max(H, immersive ? window.innerHeight - playerHeight()
                            : Math.min(window.innerHeight * 0.72, leafW * 1.5));

  leaves.forEach(o => {
    o.p.style.minHeight = '0px';   // the fitted height is the height
    o.p.style.height = H + 'px';
  });

  /* Fit one leaf's text to the shared height, never above the cap it is given. */
  const fit = (o, MAX) => {
    const MIN = o.base * 0.6;
    /* The space still free between the foot of the text and the foot of the
       page's content box, read from what the browser actually laid out. Working
       from the rendered geometry avoids having to add up padding, borders and
       band heights by hand — an error there is exactly what leaves a stubborn
       band of blank paper under every page. */
    const room = () => {
      const cs = getComputedStyle(o.p);
      const pr = o.p.getBoundingClientRect(), tr = o.t.getBoundingClientRect();
      return (pr.bottom - parseFloat(cs.paddingBottom) - parseFloat(cs.borderBottomWidth)) - tr.bottom;
    };
    /* Text height grows roughly with the square of the font size, so one
       square-root step lands close; the loops then settle it exactly. */
    const th = o.t.offsetHeight, r0 = room();
    let size = (th > 0) ? o.base * Math.sqrt((th + r0) / th) : o.base;
    size = Math.max(MIN, Math.min(MAX, size));
    o.t.style.fontSize = size + 'px';
    let guard = 0;
    while(room() < 0 && size > MIN && guard++ < 30){
      size = Math.max(MIN, size * 0.975);
      o.t.style.fontSize = size + 'px';
    }
    guard = 0;
    while(size < MAX && guard++ < 30){
      const next = Math.min(MAX, size * 1.02);
      o.t.style.fontSize = next + 'px';
      if(room() < 0){ o.t.style.fontSize = size + 'px'; break; }
      size = next;
    }
    return size;
  };

  /* A short leaf, and the closing leaf, must not balloon to fill the paper the
     book deliberately leaves empty. They used to be capped at o.base to stop
     that — but o.base is the CSS reading size, not the size the chapter is
     actually set at, and in full screen the other leaves grow with the taller
     page while these stayed put. That is what made Friday's last leaf render
     SMALLER than every other page when maximised, marooned in a field of blank
     paper. Cap them at what the full leaves settled on instead: still no
     ballooning, but never smaller than the rest of the chapter either. */
  const held = (o, i) => shortLeaf(o) || ((i === leaves.length - 1) && leaves.length > 1);
  const settled = [];
  leaves.forEach((o, i) => { if(!held(o, i)) settled.push(fit(o, o.base * 1.9)); });
  const typical = settled.length
    ? settled.slice().sort((a, b) => a - b)[Math.floor(settled.length / 2)]
    : null;
  leaves.forEach((o, i) => {
    if(held(o, i)) fit(o, typical == null ? o.base : Math.max(o.base, typical));
  });
}
/* Fit once the leaves are painted, and again once the Arabic webfont has
   actually loaded (metrics differ from the fallback, so the first pass would
   otherwise mis-size). */
function queueMsAutoFit(){
  if(!document.getElementById('ms-book')) return;
  const run = () => msAutoFit();
  if(window.requestAnimationFrame) requestAnimationFrame(() => requestAnimationFrame(run));
  else setTimeout(run, 30);
  if(document.fonts && document.fonts.ready){ document.fonts.ready.then(run).catch(() => {}); }
  /* fonts.ready can settle before a just-chosen face has even started to load. */
  if(AR_FONTS[arFont] && document.fonts && document.fonts.load){ document.fonts.load('1em ' + AR_FONTS[arFont]).then(run).catch(() => {}); }
}
/* Re-fit when the leaf frame changes size (rotation, window resize). */
let msFitTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(msFitTimer);
  msFitTimer = setTimeout(msAutoFit, 150);
});

function openSirah(n){
  applyTextScale();
  app.innerHTML = readerHTML(SIRAH_CHAPTERS[n], "selectTab('mawlid')", 's', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('s', n);
}

function openIlahi(n){
  applyTextScale();
  app.innerHTML = readerHTML(ILAHI_CHAPTERS[n], "selectTab('ilahis')", 'i', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('i', n);
}

function openQawwali(n){
  applyTextScale();
  app.innerHTML = readerHTML(QAWWALI_CHAPTERS[n], "selectTab('qawwalis')", 'w', n);
  queueMsAutoFit();
  window.scrollTo(0,0);
  onNavigated('w', n);
}

/* Re-render the current piece (control toggles, remote applies). Signals are
   suppressed so toggling translation never counts as navigating away. */
function reopen(kind, i){
  const fn = window[OPENERS[kind]];
  /* An unrecognised kind used to fall through to openQasida(), which silently
     teleported the reader into an unrelated piece. Staying put is the safe
     failure. */
  if(typeof fn !== 'function') return;
  const prev = suppressNavSignals;
  suppressNavSignals = true;
  try { fn(i); }
  finally { suppressNavSignals = prev; }
}
function toggle(kind,i){ state.showTr = !state.showTr; saveCols(); reopen(kind,i); }
/* Flips the class and the chip in place rather than reopening, so neither
   view loses its place; the Book leaves are re-fitted, since the IndoPak
   and Naskh letters set wider and taller than the Uthmani ones. */
function setArFont(v){
  if(AR_FONTS[v] === undefined) return;
  /* A tap is a choice even on the script already showing: it is stored, so
     a version's default no longer moves it. */
  arFontChosen = v;
  try { localStorage.setItem(FONT_KEY, v); } catch(e){}
  if(v === arFont) return;
  showArFont(v);
}
function showArFont(v){
  arFont = v;
  applyArFont();
  document.querySelectorAll('.script-switch button').forEach(b => {
    b.classList.toggle('on', b.dataset.font === arFont);
    b.setAttribute('aria-pressed', String(b.dataset.font === arFont));
  });
  queueMsAutoFit();
}
/* ── Repeating a refrain ─────────────────────────────────────
   A verse flagged `repeatRefrain` is followed by a marker for the chapter's
   `refrain` verse. Barzanji ch.4 is the case this was built for: the Qiyam
   refrain returns after every one of the seventeen qasida verses, and
   printing its four lines seventeen times would bury the qasida — so the
   marker is one gold line that opens to the words on a tap.

   **Every marker in the chapter opens together.** A reciter wants them one
   way or the other, not one at a time.

   Two deliberate choices:

   - **Toggling does NOT reopen the reader.** The body is always in the DOM
     and CSS hides it, so a tap flips a class and nothing re-renders. A
     `reopen()` here would scroll a reader who is fifteen verses down back to
     the top of the chapter — the same trap the text-size slider has.
   - **`state.refrainOpen` is in memory and is NOT stored**, on the owner's
     call: a chapter always opens collapsed. It still survives a re-render,
     which is what keeps a follower's own choice through a leader's
     navigation in a live session, exactly as `showTr`/`showEn` do. It is not
     broadcast either, so a leader never opens or closes anyone else's. */
/* A refrain's closing repeat count (Balagha-l-ʿUlā's " (2)", Ṭālamā's line of
   its own) is for its first singing only, owner's call — the repeats print
   without it. Counts inside the refrain, on each of its parts, stay. */
/* The refrain repeated is the nearest one above the verse: a piece with a
   second refrain partway through (Marḥaban Marḥaban) switches to it. */
function refrainRepeatHTML(q, n){
  let at = -1;
  for(let k = n; k >= 0; k--) if(q.verses[k].refrain){ at = k; break; }
  if(at < 0) return '';
  const r = q.verses[at];
  /* A refrain can run over more than one card: the cards straight after it
     flagged `refrainCont` are sung with it and repeat with it (Ṭalaʿa-l-Badru,
     QASIDAS[8]: its two opening lines). They stay separate cards so no verse
     is renumbered. */
  const parts = [r];
  for(let k = at + 1; k < q.verses.length && q.verses[k].refrainCont; k++) parts.push(q.verses[k]);
  /* Repeats keep every count in the refrain, closing (2) included (#25, the
     user's call); until v436 the closing count was stripped from repeats. */
  const body = parts.map(p => {
    const ar = p.ar, tr = p.tr, en = p.en;
    return `<div class="v-ar">${arHTML(ar)}</div>
        ${tr ? `<div class="v-tr ${state.showTr?'':'hide'}">${tr.replaceAll('\n','<br>')}</div>` : ''}
        ${en ? `<div class="v-en ${state.showEn?'':'hide'}">${en.replaceAll('\n','<br>')}</div>` : ''}`;
  }).join('');
  return `<div class="refrain-repeat${state.refrainOpen ? ' open' : ''}">
      <button class="refrain-repeat-btn" onclick="toggleRefrain()"
        aria-expanded="${state.refrainOpen ? 'true' : 'false'}">↻ Repeat chorus · يُرَدَّد</button>
      <div class="refrain-repeat-body">
        ${body}
      </div>
    </div>`;
}

function toggleRefrain(){
  state.refrainOpen = !state.refrainOpen;
  document.querySelectorAll('.refrain-repeat').forEach(n => {
    n.classList.toggle('open', state.refrainOpen);
    const b = n.querySelector('.refrain-repeat-btn');
    if(b) b.setAttribute('aria-expanded', state.refrainOpen ? 'true' : 'false');
  });
}
/* The piece set as it was printed: ivory leaves, ruled borders, a titled
   cartouche and the rosettes between phrases — but real text, so it can be
   selected, searched and marked, and costs nothing to download. */
/* Ornament for the manuscript leaves — drawn, not photographed, so it takes
   the theme colours and stays sharp at any size. */
const MS_DEFS = `<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs><pattern id="msGul" width="44" height="40" patternUnits="userSpaceOnUse"><rect width="44" height="40" fill="var(--ms-band-a)"/><path d="M0,20 H44" stroke="var(--ms-gold)" stroke-width="1"/><path d="M22,7.5C25.4,13.25 25.4,16 22,20C18.6,16 18.6,13.25 22,7.5Z" transform="rotate(0 22 20)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width=".7"/><path d="M22,7.5C25.4,13.25 25.4,16 22,20C18.6,16 18.6,13.25 22,7.5Z" transform="rotate(45 22 20)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width=".7"/><path d="M22,7.5C25.4,13.25 25.4,16 22,20C18.6,16 18.6,13.25 22,7.5Z" transform="rotate(90 22 20)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width=".7"/><path d="M22,7.5C25.4,13.25 25.4,16 22,20C18.6,16 18.6,13.25 22,7.5Z" transform="rotate(135 22 20)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width=".7"/><path d="M22,7.5C25.4,13.25 25.4,16 22,20C18.6,16 18.6,13.25 22,7.5Z" transform="rotate(180 22 20)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width=".7"/><path d="M22,7.5C25.4,13.25 25.4,16 22,20C18.6,16 18.6,13.25 22,7.5Z" transform="rotate(225 22 20)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width=".7"/><path d="M22,7.5C25.4,13.25 25.4,16 22,20C18.6,16 18.6,13.25 22,7.5Z" transform="rotate(270 22 20)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width=".7"/><path d="M22,7.5C25.4,13.25 25.4,16 22,20C18.6,16 18.6,13.25 22,7.5Z" transform="rotate(315 22 20)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width=".7"/><circle cx="22" cy="20" r="3" fill="var(--ms-paper)" stroke="var(--ms-gold)" stroke-width=".8"/><circle cx="0" cy="20" r="2.2" fill="var(--ms-gold)"/><circle cx="44" cy="20" r="2.2" fill="var(--ms-gold)"/></pattern></defs></svg>`;
const MS_BAND = `<svg class="ms-band-art" aria-hidden="true"><rect width="100%" height="40" fill="url(#msGul)"/><rect width="100%" height="1.4" fill="var(--ms-gold)"/><rect y="38.6" width="100%" height="1.4" fill="var(--ms-gold)"/></svg>`;
const MS_CORNER = `<svg class="ms-corner" viewBox="0 0 100 100" aria-hidden="true"><path d="M8,8 H64 M8,8 V64" fill="none" stroke="var(--ms-gold)" stroke-width="2" stroke-linecap="round"/><path d="M15,15 H48 M15,15 V48" fill="none" stroke="var(--ms-rule)" stroke-width="1" stroke-linecap="round"/><path d="M30,9C36.2,18.66 36.2,23.28 30,30C23.8,23.28 23.8,18.66 30,9Z" transform="rotate(0 30 30)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width="1"/><path d="M30,9C36.2,18.66 36.2,23.28 30,30C23.8,23.28 23.8,18.66 30,9Z" transform="rotate(45 30 30)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width="1"/><path d="M30,9C36.2,18.66 36.2,23.28 30,30C23.8,23.28 23.8,18.66 30,9Z" transform="rotate(90 30 30)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width="1"/><path d="M30,9C36.2,18.66 36.2,23.28 30,30C23.8,23.28 23.8,18.66 30,9Z" transform="rotate(135 30 30)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width="1"/><path d="M30,9C36.2,18.66 36.2,23.28 30,30C23.8,23.28 23.8,18.66 30,9Z" transform="rotate(180 30 30)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width="1"/><path d="M30,9C36.2,18.66 36.2,23.28 30,30C23.8,23.28 23.8,18.66 30,9Z" transform="rotate(225 30 30)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width="1"/><path d="M30,9C36.2,18.66 36.2,23.28 30,30C23.8,23.28 23.8,18.66 30,9Z" transform="rotate(270 30 30)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width="1"/><path d="M30,9C36.2,18.66 36.2,23.28 30,30C23.8,23.28 23.8,18.66 30,9Z" transform="rotate(315 30 30)" fill="var(--ms-band-b)" stroke="var(--ms-gold)" stroke-width="1"/><circle cx="30" cy="30" r="5.4" fill="var(--ms-paper)" stroke="var(--ms-gold)" stroke-width="1.1"/><circle cx="30" cy="30" r="2.2" fill="var(--ms-rosette)"/></svg>`;

/* The basmala opens a piece; it stands on its own line above the text rather
   than running into it. Harakat and spacing are stripped before matching, so
   it's recognised however a given printing vowels it. */
function isBasmala(ar){
  const bare = String(ar || '')
    .replace(/\u0671/g, '\u0627')                       // alif wasla -> plain alif
    .replace(/[\u064B-\u0655\u0670\u06D6-\u06ED\s]/g, ''); // vowels and Quranic marks
  /* Must BE the basmala, not merely begin with it — otherwise a sūrah that
     opens with it would be mistaken for a bare basmala and swallowed whole. */
  return bare === 'بسماللهالرحمنالرحيم';
}

/* A passage may open with the basmala — sometimes after the taʿawwudh. Lift it
   onto its own line so it heads what follows rather than running into it. */
function splitBasmala(ar){
  const parts = String(ar || '').split('۞').map(s => s.trim()).filter(Boolean);
  const i = parts.findIndex(isBasmala);
  if(i === -1) return null;
  return {
    pre:     parts.slice(0, i).join(' ۞ '),
    basmala: parts[i],
    rest:    parts.slice(i + 1).join(' ۞ '),
  };
}

function manuscriptPages(q, kind, idx){
  const marks = loadMarks();
  const place = loadPlace();
  const placedN = (place && place.view === 'book' && place.idx === idx && place.verse != null) ? place.verse : null;
  const placedSeg = (placedN != null && place && place.seg != null) ? place.seg : null;

  const phrase = (v, n, sub) => {
    /* Split chunks of one verse get a unique key (n.sub) so marking or the
       stored-mark highlight applies to just that chunk, not every page the
       verse spills onto. Whole verses keep the plain key. */
    const k = markKey(kind, idx, sub == null ? n : n + '.' + sub);
    /* The manuscript sets no commas, so the Book Version drops them — except in
       the Dalāʾil, where the user asked for them back: those chapters run as
       long unbroken litanies and the commas are what make them followable.
       Taken straight from the Study Arabic, which is the same `ar` string. */
    const arDisplay = (kind === 'd' || kind === 'l')
      ? String(v.ar)
      : String(v.ar).replace(/\s*،\s*/g, ' ');
    const sp = splitBasmala(arDisplay);
    let inner = (sp && (sp.pre || sp.rest))
      ? `${sp.pre ? sp.pre + '<br>' : ''}${sp.basmala}<br>${sp.rest}`
      : arDisplay;
    if(v.instruction){
      inner = `<span class="ms-instruction">${inner}</span>`;
    }
    inner = inner.replaceAll('\n', '<br>');
    if(kind === 'd' && !v.instruction){ inner = segWrapMark(inner, 'ms-r ms-r-in', kind, idx, (sub == null ? n : n + '.' + sub), marks, (placedN != null && Number(n) === placedN && (sub == null || sub === 0)), placedSeg); }
    else { inner = inner.replaceAll('۞', '<span class="ms-r ms-r-in">۞</span>'); }
    /* Directions embedded in the passage go gold, and the ones that carry an
       explanation become tappable — the leaf sets no English of its own. */
    inner = markInline(inner, true);
    /* A rubric is not a passage anyone wants to highlight, so its tap is given
       over to showing the English — the leaf itself carries only Arabic. */
    if(v.instruction){
      return `<span class="ms-v has-instr" data-mk="${k}" data-en="${attrEsc(v.en || '')}"
                  onclick="showInstrBubble(event, this)">${inner}</span>`;
    }
    if(kind === 'd'){ return `<span class="ms-v" data-mk="${k}">${inner}</span>`; }
    const placed = (placedN != null && Number(n) === placedN && (sub == null || sub === 0)) ? ' placed' : '';
    return `<span class="ms-v${marks[k] ? ' marked' : ''}${placed}" data-mk="${k}"
                  onclick="markVerse('${kind}',${idx},'${sub == null ? n : n + '.' + sub}')">${inner}</span>`;
  };

  /* ── One app leaf per printed page — a straight digitisation ──────────
     The chapter text carries a ‖ marker at each spot the printed book turns
     the page (taken from the PDF). We cut the leaves there and nowhere else,
     so every leaf holds exactly what the book page holds — a sentence may run
     on to the next page, just as it does in the book. Chunks of a split verse
     get a sub-index so marking one page-chunk doesn't light up the others. */
  const PAGE_BREAK = '‖';

  const rawFolios = q.folios.map(f => ({
    band: f.band || null,
    items: q.verses.slice(f.from, f.to + 1).map((v, j) => ({ v, n: f.from + j })),
  }));

  const expandedFolios = [];
  rawFolios.forEach(f => {
    let items = [];
    let band = f.band;
    let shortNext = false;
    const flush = () => { if(items.length){ expandedFolios.push({ band, items, short: shortNext }); band = null; items = []; shortNext = false; } };
    f.items.forEach(({ v, n }) => {
      if(v.omit) return;
      /* A leaf the book itself leaves part-empty (a section opening on the next
         page) is marked so msAutoFit sets it at the base size and lets it stop
         short, instead of growing the type to fill the sheet. */
      if(v.shortPage){ shortNext = true; }
      if(isBasmala(v.ar)){ items.push({ v, n, isBasmala: true, sub: null, bandBefore: v.band || null }); return; }
      if(v.ar.indexOf(PAGE_BREAK) === -1){ items.push({ v, n, isBasmala: false, sub: null, bandBefore: v.band || null }); return; }
      /* Keep empty segments' positions: a ‖ at the very end of a verse means the
         page turns right after this verse, so we must still flush there. */
      const raw = v.ar.split(PAGE_BREAK);
      const chunks = raw.map(s => s.trim());
      const nonEmpty = chunks.filter(Boolean);
      const multi = nonEmpty.length > 1;
      /* The verse's rosette marks its END, so only the final non-empty chunk
         carries it. A chunk that leaves the reader mid-verse (the page turns
         and the verse carries on) gets no rosette — matching the book, which
         sets no mark where a sentence simply runs to the next page. */
      let lastNE = -1;
      chunks.forEach((c, ci) => { if(c) lastNE = ci; });
      let subIdx = 0;
      chunks.forEach((chunk, ci) => {
        if(chunk){
          items.push({ v: { ...v, ar: chunk }, n, isBasmala: false, sub: multi ? subIdx++ : null, cont: ci < lastNE, bandBefore: (ci === 0 && v.band) ? v.band : null });
        }
        /* A break marker sits between chunk ci and ci+1 (including when a chunk
           is empty, e.g. a trailing ‖). Turn the page for every marker. */
        if(ci < chunks.length - 1) flush();
      });
    });
    flush();
  });

  const last = expandedFolios.length - 1;

  const sheet = (f, i) => {
    let items = f.items;
    let head = '';
    if(items.length && items[0].isBasmala) {
      const first = items[0];
      head = `<div class="ms-basmala">${phrase(first.v, first.n, first.sub)}</div>`;
      items = items.slice(1);
    }
    /* A divider band can fall in the middle of a printed page (the thulth and
       rubʿ marks do), so it is drawn inline before the verse it introduces
       rather than only at the head of a leaf. */
    const body = items.map(({ v, n, sub, cont, bandBefore }) => {
      const mark = bandBefore
        ? `<span class="ms-band ms-band-div ms-band-inline">${MS_BAND}<span class="ms-cartouche ms-cartouche-div">${bandBefore}</span></span>`
        : '';
      return mark + ((cont || v.noRosette)
        ? phrase(v, n, sub)
        : `${phrase(v, n, sub)}<span class="ms-r${v.sep ? ' salawat' : ''}">${v.sep || '۞'}</span>`);
    }).join(' ');
    const closing = i === last;
    return `<div class="ms-sheet">
      <div class="ms-runhead">${q.cartouche || q.titleArabic}</div>
      <div class="ms-page${closing ? ' ms-closing' : ''}${f.short ? ' ms-short' : ''}">
        ${i === 0 ? `<div class="ms-band">${MS_BAND}<span class="ms-cartouche">${q.cartouche || q.titleArabic}</span></div>` : ''}
        ${f.band ? `<div class="ms-band ms-band-div">${MS_BAND}<span class="ms-cartouche ms-cartouche-div">${f.band}</span></div>` : ''}
        ${closing ? `<div class="ms-orn tl">${MS_CORNER}</div><div class="ms-orn tr">${MS_CORNER}</div>
                     <div class="ms-orn bl">${MS_CORNER}</div><div class="ms-orn br">${MS_CORNER}</div>` : ''}
        <div class="ms-text">${head}${body}</div>
        <div class="ms-folio">${i + 1}</div>
      </div>
    </div>`;
  };

  /* One dot per spread when two leaves show at once, and it goes to the leaf
     that opens the spread. */
  const two = spreadOn();
  const dots = expandedFolios.map((f, i) => (two && i % 2) ? '' :
    `<button class="ms-dot${i === 0 ? ' on' : ''}" data-pg="${i}" onclick="msGoTo(${i})"
             aria-label="${two ? 'Pages ' + (i + 1) + '\u2013' + (i + 2) : 'Page ' + (i + 1)}"></button>`).join('');
  return `${readerActions(q, kind, idx, true)}
    <p class="ms-hint">Turn the leaf right to left · tap a phrase to mark your place</p>
    ${MS_DEFS}
    <div class="ms-book${two ? ' spread' : ''}" id="ms-book" onscroll="msSyncDots()">${expandedFolios.map(sheet).join('')}</div>
    <div class="ms-nav">
      <button class="ms-arrow next" onclick="msStep(1)" aria-label="Next page">‹</button>
      <div class="ms-dots">${dots}</div>
      <button class="ms-arrow prev" onclick="msStep(-1)" disabled aria-label="Previous page">›</button>
    </div>
    ${msChapNav(kind, idx)}
    <div class="ms-bar">
      <button class="ms-rnd" onclick="goHome()" aria-label="Home">⌂</button>
      <div class="ms-menu-wrap">
        <button class="ms-rnd" onclick="toggleMsMenu(event)" aria-label="More">⋮</button>
        <div class="ms-menu" id="ms-menu"></div>
      </div>
    </div>
    <div class="ms-float" id="ms-float">
      <button class="ms-arrow next" onclick="msStep(1)" aria-label="Next page">‹</button>
      <button class="ms-arrow prev" onclick="msStep(-1)" disabled aria-label="Previous page">›</button>
    </div>`;
}

/* Which leaf is showing. Worked out from where each sheet actually sits rather
   than from scrollLeft, whose sign differs between browsers in a right-to-left
   container. */
function msCurrentPage(){
  const book = document.getElementById('ms-book');
  if(!book) return 0;
  const mid = book.getBoundingClientRect().left + book.clientWidth / 2;
  let best = 0, bestD = Infinity;
  [].forEach.call(book.children, (s, i) => {
    const r = s.getBoundingClientRect();
    const d = Math.abs(r.left + r.width / 2 - mid);
    if(d < bestD){ bestD = d; best = i; }
  });
  return best;
}

let msLastPage = 0;
function msSyncDots(){
  const book = document.getElementById('ms-book');
  const n = book ? book.children.length : 0;
  const cur = msCurrentPage();
  [].forEach.call(document.querySelectorAll('.ms-dot'), (d, i) => d.classList.toggle('on', i === cur));
  /* Offered from the first leaf only. Toggled here, not in the page-change
     branch below: that one is skipped when the leaf has not changed, which
     would leave the button wrong on the first paint after opening a piece. */
  const tune = document.getElementById('ms-tune');
  if(tune) tune.classList.toggle('off', cur !== 0);
  msFloatPosition();
  /* Two sets now — the floating pair and the pair by the dots — so keep them
     in step rather than only the first one found. */
  const onLast = cur >= n - 1, carriesOn = onLast && !!nextPiece();
  [].forEach.call(document.querySelectorAll('.ms-arrow.next'), b => {
    b.disabled = onLast && !carriesOn;
    b.title = carriesOn ? 'Next section' : 'Next page';
    b.setAttribute('aria-label', b.title);
  });
  [].forEach.call(document.querySelectorAll('.ms-arrow.prev'), b => b.disabled = cur <= 0);
  /* When a swipe lands on a different leaf, return to the top of that leaf so
     a tall page never opens scrolled halfway down. */
  if(cur !== msLastPage){
    msLastPage = cur;
    /* The place chip reads "here" per leaf now, so it has to be told a page
       turn happened — nothing else calls it on a swipe. */
    if(typeof refreshPlaceBtn === 'function') refreshPlaceBtn();
    if(!suppressNavSignals && session.role === 'leader' && session.channel && session.lastNav){
      try { session.channel.send({ type:'broadcast', event:'page', payload:{ kind: session.lastNav.kind, idx: session.lastNav.idx, page: cur, term: session.term } }); } catch(e){}
    }
    if(book){
      const top = book.getBoundingClientRect().top + window.scrollY - 8;
      if(window.scrollY > top + 4) window.scrollTo({ top: Math.max(0, top), behavior:'smooth' });
    }
  }
}
/* Pinch-zoom moves the visible area without moving the layout viewport, so a
   plain fixed position drifts off screen exactly when the arrows are needed
   most. Track the visual viewport instead, and hold the buttons at a constant
   size so they stay thumb-sized however far the text is magnified. */
function msFloatPosition(){
  const f = document.getElementById('ms-float');
  if(!f) return;
  const vv = window.visualViewport;
  if(!vv) return;                      // older browser: the CSS default is right
  f.style.top   = (vv.offsetTop + (vv.height - playerHeight()) / 2) + 'px';
  f.style.left  = vv.offsetLeft + 'px';
  f.style.width = vv.width + 'px';
  f.style.right = 'auto';
  const s = 1 / (vv.scale || 1);
  [].forEach.call(f.querySelectorAll('.ms-arrow'), b => { b.style.transform = 'scale(' + s + ')'; });
}

if(window.visualViewport){
  window.visualViewport.addEventListener('resize', msFloatPosition);
  window.visualViewport.addEventListener('scroll', msFloatPosition);
}
window.addEventListener('scroll', msFloatPosition, { passive:true });

/* ── The docked reciter ─────────────────────────────────────────────
   Lives on <body>, so it survives every re-render of #app: the recitation
   keeps playing while you turn leaves, and while you go on into the next
   section. Everything that needs to make room for it reads --player-h. */
let ytPlayer = null;

/* Playback speed. YouTube's embedded player accepts ONLY these steps; a value
   in between is rounded DOWN TOWARDS 1, so asking for 1.15 plays at 1 while
   looking as though it worked. The finer slider in YouTube's own interface is
   not exposed to embeds. Rather than choose for the reader, the dock carries a
   speed button and remembers what they pick. */
const RATES = [0.75, 1, 1.25, 1.5, 1.75];
const RATE_KEY = 'mawlid-play-rate';

function storedRate(){
  try{
    const v = parseFloat(localStorage.getItem(RATE_KEY));
    return RATES.indexOf(v) === -1 ? 1 : v;
  }catch(e){ return 1; }
}

function rateLabel(r){ return (r === 1 ? '1' : String(r)) + '×'; }

/* The rate can only be set through the player API, so the command is posted to
   the iframe. On first load it goes three times, because the player isn't
   necessarily ready the moment the frame is; later changes go once. */
function sendRate(rate){
  const frame = document.querySelector('#ytdock iframe');
  if(!frame) return;
  try{
    frame.contentWindow.postMessage(JSON.stringify({
      event: 'command', func: 'setPlaybackRate', args: [rate]
    }), 'https://www.youtube-nocookie.com');
  }catch(e){}
}

function applyPlaybackRate(frame, rate){
  if(!frame) return;
  frame.addEventListener('load', () => {
    sendRate(rate); setTimeout(() => sendRate(rate), 600); setTimeout(() => sendRate(rate), 1800);
  });
}

/* Steps through the rates the player actually supports, and keeps the choice
   for next time. */
function cycleRate(){
  if(!ytPlayer) return;
  if(ytPlayer.audio){ cycleARate(); return; }   /* the audio dock has its own finer set */
  const i = RATES.indexOf(ytPlayer.rate);
  ytPlayer.rate = RATES[(i + 1) % RATES.length];
  try{ localStorage.setItem(RATE_KEY, String(ytPlayer.rate)); }catch(e){}
  const b = document.getElementById('ytdock-rate');
  if(b) b.textContent = rateLabel(ytPlayer.rate);
  sendRate(ytPlayer.rate);
}

function ytId(url){
  const m = String(url || '').match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
/* ── Local recitations ───────────────────────────────────────────────────
   The Dalāʾil recordings are hosted in a second GitHub Pages repo. Same
   origin as this app (origin is scheme+host; the path is irrelevant), which
   is what makes fetch, progress and the Cache API work at all — release
   assets on github.com send no CORS header and are blocked outright.

   Kept out of the service worker's CORE list on purpose: precaching 150MB on
   first visit would be indefensible on a phone. A portion is fetched only
   when someone asks for it, into a cache the worker is told to spare. */
const AUDIO_BASE = 'https://zboon.github.io/mawlid-audio/';
const AUDIO_CACHE = 'mawlid-audio';

const RECITERS = {
  khayzaran: { ar: 'الشيخ حكيم خيزران',  en: 'Ḥakīm Khayzarān' },
  shamali:   { ar: 'الشيخ حازم الشمالي', en: 'Ḥāzim ash-Shamālī' },
  /* A group, not a shaykh, and spelled the way they spell it themselves
     rather than put through the app's transliteration. */
  aashiq:    { ar: 'عاشق الرسول',        en: 'Aashiq al-Rasul' },
  /* Named from the file itself ("… by Syrian Munshids …"): it carries no
     artist tag, only its encoder, so there is no fuller credit to give. */
  syrian:    { ar: 'منشدون سوريون',       en: 'Syrian Munshids' },
  /* Named from the file's own title tag; no Arabic form of the ensemble's
     name is on record, so none is given — every caller skips an empty one. */
  rabbani:   { ar: '',                    en: 'Rabbani Ensemble' },
};

/* Recordings hang off the chapter, not the collection: these seven portions
   are Khayzarān's and Monday Part 2 is ash-Shamālī's, so one reciter per
   collection would already be wrong. A list, so a second reciter for the
   same portion is an append rather than a restructure.

   `secs` is measured from the files and is what the button shows before any
   download starts. Byte sizes are deliberately NOT stored — the copies on
   the server carry an extra metadata atom, so any figure recorded here would
   drift from what actually arrives. content-length is read at fetch time. */
const DALAIL_AUDIO = {
  6:  [{ reciter:'khayzaran', file:'dalail-01-monday-1.mp4',  secs:1577 }],
  7:  [{ reciter:'khayzaran', file:'dalail-02-tuesday.mp4',   secs:1348 }],
  8:  [{ reciter:'khayzaran', file:'dalail-03-wednesday.mp4', secs:1291 }],
  9:  [{ reciter:'khayzaran', file:'dalail-04-thursday.mp4',  secs:1331 }],
  10: [{ reciter:'khayzaran', file:'dalail-05-friday.mp4',    secs:1239 }],
  11: [{ reciter:'khayzaran', file:'dalail-06-saturday.mp4',  secs:1240 }],
  12: [{ reciter:'khayzaran', file:'dalail-07-sunday.mp4',    secs:1242 }],
  13: [{ reciter:'shamali',   file:'dalail-08-monday-2.mp4',  secs:553  }],
};

/* The first recording outside the Dalāʾil, which is why the lookup below is
   keyed by kind rather than reading one map. `secs` measured from the file. */
const QASIDA_AUDIO = {
  3: [{ reciter:'aashiq', file:'Ya Rabbi Salli Ala Muhammad.mp3', secs:240 }],
  /* Carries a video track too (the subtitled "with English translation"
     video). The player is an <audio> element, which plays the sound and
     ignores the picture, so it works as-is at 3.5 MB. */
  41: [{ reciter:'syrian', file:'Balaghal Ula Bi Kamalihi by Syrian Munshids with English translation.mp4', secs:273 }],
  /* No reciter, on the owner's instruction: leave it uncredited (the file's
     only artist tag, "Roy Clark", is not to be used). `title` is what the
     player calls it, in place of the qasida's full title. */
  4: [{ file:'Caravan Qasida.mp3', secs:309, title:"The Caravaner's Qasida" }],
  /* The qasida itself begins at 1:33 (owner's timing); `start` is where the
     player opens. No reciter: the file carries no artist tag. */
  9: [{ file:'Talama Ashku Gharami.mp3', secs:517, start:93 }],
  /* No artist tag, so no reciter. The name carries an apostrophe and an
     ampersand: audioUrl encodes them, and the Downloads row JSON-quotes it. */
  12: [{ file:"Ya Rasulallah Salamun 'Alaik   Lirik & Terjemahan.mp3", secs:277 }],
  11: [{ reciter:'rabbani', file:'Rabbani Ensemble - Ya Arhamar Rahimin.mp3', secs:214 }],
  /* The file name carries Arabic (with a Persian yeh, U+06CC), written as
     escapes copied from the audio repo so no retyped letter can miss the
     file. No artist tag, so no reciter. */
  13: [{ file:"Qul Ya Azeem Arabic Nasheed \u0642\u064f\u0644\u0652 \u06cc\u064e\u0627 \u0639\u0638\u06cc\u0645 English Subtitles.mp3", secs:309 }],
  /* An-Nabī Ṣallū ʿAlayh ("24 ·"). The title tag names the piece; there is
     no artist tag, so no reciter. */
  15: [{ file:'An Nabi Sollu Alaih.mp3', secs:291 }],
  /* Yā Imāma-r-Rusli ("26 ·"). No artist tag; the reciters are named from the
     file's own title, as Balagha-l-ʿUlā's are. */
  16: [{ reciter:'syrian', file:'Ya Imam Ar Rusli By Syrian Munshids.mp3', secs:414 }],
};

const AUDIO_BY_KIND = { d: DALAIL_AUDIO, q: QASIDA_AUDIO };

const RECITER_KEY = 'mawlid-reciter';

function storedReciter(){
  try{ return localStorage.getItem(RECITER_KEY) || null; }catch(e){ return null; }
}

/* The recordings available for a piece, preferred reciter first. */
function audioFor(kind, idx){
  const list = (AUDIO_BY_KIND[kind] || {})[idx];
  if(!list || !list.length) return [];
  const want = storedReciter();
  if(!want) return list.slice();
  return list.slice().sort((a, b) => (b.reciter === want) - (a.reciter === want));
}

/* Encoded here and nowhere else: this is the only place a URL is built, and
   the fetch and the Cache API key have to be the same string. One file name
   carries spaces, so a bare concatenation would not survive a round trip. */
function audioUrl(rec){
  return AUDIO_BASE + rec.file.split('/').map(encodeURIComponent).join('/');
}

function reciterName(rec){
  const r = RECITERS[rec && rec.reciter];
  return r ? r.en : '';
}
function reciterNameAr(rec){
  const r = RECITERS[rec && rec.reciter];
  return r ? r.ar : '';
}

function fmtDur(s){
  s = Math.round(s || 0);
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}
function fmtMB(b){ return (b / 1048576).toFixed(1) + ' MB'; }
/* ── storage ─────────────────────────────────────────────────────────── */

async function audioCached(rec){
  try{
    const c = await caches.open(AUDIO_CACHE);
    const r = await c.match(audioUrl(rec));
    return r ? r : null;
  }catch(e){ return null; }
}

async function audioCachedSize(rec){
  const r = await audioCached(rec);
  if(!r) return 0;
  try{ return (await r.clone().blob()).size; }catch(e){ return 0; }
}

/* Streamed so the bar moves against real bytes rather than a spinner. Note
   content-length is the ENCODED length; on a plain response it matches the
   decoded stream, but the total is treated as a hint and the bar is clamped,
   because a server that compresses would otherwise push it past 100%. */
async function downloadAudio(rec, onProgress){
  const url = audioUrl(rec);
  const resp = await fetch(url);
  if(!resp.ok) throw new Error('HTTP ' + resp.status);
  const total = Number(resp.headers.get('content-length')) || 0;
  if(!resp.body){                      /* no streaming: fall back to one gulp */
    const blob = await resp.blob();
    const c = await caches.open(AUDIO_CACHE);
    await c.put(url, new Response(blob, { headers:{ 'Content-Type':'video/mp4' } }));
    if(onProgress) onProgress(blob.size, blob.size);
    return blob.size;
  }
  const reader = resp.body.getReader();
  const chunks = []; let got = 0;
  for(;;){
    const { done, value } = await reader.read();
    if(done) break;
    chunks.push(value); got += value.length;
    if(onProgress) onProgress(got, total);
  }
  const blob = new Blob(chunks, { type:'video/mp4' });
  const c = await caches.open(AUDIO_CACHE);
  await c.put(url, new Response(blob, { headers:{ 'Content-Type':'video/mp4' } }));
  return blob.size;
}

async function removeAudio(rec){
  try{
    const c = await caches.open(AUDIO_CACHE);
    await c.delete(audioUrl(rec));
  }catch(e){}
}
/* ── Downloaded recitations: the manage screen ───────────────────────────
   An app that can quietly put 150MB on someone's phone owes them a plain
   view of what is stored and a way to remove it. Sizes are read back from
   the cache itself rather than from any figure recorded in the data — the
   copies on the server carry an extra metadata atom, so a stored number
   would drift from what actually arrived. */

/* Every portion that has a recording, flattened for the manage list. */
function allAudioEntries(){
  const out = [];
  Object.keys(AUDIO_BY_KIND).forEach(kind => {
    const m = AUDIO_BY_KIND[kind];
    Object.keys(m).forEach(k => {
      const idx = Number(k);
      (m[k] || []).forEach(rec => out.push({ kind, idx, rec }));
    });
  });
  return out.sort((a, b) => a.kind === b.kind
    ? a.idx - b.idx
    : (a.kind < b.kind ? -1 : 1));
}

async function audioLedger(){
  const rows = [];
  let have = 0, total = 0;
  for(const e of allAudioEntries()){
    const size = await audioCachedSize(e.rec);
    if(size){ have++; total += size; }
    rows.push({ e, size });
  }
  return { rows, have, total };
}

function downloadsScreen(){
  /* Painted empty, then filled in — the sizes come from an async cache read
     and the browse dispatch is synchronous. */
  setTimeout(refreshDownloads, 0);
  return backToDalail() +
    label('Downloaded recitations · التّسجيلات الْمحفوظة') +
    '<div id="dl-list"><div class="no-results">Reading what\'s stored…</div></div>';
}

async function refreshDownloads(){
  const host = document.getElementById('dl-list');
  if(!host) return;
  const { rows, have, total } = await audioLedger();

  let html = '<div class="dl-sum">' +
    (have
      ? '<strong>' + have + ' of ' + rows.length + '</strong> saved on this device · ' + fmtMB(total)
      : 'Nothing saved yet. Download a portion to hear it with no connection.') +
    (have ? ' <button class="session-btn quiet" onclick="removeAllAudio()">Remove all</button>' : '') +
    '</div>';

  rows.forEach(({ e, size }) => {
    const q = (arrayOf(e.kind) || [])[e.idx] || {};
    const who = reciterName(e.rec), whoAr = reciterNameAr(e.rec);
    const id = 'dlrow-' + e.rec.file.replace(/[^a-z0-9]/gi, '');
    html +=
      '<div class="dl-row" id="' + id + '">' +
        '<div class="dl-meta">' +
          '<div class="dl-title">' + attrEsc(e.rec.title || q.titleEnglish || '') + '</div>' +
          '<div class="dl-sub">' +
            (who ? attrEsc(who) + (whoAr ? ' <span class="r-ar">' + attrEsc(whoAr) + '</span>' : '') + ' · ' : '') +
            fmtDur(e.rec.secs) + '</div>' +
        '</div>' +
        '<button class="session-btn quiet dl-act" ' +
          'onclick="rowAction(' + attrEsc(JSON.stringify(e.rec.file)) + ')">' +
          (size ? 'Remove · ' + fmtMB(size) : 'Download') +
        '</button>' +
      '</div>';
  });
  host.innerHTML = html;
}

function recByFile(file){
  const e = allAudioEntries().filter(x => x.rec.file === file)[0];
  return e ? e.rec : null;
}

async function rowAction(file){
  const rec = recByFile(file);
  if(!rec) return;
  const id = 'dlrow-' + file.replace(/[^a-z0-9]/gi, '');
  const btn = document.querySelector('#' + id + ' .dl-act');
  if(!btn || btn.dataset.busy) return;

  if(await audioCached(rec)){
    await removeAudio(rec);
    refreshDownloads();
    audioDockState();
    return;
  }
  btn.dataset.busy = '1';
  btn.textContent = 'Starting…';
  try{
    await downloadAudio(rec, (got, tot) => {
      btn.textContent = tot ? Math.min(100, Math.round(got * 100 / tot)) + '%' : fmtMB(got);
    });
    btn.dataset.busy = '';
    refreshDownloads();
    audioDockState();
  }catch(err){
    btn.dataset.busy = '';
    btn.textContent = 'Failed — retry';
  }
}

async function removeAllAudio(){
  if(!confirm('Remove every downloaded recitation from this device?')) return;
  for(const e of allAudioEntries()) await removeAudio(e.rec);
  refreshDownloads();
  audioDockState();
}
/* ── the audio dock ──────────────────────────────────────────────────── */

/* A real <audio> element rather than the YouTube frame, which buys three
   things the embed could not give: it plays with the screen off, it takes
   any playback rate (the embed's list is fixed at quarter steps and rounds
   anything else down to 1), and it works with no connection once downloaded. */
const A_RATES = [0.75, 0.9, 1, 1.15, 1.25, 1.5, 1.75];

function aRateLabel(v){ return (v === 1 ? '1' : String(v)) + '×'; }

function storedARate(){
  try{
    const v = parseFloat(localStorage.getItem(RATE_KEY));
    return A_RATES.indexOf(v) === -1 ? 1 : v;
  }catch(e){ return 1; }
}

function cycleARate(){
  if(!ytPlayer || !ytPlayer.audio) return;
  const i = A_RATES.indexOf(ytPlayer.rate);
  ytPlayer.rate = A_RATES[(i + 1) % A_RATES.length];
  try{ localStorage.setItem(RATE_KEY, String(ytPlayer.rate)); }catch(e){}
  const el = document.querySelector('#ytdock audio');
  if(el) el.playbackRate = ytPlayer.rate;
  const b = document.getElementById('ytdock-rate');
  if(b) b.textContent = aRateLabel(ytPlayer.rate);
}

function audioDockState(){
  const b = document.getElementById('aud-dl');
  if(!b || !ytPlayer || !ytPlayer.rec) return;
  audioCachedSize(ytPlayer.rec).then(sz => {
    b.textContent = sz ? 'Saved ' + fmtMB(sz) + ' ·  Remove' : 'Download ' + fmtDur(ytPlayer.rec.secs);
    b.dataset.have = sz ? '1' : '';
  });
}

async function toggleAudioDownload(){
  const b = document.getElementById('aud-dl');
  if(!b || !ytPlayer || !ytPlayer.rec || b.dataset.busy) return;
  const rec = ytPlayer.rec;
  if(b.dataset.have){
    await removeAudio(rec);
    audioDockState();
    return;
  }
  b.dataset.busy = '1';
  b.textContent = 'Starting…';
  try{
    await downloadAudio(rec, (got, total) => {
      const pct = total ? Math.min(100, Math.round(got * 100 / total)) : 0;
      b.textContent = total ? pct + '%  ' + fmtMB(got) : fmtMB(got);
    });
    b.dataset.busy = '';
    audioDockState();
    /* Swap the element over to the stored copy so the rest of the sitting
       plays from disk rather than continuing to pull from the network. */
    const el = document.querySelector('#ytdock audio');
    if(el && !el.paused){
      const at = el.currentTime;
      const src = await audioSrc(rec);
      if(src && src !== el.src){ el.src = src; el.currentTime = at; el.play().catch(()=>{}); }
    }
  }catch(e){
    b.dataset.busy = '';
    b.textContent = 'Failed — retry';
  }
}

/* A stored copy if there is one, otherwise the network. */
async function audioSrc(rec){
  const hit = await audioCached(rec);
  if(hit){
    try{
      const blob = await hit.blob();
      if(ytPlayer && ytPlayer.objUrl) URL.revokeObjectURL(ytPlayer.objUrl);
      const u = URL.createObjectURL(blob);
      if(ytPlayer) ytPlayer.objUrl = u;
      return u;
    }catch(e){}
  }
  return audioUrl(rec);
}

async function openAudioDock(kind, idx, rec){
  const a = arrayOf(kind), q = a && a[idx];
  if(!q) return;
  const cue = 'a:' + rec.file;
  if(ytPlayer && ytPlayer.cue === cue){ togglePlayerSize(); return; }
  closePlayer(true);

  ytPlayer = { audio:true, cue, rec, kind, idx, big:false, rate:storedARate(), objUrl:null };
  const who = reciterName(rec), whoAr = reciterNameAr(rec);
  const d = document.createElement('div');
  d.id = 'ytdock';
  d.className = 'ytdock audio';
  d.innerHTML =
    '<div class="ytdock-in">' +
      '<div class="ytdock-meta">' +
        '<div class="ytdock-titles">' +
          '<span class="ytdock-title">' + attrEsc(rec.title || displayTitle(q)) + '</span>' +
          (who ? '<span class="ytdock-reciter">' + attrEsc(who) +
                 (whoAr ? ' <span class="r-ar">' + attrEsc(whoAr) + '</span>' : '') +
                 '</span>' : '') +
        '</div>' +
        '<button class="ytdock-btn" id="ytdock-rate" onclick="cycleARate()" ' +
          'title="Playback speed">' + aRateLabel(ytPlayer.rate) + '</button>' +
        '<button class="ytdock-btn" id="aud-dl" onclick="toggleAudioDownload()">…</button>' +
        '<button class="ytdock-btn" onclick="closePlayer()" aria-label="Close player">✕</button>' +
      '</div>' +
      '<audio id="aud-el" controls preload="metadata"></audio>' +
    '</div>';
  document.body.appendChild(d);
  document.body.classList.add('has-player');

  const el = d.querySelector('audio');
  /* Set once the length is known: a seek before metadata is silently lost. */
  if(rec.start) el.addEventListener('loadedmetadata', () => {
    if(el.currentTime < rec.start) el.currentTime = rec.start;
  }, { once:true });
  el.src = await audioSrc(rec);
  el.playbackRate = ytPlayer.rate;
  el.play().catch(()=>{});
  audioDockState();
  setMediaSession(rec.title || displayTitle(q), who, el);
  measurePlayer();
}

/* Lock-screen controls and the correct title while the screen is off. */
function setMediaSession(title, who, el){
  if(!('mediaSession' in navigator)) return;
  try{
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: who || '',
      album: 'Dalāʾil al-Khayrāt',
    });
    navigator.mediaSession.setActionHandler('play',  () => el.play());
    navigator.mediaSession.setActionHandler('pause', () => el.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => { el.currentTime = Math.max(0, el.currentTime - 15); });
    navigator.mediaSession.setActionHandler('seekforward',  () => { el.currentTime = el.currentTime + 15; });
  }catch(e){}
}

/* Called from the gold pill. Taking kind+idx rather than the URL keeps the
   quoting out of the onclick attribute — titles carry apostrophes. */
function openPlayerFor(kind, idx, which){
  /* A local recording wins over the embed: it plays offline once downloaded,
     survives the screen going off, and takes any playback rate. The YouTube
     path stays for everything that has no file. */
  if(which !== 2){
    const recs = audioFor(kind, idx);
    if(recs.length){ openAudioDock(kind, idx, recs[0]); return; }
  }
  const a = arrayOf(kind), q = a && a[idx];
  if(!q) return;
  const url = which === 2 ? q.video2 : q.video;
  const id = ytId(url);
  if(!id){ if(url) window.open(url, '_blank', 'noopener'); return; }
  /* A chapter may be one slice of a longer recitation. Its end is simply where
     the next chapter begins, so only the starts have to be recorded. */
  const from = which === 2 ? q.video2Start : q.videoStart;
  const to   = which === 2 ? q.video2End   : q.videoEnd;
  const cue  = id + ':' + (from || 0) + ':' + (to || 0);
  if(ytPlayer && ytPlayer.cue === cue){ togglePlayerSize(); return; }

  closePlayer(true);
  /* Opens small: the recitation is the point, and a full frame eats the page. */
  ytPlayer = { id, url, cue, big: false, rate: storedRate() };
  /* The watch page honours a start but ignores an end, so handing off to
     YouTube lands in the right place and then plays on into the next day. */
  const outUrl = url + (from ? (url.indexOf('?') === -1 ? '?' : '&') + 't=' + from + 's' : '');
  const d = document.createElement('div');
  d.id = 'ytdock';
  d.className = 'ytdock';
  /* Autoplay is permitted here because opening the dock is itself a tap. */
  d.innerHTML =
    '<div class="ytdock-in">' +
      '<div class="ytdock-frame"><iframe title="Recitation" allowfullscreen ' +
        'referrerpolicy="strict-origin-when-cross-origin" ' +
        'allow="autoplay; encrypted-media; picture-in-picture" ' +
        'src="https://www.youtube-nocookie.com/embed/' + id +
        '?autoplay=1&playsinline=1&rel=0&enablejsapi=1&origin=' + encodeURIComponent(location.origin) +
        (from ? '&start=' + from : '') + (to ? '&end=' + to : '') +
        '"></iframe></div>' +
      '<div class="ytdock-meta">' +
        '<span class="ytdock-title">' + attrEsc(displayTitle(q)) + '</span>' +
        '<button class="ytdock-btn" id="ytdock-rate" onclick="cycleRate()" ' +
          'title="Playback speed">' + rateLabel(ytPlayer.rate) + '</button>' +
        '<button class="ytdock-btn" id="ytdock-size" onclick="togglePlayerSize()">Enlarge</button>' +
        '<a class="ytdock-btn" href="' + outUrl + '" target="_blank" rel="noopener">YouTube</a>' +
        '<button class="ytdock-btn" onclick="closePlayer()" aria-label="Close player">✕</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(d);
  document.body.classList.add('has-player');
  applyPlaybackRate(d.querySelector('iframe'), ytPlayer.rate);
  measurePlayer();
}

function togglePlayerSize(){
  const d = document.getElementById('ytdock');
  if(!d || !ytPlayer) return;
  ytPlayer.big = !ytPlayer.big;
  d.classList.toggle('big', ytPlayer.big);
  const b = document.getElementById('ytdock-size');
  if(b) b.textContent = ytPlayer.big ? 'Minimise' : 'Enlarge';
  measurePlayer();
}

function closePlayer(quiet){
  const d = document.getElementById('ytdock');
  if(d) d.remove();
  /* A blob URL pins the whole file in memory until it is revoked; opening a
     few portions in a sitting would otherwise hold hundreds of MB. */
  if(ytPlayer && ytPlayer.objUrl){ try{ URL.revokeObjectURL(ytPlayer.objUrl); }catch(e){} }
  ytPlayer = null;
  document.body.classList.remove('has-player');
  document.documentElement.style.setProperty('--player-h', '0px');
  if(!quiet){ queueMsAutoFit(); msFloatPosition(); }
}

/* Publish the dock's real rendered height, then let the leaves re-fit around
   it. This is what makes full screen work: msAutoFit floors a leaf at the
   window height, and that floor now subtracts the dock. */
function measurePlayer(){
  const d = document.getElementById('ytdock');
  document.documentElement.style.setProperty('--player-h', (d ? d.offsetHeight : 0) + 'px');
  queueMsAutoFit();
  msFloatPosition();
}
window.addEventListener('resize', () => { if(ytPlayer) measurePlayer(); });

function playerHeight(){
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--player-h')) || 0;
}
/* ── The open-book spread ────────────────────────────────────────────
   Offered on a desktop window or a tablet held sideways — screens wide enough
   that halving them still leaves a page worth reading. It was briefly offered
   on a folding phone's inner screen instead and that was DROPPED at the user's
   request: ~717px halved gives two columns too narrow to read comfortably.
   The landscape test keeps out a tablet in portrait; the width floor keeps out
   phones held sideways, and both fold screens. */
const SPREAD_MQ = window.matchMedia(
  '(min-width: 900px) and (min-height: 600px) and (orientation: landscape)');
const SPREAD_KEY = 'mawlid-spread';

function spreadOffered(){ return SPREAD_MQ.matches; }

function spreadOn(){
  try{ return spreadOffered() && localStorage.getItem(SPREAD_KEY) === '1'; }
  catch(e){ return false; }
}

function toggleSpread(kind, idx){
  try{ localStorage.setItem(SPREAD_KEY, spreadOn() ? '0' : '1'); }catch(e){}
  reopen(kind, idx);
}

/* Fold or unfold the phone and the offer appears or disappears; if the spread
   was on and there is no longer room for it, the reader falls back to one leaf. */
if(SPREAD_MQ.addEventListener) SPREAD_MQ.addEventListener('change', () => {
  if(msPiece && state.pageView) reopen(msPiece.kind, msPiece.idx);
});

/* Which piece the reader is showing, so the last leaf can carry on into the
   next section instead of dead-ending. Set by readerHTML. */
let msPiece = null;

/* The chapter dir steps to, skipping any that carry no verses yet. Unfilled
   scaffolds (the litany title slots, the not-yet-built daily portions) are
   hidden from every index, so stepping into one would strand the reader on a
   run of blank placeholders. Takes kind/idx rather than reading msPiece,
   because readerHTML needs it while building a page — before msPiece has been
   set for that piece. */
/* The Dalāʾil is read in groups, and its own index already shows them that
   way: [1]–[5] before the reading, closing on the Names of the Prophet ☵;
   [6]–[14] the week and then the Duʿāʾ of Completion. Prev/Next stays inside
   the group, so finishing the preliminaries no longer tips a reader straight
   into Monday's portion, and the week still carries on to the Completion
   duʿāʾ. [0] is the About page and is in neither: it can lead you in (its own
   Next is unbounded) but the sequence never sends you back to it. */
const DALAIL_GROUPS = [[1, 5], [6, 14]];
function dalailGroup(idx){
  return DALAIL_GROUPS.find(g => idx >= g[0] && idx <= g[1]) || null;
}
function neighbourPiece(kind, idx, dir){
  const a = arrayOf(kind);
  if(!a) return null;
  const g = (kind === 'd') ? dalailGroup(idx) : null;
  const lo = g ? g[0] : 0, hi = g ? Math.min(g[1], a.length - 1) : a.length - 1;
  for(let n = idx + dir; n >= lo && n <= hi; n += dir){
    if(a[n] && !a[n].retired && a[n].verses && a[n].verses.length) return { kind, idx: n };
  }
  return null;
}
function nextPiece(){
  return msPiece ? neighbourPiece(msPiece.kind, msPiece.idx, 1) : null;
}

/* Study Version only — the owner's call. In the Book Version it added a second
   navigation idea to a page that already has leaf arrows and dots, and took up
   room the leaf needs; the next arrow there already carries forward from the
   last leaf, which stays. */
function chapterNav(kind, idx){
  const pv = neighbourPiece(kind, idx, -1), nx = neighbourPiece(kind, idx, 1);
  if(!pv && !nx) return '';
  const btn = (o, dir, label) => {
    const piece = arrayOf(o.kind)[o.idx];
    return `<button class="chap-${dir}" onclick="${openFnOf(o.kind)}(${o.idx})"
      aria-label="${label} chapter: ${attrEsc(displayTitle(piece))}">
      <span class="chap-dir">${label}</span>
      <span class="chap-name">${displayTitle(piece)}</span></button>`;
  };
  return `<nav class="chap-nav">
    ${pv ? btn(pv, 'prev', 'Previous') : '<span class="chap-gap"></span>'}
    ${nx ? btn(nx, 'next', 'Next') : '<span class="chap-gap"></span>'}
  </nav>`;
}

/* The one place the Book Version carries that pair too — the Dalāʾil's
   before-reading group, on the owner's call, so a reader who finishes the
   Opening Duʿāʾ can go straight to the next reading instead of returning to
   the index. Every leaf of those chapters shows it. Nowhere else: the v401
   reasoning still holds for the daily portions, where the leaf arrows and dots
   are the whole navigation. */
function msChapNav(kind, idx){
  if(kind !== 'd') return '';
  const g = dalailGroup(idx);
  if(!g || g[0] !== DALAIL_GROUPS[0][0]) return '';
  const nav = chapterNav(kind, idx);
  return nav ? `<div class="ms-chap" id="ms-chap">${nav}</div>` : '';
}


/* +1 turns to the next leaf, which sits to the left. Turning past the last
   leaf opens the next section — the reader carries on through the book rather
   than having to go back to the index between every part. */
function msStep(d){
  const book = document.getElementById('ms-book');
  if(!book) return;
  const n = book.children.length;
  const cur = msCurrentPage();
  /* A spread turns two leaves at a time, and the last spread of an odd-length
     chapter is reached once its first leaf is showing. */
  if(book.classList.contains('spread')){
    const from = cur - (cur % 2);
    const next = from + d * 2;
    if(d > 0 && next >= n){
      const nx = nextPiece();
      const fn = nx && window[openFnOf(nx.kind)];
      if(typeof fn === 'function') fn(nx.idx);
      return;
    }
    msGoTo(Math.max(0, Math.min(next, n - 1)));
    return;
  }
  if(d > 0 && cur >= n - 1){
    const nx = nextPiece();
    const fn = nx && window[openFnOf(nx.kind)];
    if(typeof fn === 'function') fn(nx.idx);
    return;
  }
  msGoTo(Math.max(0, Math.min(cur + d, n - 1)));
}

function msGoTo(i){
  const book = document.getElementById('ms-book');
  if(book && book.classList.contains('spread')) i = i - (i % 2);
  if(!book || !book.children[i]) return;
  book.children[i].scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
  /* Land at the top of the leaf, not wherever the previous page was scrolled to. */
  const goTop = () => {
    const top = book.getBoundingClientRect().top + window.scrollY - 8;
    window.scrollTo({ top: Math.max(0, top), behavior:'smooth' });
  };
  requestAnimationFrame(goTop);
}

/* Marks are kept per phrase, on the device. The Dalāʾil's own ("d:" keys)
   are kept per version: the Mughlay Version divides phrases where its own
   printing does, so a highlight made in one version would light a
   different phrase in the other. Istanbul's stay in the original store, so
   highlights made before there were two versions are still found; the
   Mughlay Version's sit beside it under '-mughlay'. Every other collection
   shares one store whichever version is chosen. Function declarations, not
   consts, because marks can be read before this point in the script. */
function readMarkStore(key){
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch(e){ return {}; }
}
function mughlayNow(){ try { return dalailEdition === 'sayyidina'; } catch(e){ return false; } }
function markStoreFor(kind){ return (kind === 'd' && mughlayNow()) ? 'mawlid-marks-mughlay' : 'mawlid-marks'; }
function loadMarks(){
  const m = readMarkStore('mawlid-marks');
  if(!mughlayNow()) return m;
  Object.keys(m).forEach(k => { if(k.slice(0, 2) === 'd:') delete m[k]; });
  return Object.assign(m, readMarkStore('mawlid-marks-mughlay'));
}

function markKey(kind, idx, n, seg){ return kind + ':' + idx + ':' + n + (seg != null && seg !== '' ? ':' + seg : ''); }

function markVerse(kind, idx, n, seg){
  const k = markKey(kind, idx, n, seg), store = markStoreFor(kind);
  const m = readMarkStore(store);
  const on = !m[k];
  if(m[k]) delete m[k]; else m[k] = 1;
  try { localStorage.setItem(store, JSON.stringify(m)); } catch(e){}
  const el = document.querySelector('[data-mk="' + k + '"]');
  if(el) el.classList.toggle('marked', on);
  /* In the Dalāʾil, the phrase you last highlight is the one "Save my place"
     will bookmark. */
  if(kind === 'd'){
    const vi = parseInt(n, 10), sv = (seg != null ? seg : null);
    if(on) msPlaceCandidate = { idx, n: vi, seg: sv, mk: k };
    else if(msPlaceCandidate && msPlaceCandidate.idx === idx && msPlaceCandidate.n === vi && msPlaceCandidate.seg === sv) msPlaceCandidate = null;
    /* Un-highlighting the bookmarked group clears the place, so the mark can
       be lifted from the leaf itself rather than only from the index. */
    if(!on){
      const pl = loadPlace();
      if(pl && pl.mk === k){
        try { localStorage.removeItem(placeKey()); } catch(e){}
        const was = document.querySelector('.placed');
        if(was) was.classList.remove('placed');
      }
    }
    refreshPlaceBtn();
  }
}
/* ── The English of a rubric, on tap, in the Book Version ──────────────
   The leaf sets only Arabic, so the translation of an instruction verse has
   nowhere to live on the page. It appears in a bubble fixed to the viewport
   instead of inside the leaf, because msAutoFit measures each leaf to size it
   and anything added inside would shift where the page breaks. */
/* Instructions that sit inside a passage rather than standing as a verse of
   their own: a repeat count, the place where the gathering stands, a blank the
   reader fills with their own name. They are set in gold wherever they appear,
   in both readings, so the eye can tell at a glance what is prayer and what is
   direction. Where an instruction needs explaining, the explanation lives here
   rather than in the Arabic — the text stays as the book sets it — and in the
   Book Version, which carries no English, it can be tapped for. */
const INLINE_INSTRUCTIONS = [
  { find: /\((?:[0-9]+|[\u0660-\u0669]+)\)/g },   /* repeat counts — (3), (14) */
  { find: '(٤ مرات)' },                            /* …and the same spelled out */
  { find: /(?<=^|[\s>])ع(?=[\s<]|$)/g },         /* the Mughlay printing's marginal section sign (Saturday v20), a lone ع — not recited */
  { find: '(محل الْقيام)' },                        /* the standing */
  { find: '(اللّٰهْ اللّٰهْ)' },  /* Qamarun — the gathering's sung response, as the booklet prints it */
  { find: '(اَنِّي رَسُولُكَ فِي دُعَائِهِ ﷺ)' },  /* al-Ḥizb al-Aʿẓam, Thursday — printed in coloured ink, not black */
  { find: 'وَفِي الصَّحِيحِ كَانَ اَكْثَرُ دُعَاءِ النَّبِيِّ صَلَّى اللّٰهُ تَعَالَى عَلَيْهِ وَسَلَّمَ' },  /* al-Ḥizb al-Aʿẓam, Tuesday — printed in coloured ink, not black */
  { find: 'وَفِي نُسْخَةٍ اُخْرٰى' },                 /* Ḥizb al-Istighfār, Thursday — the editorial "and in another copy", printed in coloured ink */
  { find: '(فُلَانِ بْن فُلَانٍ)',
    en:   'So-and-so, son of so-and-so — say your own name and your father’s name here.' },
];

function markInline(html, interactive){
  let out = String(html);
  INLINE_INSTRUCTIONS.forEach(g => {
    const wrap = m => (interactive && g.en)
      ? `<span class="ms-gloss has-instr" data-en="${attrEsc(g.en)}"
               onclick="showInstrBubble(event, this)">${m}</span>`
      : `<span class="ms-gloss">${m}</span>`;
    out = (typeof g.find === 'string')
      ? out.split(g.find).join(wrap(g.find))
      : out.replace(g.find, m => wrap(m));
  });
  return out;
}

function attrEsc(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function hideInstrBubble(){
  const b = document.getElementById('instr-bubble');
  if(b) b.remove();
}

function showInstrBubble(ev, el){
  if(ev) ev.stopPropagation();
  const open = document.getElementById('instr-bubble');
  const key = el.getAttribute('data-mk') || '';
  const same = !!open && open.getAttribute('data-for') === key;
  hideInstrBubble();
  if(same) return;                 /* tapping the same rubric again closes it */
  const en = el.getAttribute('data-en') || '';
  if(!en) return;

  const b = document.createElement('div');
  b.id = 'instr-bubble';
  b.className = 'instr-bubble';
  b.setAttribute('data-for', key);
  b.innerHTML = '<div class="instr-bubble-in">' + en + '</div>';
  document.body.appendChild(b);

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const w = Math.min(320, vw - 24);
  b.style.width = w + 'px';
  const r = el.getBoundingClientRect();
  const h = b.offsetHeight;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(12, Math.min(left, vw - w - 12));
  /* Above the rubric where there's room, below it where there isn't. */
  let top = r.top - h - 10;
  if(top < 12) top = Math.min(r.bottom + 10, vh - h - 12);
  if(top < 12) top = 12;
  b.style.left = left + 'px';
  b.style.top = top + 'px';
  requestAnimationFrame(() => b.classList.add('on'));
}

/* Anything that moves the page out from under the bubble dismisses it. */
document.addEventListener('click', e => {
  if(!e.target || !e.target.closest || !e.target.closest('.has-instr')) hideInstrBubble();
});
window.addEventListener('scroll', hideInstrBubble, { passive:true });
window.addEventListener('resize', hideInstrBubble);
window.addEventListener('keydown', e => { if(e.key === 'Escape') hideInstrBubble(); });

/* Full screen is done with layout rather than the Fullscreen API, which iOS
   won't grant to anything but video. Everything but the leaf steps aside. */
/* Built on open so the labels reflect the moment — which reading is showing,
   whether this leaf already holds the bookmark, which way the theme goes. */
function msMenuHTML(){
  const p = msPiece || {};
  const isD = p.kind === 'd';
  const dark = document.documentElement.classList.contains('dark');
  const saved = isD && placeIsHere(p.idx) && placeStillMarked();
  let h = '';
  h += '<button onclick="msMenuAct(\'theme\')">' + themeGlyph() +
       '<span>' + (dark ? 'Day' : 'Night') + '</span></button>';
  if(isD) h += '<button onclick="msMenuAct(\'place\')">⚑<span>' +
       (saved ? 'Place saved' : 'Save my place') + '</span>' +
       (saved ? '<span class="tick">✓</span>' : '') + '</button>';
  h += '<button onclick="msMenuAct(\'study\')">⇄<span>Study Version</span></button>';
  h += '<hr>';
  h += '<button onclick="msMenuAct(\'exit\')">✕<span>Leave full screen</span></button>';
  return h;
}

function toggleMsMenu(e){
  if(e) e.stopPropagation();
  const m = document.getElementById('ms-menu');
  if(!m) return;
  const open = !m.classList.contains('open');
  if(open) m.innerHTML = msMenuHTML();
  m.classList.toggle('open', open);
}

function closeMsMenu(){
  const m = document.getElementById('ms-menu');
  if(m) m.classList.remove('open');
}

function msMenuAct(what){
  closeMsMenu();
  const p = msPiece || {};
  if(what === 'theme') toggleTheme();
  else if(what === 'place'){ saveDalailPlace(p.idx); }
  else if(what === 'study'){ setImmersive(false); setPageView(false, p.kind, p.idx); }
  else if(what === 'exit') setImmersive(false);
}

/* A tap anywhere else closes it, including on the leaf itself. */
document.addEventListener('click', e => {
  const m = document.getElementById('ms-menu');
  if(m && m.classList.contains('open') && !e.target.closest('.ms-menu-wrap')) closeMsMenu();
}, true);

function setImmersive(on){
  closeMsMenu();
  state.immersive = !!on;
  document.documentElement.classList.toggle('immersive', state.immersive);
  /* The leaf frame changes size going in and out of full screen, so the text
     has to be measured and fitted to it again. */
  queueMsAutoFit();
  if(window.requestAnimationFrame) requestAnimationFrame(msFloatPosition);
}

window.addEventListener('keydown', e => { if(e.key === 'Escape' && state.immersive) setImmersive(false); });

/* Two ways to read the same piece: the leaves as the book sets them, or the
   same text opened out line by line with transliteration and meaning. */
function setPageView(on, kind, idx){
  if(state.pageView === on) return;
  /* Refuse to move unless the reopen can actually happen. Which view is on
     screen lives in the DOM, so flipping state without re-rendering leaves
     the page showing one view while state claims the other — and the guard
     above then turns every later tap into a no-op, stranding the reader in
     the view they asked to leave. The full-screen menu did exactly that:
     it passed the piece's index where `kind` belongs, so reopen found no
     opener and returned, and in the fork the wrong view was persisted on
     the way out. Bail before touching state, not after. */
  if(typeof window[OPENERS[kind]] !== 'function') return;
  /* Keep your place across the switch. From the Book Version that is the
     phrase the reader highlighted or bookmarked on this leaf, if any, else
     the leaf's top verse; from Study, the verse at the top of the screen. */
  const keep = state.pageView ? bookSpotForSwitch() : { n: topVisibleVerse() };
  state.pageView = on;
  if(!on) setImmersive(false);
  reopen(kind, idx);
  if(window.requestAnimationFrame) requestAnimationFrame(msFloatPosition);
  afterViewScroll(kind, idx, keep.n, keep.seg);
}

function toggleEn(kind,i){ state.showEn = !state.showEn; saveCols(); reopen(kind,i); }
/* Text size. A slider each for the Arabic and the Latin, on the owner's ask;
   it replaced four −/+ chips that took most of the controls row and needed
   several taps to cross the range.

   Dragging sets the two CSS variables and deliberately does NOT reopen the
   reader, which is what the old chips did. The size lives entirely in
   --ar-size and --latin-scale, so a re-render buys nothing and costs the
   scroll position — on an `input` event, once per pixel of travel, that read
   as the page fighting the finger.

   The end glyphs are the whole label: small on the left, large on the right,
   which reads the same way round whichever script it governs. The Arabic one
   is ض and not أ — the owner could not tell the hamza apart from a bare
   alif at this size, and ض is both unmistakable and the letter the language
   names itself by.

   Percent rather than the underlying multiplier so a screen reader announces
   something meaningful, and so the step is a whole number. */
function sizeSlider(which, scale){
  const ar = which === 'ar';
  const glyph = ar ? 'ض' : 'a';
  const label = ar ? 'Arabic text size' : 'Latin text size';
  const cls   = ar ? 'sz-ar' : 'sz-la';
  const [lo, hi] = SIZE_LIMITS[which];
  const min = Math.round(lo * 100), max = Math.round(hi * 100);
  return `<label class="size-slider" title="${label}">
      <span class="sz-gl ${cls} sz-sm" aria-hidden="true">${glyph}</span>
      <input type="range" min="${min}" max="${max}" step="5"
        value="${Math.round(scale * 100)}" aria-label="${label}"
        oninput="setTextScale('${which}', this.value)">
      <span class="sz-gl ${cls} sz-lg" aria-hidden="true">${glyph}</span>
    </label>`;
}

/* The one place the two size variables are written. Every opener called this
   pair of lines verbatim, which is how they are guaranteed to stay in step. */
function applyTextScale(){
  document.documentElement.style.setProperty('--ar-size', (1.9 * state.arScale) + 'rem');
  document.documentElement.style.setProperty('--latin-scale', state.latinScale);
}

function setTextScale(which, pct){
  const v = clampSize(which, (+pct || 100) / 100);
  if(which === 'ar') state.arScale = v; else state.latinScale = v;
  applyTextScale();
  saveTextScale();
}
/* Book Version zoom: scales the whole leaf — text, borders and page together —
   so line breaks and page fills never change, only the size on screen. */
function msZoomStep(dir){
  state.msZoom = Math.min(2.4, Math.max(0.6, +(state.msZoom + dir*0.15).toFixed(2)));
  document.documentElement.style.setProperty('--ms-zoom', state.msZoom);
  /* Re-fit against the newly-sized frame so the Arabic fills the enlarged page
     without spilling past its border. */
  queueMsAutoFit();
}
/* ── Back, and coming back ───────────────────────────────────────
   The manifest is display:standalone, so on Android there is no browser
   chrome and Back is the system gesture. The app pushed no history of its
   own, so Back had nothing to pop and closed the app outright however deep
   you were reading. Every screen here is fully described by state.tab, the
   Burdah sub-chapter and whichever piece is open, so each navigation pushes
   that descriptor and Back pops it.

   Whether a reader is open is read off the PAGE, not from msPiece: msPiece is
   set when a reader opens and is never cleared, so it still names a chapter
   long after you have gone back to an index. renderedView() documents the
   same trap — ask the page. */
const LAST_KEY = 'mawlid-last';
const RESTORE_MS = 30 * 60 * 1000;   /* half an hour — long enough to take a
                                        call mid-gathering, short enough that
                                        the next morning opens fresh at home */
const HOME_LOC = { tab: 'home', burdah: null, piece: null };
let navFromHistory = false;

function currentLoc(){
  const reading = !!document.querySelector('main.verses');
  return { tab: state.tab,
           burdah: state.burdahChapter,
           piece: (reading && msPiece) ? { kind: msPiece.kind, idx: msPiece.idx } : null };
}
function sameLoc(a, b){
  if(!a || !b) return false;
  const pa = a.piece, pb = b.piece;
  if(a.tab !== b.tab || a.burdah !== b.burdah) return false;
  if(!pa && !pb) return true;
  return !!pa && !!pb && pa.kind === pb.kind && pa.idx === pb.idx;
}
/* A descriptor can outlive the corpus it names — a saved place from an older
   release, a chapter since renumbered. Never hand a missing index to an
   opener; readerHTML would throw on it and the app would come up blank. */
function locValid(loc){
  if(!loc || typeof loc.tab !== 'string') return false;
  if(!loc.piece) return true;
  const a = arrayOf(loc.piece.kind);
  return !!(a && a[loc.piece.idx]);
}
function pushLoc(){
  if(navFromHistory) return;
  const loc = currentLoc();
  const cur = history.state && history.state.loc;
  try {
    if(sameLoc(cur, loc)) history.replaceState({ loc }, '');
    else history.pushState({ loc }, '');
  } catch(e){}
}
function applyLoc(loc){
  if(!locValid(loc)) return;
  navFromHistory = true;
  const prev = suppressNavSignals;
  suppressNavSignals = true;     /* walking back is not a nav to broadcast to a
                                    session, and must not pause a follower */
  try {
    setImmersive(false);
    closeMsMenu();
    state.tab = loc.tab;
    state.query = '';
    state.burdahChapter = loc.burdah;
    const fn = loc.piece && window[openFnOf(loc.piece.kind)];
    if(typeof fn === 'function') fn(loc.piece.idx);
    else renderIndex();
  } finally { suppressNavSignals = prev; navFromHistory = false; }
}
window.addEventListener('popstate', e => {
  /* Back closes what is on top first. Each of those consumed the pop, so put
     an entry back or the next Back would skip a whole screen. */
  if(state.immersive){ setImmersive(false); pushLoc(); return; }
  const menu = document.getElementById('ms-menu');
  if(menu && menu.classList.contains('open')){ closeMsMenu(); pushLoc(); return; }
  if(e.state && e.state.loc){ applyLoc(e.state.loc); return; }
  /* Popped past our own baseline: that is the reader asking to leave, so do
     nothing and let the platform close the app. */
});

/* Where you were, for a little while. Distinct from the Dalāʾil's "Continue
   where you left off", which is an explicit bookmark and permanent; this is
   automatic and expires. */
function saveLast(){
  try {
    const loc = currentLoc();
    if(loc.tab === 'session') return;    /* a live session is not a place to
                                            silently rejoin on next open */
    localStorage.setItem(LAST_KEY, JSON.stringify({ loc, at: Date.now() }));
  } catch(e){}
}
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden') saveLast();
});
window.addEventListener('pagehide', saveLast);

/* Startup: the texts first, then everything that shows them. */
loadContent().then(({ errors, nothingLoaded }) => {
  errors.forEach(e => console.error('Content: ' + e));
  if(nothingLoaded){ showLoadFailure(errors); return; }
  if(errors.length) showLoadNotice(errors);
  start();
});

function start(){
  /* Everything derived from the texts waits until here: at load they are still empty. */
  initDalailEditions();
  renderIndex();
  joinFromLink();
  restoreRecent();
}

/* Some texts couldn't be loaded: say which, at the foot of the screen. It
   lives outside #app, so re-renders leave it alone until it's dismissed. */
function showLoadNotice(errors){
  const notice = document.createElement('div');
  notice.className = 'load-notice';
  notice.setAttribute('role', 'alert');
  notice.innerHTML = `<button class="load-notice-x" onclick="this.parentNode.remove()" aria-label="Dismiss">✕</button>
    <strong>Some texts couldn't be loaded</strong>
    <ul>${errors.map(e => `<li>${escHTML(e)}</li>`).join('')}</ul>`;
  document.body.appendChild(notice);
}

/* Not one section arrived, typically on a first visit with no connection. */
function showLoadFailure(errors){
  app.innerHTML = `<div class="placeholder load-failed">
      <div class="ph-star">۞</div>
      <p><strong>The texts couldn't be loaded</strong></p>
      <p>Check your connection, then try again.</p>
      <p><button class="retry" onclick="location.reload()">Try again</button></p>
      <p class="load-detail">${escHTML(errors[0] || '')}</p>
    </div>`;
}

/* Opened from a shared session link (…/#s=4821)? Land on the session screen and
   join straight away — the tap on the link is the person's consent, and the
   banner makes it obvious what happened. Offline, this fails quietly and the
   app behaves exactly as normal. */
function joinFromLink(){
  const code = pendingSessionCode();
  if(!code) return;
  state.tab = 'session';
  renderIndex();
  connectSession(code, 'follower');
}

/* The baseline entry is always home, so Back out of a restored chapter lands
   on home rather than closing the app on the first press. */
/* Run from start(), not at load: it checks the saved place against the texts
   (locValid), and here those are fetched, so at load they are still empty and every
   saved place would look invalid and be dropped without a sound. */
function restoreRecent(){
  try { history.replaceState({ loc: HOME_LOC }, ''); } catch(e){}
  /* A session link decides where to land; never override it. By now
     joinFromLink has already switched the tab and may have cleared the hash,
     so test both. */
  if(state.tab === 'session' || pendingSessionCode()) return;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LAST_KEY)); } catch(e){}
  if(!saved || typeof saved.at !== 'number') return;
  if(Date.now() - saved.at >= RESTORE_MS) return;
  if(!locValid(saved.loc) || sameLoc(saved.loc, HOME_LOC)) return;
  applyLoc(saved.loc);
  try { history.pushState({ loc: currentLoc() }, ''); } catch(e){}
}

/* Pause auto-scroll the moment the user scrolls by hand (wheel or drag).
   Our own window.scrollBy doesn't fire these input events, so no false stops. */
/* The bismillah heads the reading bar, then folds away as soon as you scroll in,
   leaving a slim bar with Back and the bookmark.

   Two thresholds, not one, and deliberately far apart. The bar is sticky, so it
   holds its place in the flow: folding the bismillah shortens it, everything
   below rides up, the document itself gets shorter, and scrollY falls. With a
   single line to cross, that fall can carry scrollY straight back under it —
   which unfolds the bar, pushes the page down, and crosses the line again. The
   result was the bismillah blinking in and out several times a second while the
   header scrolled away. The gap here is wider than the height the fold removes,
   so the bar can no longer scroll itself back over its own threshold. Read on a
   rAF tick as well, so a burst of scroll events settles into one measurement. */
const BAR_SLIM_ON = 88, BAR_SLIM_OFF = 32;
let barTick = false;

function updateReaderBar(){
  const bar = document.querySelector('.reader-bar');
  if(!bar) return;
  const y = window.scrollY || 0;
  const slim = bar.classList.contains('slim');
  if(!slim && y > BAR_SLIM_ON)       bar.classList.add('slim');
  else if(slim && y < BAR_SLIM_OFF)  bar.classList.remove('slim');
}

window.addEventListener('scroll', () => {
  if(barTick) return;
  barTick = true;
  requestAnimationFrame(() => { barTick = false; updateReaderBar(); });
}, { passive:true });

/* Register service worker for offline use (needs hosting over https) */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

/* Warm the Latin font cache while online (the Arabic is bundled in this file
   and always available). Not strictly needed for Arabic any more, but keeps the
   Latin faces available offline from the first visit. */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.catch(()=>{});
}
