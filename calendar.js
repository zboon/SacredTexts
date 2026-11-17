/* The calendar. Loaded after app.js. It owns its own markup and styles and reaches the
   rest of the app through a few hooks in app.js: the slim "Today" line on the home page
   (calendarStripHTML), the header icon (calMarkHTML) and the calendar screen
   (calendarPanel, shown when state.tab is 'calendar').

   Dates come from two places and are merged:
     - optional `born` / `died` on any silsila, biography, Ottoman or turuq piece, and
     - standalone events in content/calendar/ for anything without a piece
       (people with no entry, occasions, history).
   Format and examples: content/README.md ("The calendar"). A date is Hijri
   ({"month":3,"day":12,"year":1318}), Gregorian ("YYYY-MM-DD"), or both. Hijri wins when
   both are given, because an urs is kept by the Hijri date. The year is optional; without
   it the date simply recurs every year.

   Hijri dates for the grid are computed on the device (Intl's Umm al-Qura calendar, with
   the tabular civil calendar as a fallback), so this needs no network. They can differ by
   a day from a printed or locally sighted calendar; stored dates are never computed. */
(function(){
  var MONTHS = [
    ['Muḥarram','محرم'],['Ṣafar','صفر'],['Rabīʿ al-Awwal','ربيع الأول'],['Rabīʿ al-Thānī','ربيع الآخر'],
    ['Jumādā al-Ūlā','جمادى الأولى'],['Jumādā al-Ākhira','جمادى الآخرة'],['Rajab','رجب'],['Shaʿbān','شعبان'],
    ['Ramaḍān','رمضان'],['Shawwāl','شوال'],['Dhū al-Qaʿda','ذو القعدة'],['Dhū al-Ḥijja','ذو الحجة']];
  var GMON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var GMON_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var WDAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var KINDS = { urs:'Urs', birth:'Birth', occasion:'Occasion', history:'History' };
  var OPEN = { c:'openSilsila', g:'openBiography', o:'openOttoman', t:'openTuruq', h:'openSohbet' };

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function noon(y, m, d){ return new Date(y, m, d, 12); }
  function addDays(g, n){ return noon(g.getFullYear(), g.getMonth(), g.getDate() + n); }

  /* Hijri date of a Gregorian Date. */
  var FMT = null;
  ['islamic-umalqura','islamic-civil'].some(function(cal){
    try {
      var f = new Intl.DateTimeFormat('en-u-ca-' + cal + '-nu-latn', { day:'numeric', month:'numeric', year:'numeric' });
      var t = f.formatToParts(noon(2026, 5, 1)), ok = {};
      t.forEach(function(p){ ok[p.type] = parseInt(p.value, 10); });
      if(ok.year > 1300 && ok.year < 1600 && ok.month >= 1 && ok.month <= 12){ FMT = f; return true; }
    } catch(e){}
    return false;
  });
  function tabular(date){                       /* the civil (arithmetical) Islamic calendar */
    var jdn = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000) + 2440588;
    var l = jdn - 1948440 + 10632, n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    var j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) + (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
    l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
    var m = Math.floor((24 * l) / 709), d = l - Math.floor((709 * m) / 24);
    return { y: 30 * n + j - 30, m: m, d: d };
  }
  function hijriOf(date){
    if(FMT){
      var o = {};
      FMT.formatToParts(date).forEach(function(p){ if(p.type === 'day' || p.type === 'month' || p.type === 'year') o[p.type] = parseInt(p.value, 10); });
      if(o.year && o.month && o.day) return { y:o.year, m:o.month, d:o.day };
    }
    return tabular(date);
  }
  function gText(g){ return g.getDate() + ' ' + GMON[g.getMonth()] + ' ' + g.getFullYear(); }
  function hText(h, withYear){ return h.d + ' ' + MONTHS[h.m - 1][0] + (withYear === false ? '' : ' ' + h.y + ' AH'); }

  /* ---- events ---- */
  function parseG(s){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? { y:+m[1], m:+m[2], d:+m[3] } : null;
  }
  function normDate(src){
    if(!src || typeof src !== 'object') return null;
    var h = null, g = parseG(src.gregorian);
    if(src.hijri && +src.hijri.month >= 1 && +src.hijri.month <= 12 && +src.hijri.day >= 1 && +src.hijri.day <= 30)
      h = { m:+src.hijri.month, d:+src.hijri.day, y: src.hijri.year ? +src.hijri.year : null };
    if(!h && !g) return null;
    return { h:h, g:g, approx:!!src.approx };
  }
  function stripNum(t){ return String(t || '').replace(/^\s*\d+\s*·\s*/, ''); }
  var EVENTS = null;
  function events(){
    if(EVENTS) return EVENTS;
    var out = [];
    (typeof CALENDAR_EVENTS !== 'undefined' ? CALENDAR_EVENTS : []).forEach(function(e){
      var dt = normDate(e);
      if(!dt || !KINDS[e.kind]){ console.warn('Calendar: skipped an event with a missing or invalid date or kind:', e && e.titleEnglish); return; }
      out.push({ kind:e.kind, title:e.titleEnglish, ar:e.titleArabic || '', note:e.note || '', dt:dt, open:null });
    });
    Object.keys(OPEN).forEach(function(k){
      var arr = (typeof arrayOf === 'function') ? arrayOf(k) : null;
      (arr || []).forEach(function(p, idx){
        [['born','birth'],['died','urs']].forEach(function(pair){
          if(!p[pair[0]]) return;
          var dt = normDate(p[pair[0]]);
          if(!dt){ console.warn('Calendar: invalid ' + pair[0] + ' date on', p.titleEnglish); return; }
          out.push({ kind:pair[1], title:stripNum(p.titleEnglish), ar:p.titleArabic || '', note:'', dt:dt, open:{ kind:k, idx:idx } });
        });
      });
    });
    EVENTS = out;
    return out;
  }
  function eventsOn(h, g, filt){
    return events().filter(function(e){
      if(filt && !filt[e.kind]) return false;
      return e.dt.h ? (e.dt.h.m === h.m && e.dt.h.d === h.d) : (e.dt.g.m === g.getMonth() + 1 && e.dt.g.d === g.getDate());
    });
  }
  function ago(e, h, g){
    var n = e.dt.h && e.dt.h.y ? h.y - e.dt.h.y : (!e.dt.h && e.dt.g.y ? g.getFullYear() - e.dt.g.y : null);
    return (n && n > 0) ? n + (n === 1 ? ' year' : ' years') : '';
  }
  function eventDate(e){
    var parts = [];
    if(e.dt.h) parts.push(e.dt.h.d + ' ' + MONTHS[e.dt.h.m - 1][0] + (e.dt.h.y ? ' ' + e.dt.h.y + ' AH' : ''));
    if(e.dt.g) parts.push(e.dt.g.d + ' ' + GMON[e.dt.g.m - 1] + ' ' + e.dt.g.y);
    return (e.dt.approx ? 'c. ' : '') + parts.join(' · ');
  }

  /* ---- state ---- */
  var st = null;
  function monthLen(first){
    var h0 = hijriOf(first), n = 1;
    while(n < 31 && hijriOf(addDays(first, n)).m === h0.m) n++;
    return n;
  }
  function setMonthFrom(first){
    var h = hijriOf(first);
    st.first = first; st.y = h.y; st.m = h.m; st.len = monthLen(first);
  }
  function today(){ var t = new Date(); return noon(t.getFullYear(), t.getMonth(), t.getDate()); }
  function init(){
    var t = today(), h = hijriOf(t);
    st = { filt:{ urs:true, birth:true, occasion:true, history:true }, sel:h.d - 1, list:[] };
    setMonthFrom(addDays(t, -(h.d - 1)));
  }

  /* ---- views ---- */
  function dots(list){
    return list.length ? '<span class="cal-dots" aria-hidden="true">' + list.slice(0, 3).map(function(e){ return '<i class="k-' + e.kind + '"></i>'; }).join('') + '</span>' : '';
  }
  function eventRow(e, h, g, key){
    var a = ago(e, h, g);
    var inner = '<span class="cal-pill k-' + e.kind + '">' + KINDS[e.kind] + '</span>'
      + '<span class="cal-ev-t"><b>' + esc(e.title) + '</b>' + (e.ar ? '<span class="cal-ev-ar">' + esc(e.ar) + '</span>' : '')
      + '<small>' + esc(eventDate(e)) + (a ? ' · ' + a + ' ago' : '') + '</small>'
      + (e.note ? '<small>' + esc(e.note) + '</small>' : '') + '</span>' + (e.open ? '<span class="cal-chev">›</span>' : '');
    if(!e.open) return '<div class="cal-ev">' + inner + '</div>';
    st.list.push(e);
    return '<button type="button" class="cal-ev" onclick="calOpen(' + (st.list.length - 1) + ')">' + inner + '</button>';
  }
  function body(){
    st.list = [];
    var t = today(), th = hijriOf(t);
    var last = addDays(st.first, st.len - 1);
    var span = (st.first.getMonth() === last.getMonth() ? GMON_LONG[st.first.getMonth()] : GMON[st.first.getMonth()] + ' – ' + GMON[last.getMonth()])
      + ' ' + (st.first.getFullYear() === last.getFullYear() ? last.getFullYear() : st.first.getFullYear() + ' – ' + last.getFullYear());
    var h = '<div class="cal-head"><button type="button" class="cal-nav" onclick="calNav(-1)" aria-label="Previous month">‹</button>'
      + '<div class="cal-title"><b>' + MONTHS[st.m - 1][0] + ' ' + st.y + ' AH</b><span class="cal-ar">' + MONTHS[st.m - 1][1] + '</span><small>' + span + '</small></div>'
      + '<button type="button" class="cal-nav" onclick="calNav(1)" aria-label="Next month">›</button></div>'
      + '<div class="cal-bar"><button type="button" class="cal-today" onclick="calToday()">Today</button><div class="cal-chips">'
      + Object.keys(KINDS).map(function(k){ return '<button type="button" class="cal-chip k-' + k + (st.filt[k] ? ' on' : '') + '" aria-pressed="' + !!st.filt[k] + '" onclick="calFilter(\'' + k + '\')">' + KINDS[k] + '</button>'; }).join('')
      + '</div></div>';
    h += '<div class="cal-grid" role="grid">' + WDAY.map(function(d){ return '<div class="cal-wd" role="columnheader">' + d + '</div>'; }).join('');
    for(var b = 0; b < st.first.getDay(); b++) h += '<div class="cal-blank"></div>';
    for(var i = 0; i < st.len; i++){
      var g = addDays(st.first, i), hh = { y:st.y, m:st.m, d:i + 1 }, ev = eventsOn(hh, g, st.filt);
      var isToday = g.getTime() === t.getTime();
      h += '<button type="button" role="gridcell" class="cal-day' + (isToday ? ' today' : '') + (i === st.sel ? ' sel' : '') + (ev.length ? ' has' : '') + '" onclick="calPick(' + i + ')"'
        + ' aria-label="' + esc(hText(hh) + ', ' + gText(g) + (ev.length ? ', ' + ev.length + (ev.length === 1 ? ' date' : ' dates') : '')) + '">'
        + '<span class="h">' + (i + 1) + '</span><span class="g">' + (g.getDate() === 1 || i === 0 ? g.getDate() + ' ' + GMON[g.getMonth()] : g.getDate()) + '</span>' + dots(ev) + '</button>';
    }
    h += '</div>';
    var sg = addDays(st.first, st.sel), sh = { y:st.y, m:st.m, d:st.sel + 1 }, sev = eventsOn(sh, sg, st.filt);
    h += '<section class="cal-sec"><h2>' + WDAY[sg.getDay()] + ' ' + gText(sg) + '<small>' + hText(sh) + '</small></h2>'
      + (sev.length ? sev.map(function(e){ return eventRow(e, sh, sg); }).join('') : '<p class="cal-none">No dates on this day.</p>') + '</section>';
    var month = [];
    for(var j = 0; j < st.len; j++){
      var gj = addDays(st.first, j), hj = { y:st.y, m:st.m, d:j + 1 };
      eventsOn(hj, gj, st.filt).forEach(function(e){ month.push({ e:e, h:hj, g:gj }); });
    }
    h += '<section class="cal-sec"><h2>This month</h2>'
      + (month.length ? month.map(function(x){ return '<div class="cal-mrow"><span class="cal-md">' + x.h.d + '<small>' + x.g.getDate() + ' ' + GMON[x.g.getMonth()] + '</small></span>' + eventRow(x.e, x.h, x.g) + '</div>'; }).join('')
        : '<p class="cal-none">Nothing recorded this month yet.</p>') + '</section>';
    h += '<p class="cal-foot">Hijri dates are worked out on your device and can differ by a day from a printed or locally sighted calendar.</p>';
    return h;
  }
  function render(){
    var root = document.getElementById('cal-root');
    if(root) root.innerHTML = body();
  }

  /* ---- hooks for app.js ---- */
  window.calendarPanel = function(){
    if(!st) init();
    return '<div class="cal" id="cal-root">' + body() + '</div>';
  };
  window.openCalendar = function(){ st = null; selectTab('calendar'); };
  window.calendarStripHTML = function(){
    try {
      var t = today(), h = hijriOf(t), ev = eventsOn(h, t, null);
      var first = ev[0];
      if(!first) return '';      /* the line appears only on a day that has a date; the header icon is always there */
      var more = ev.length > 1 ? ' <span class="cal-more">+' + (ev.length - 1) + '</span>' : '';
      var line = first ? '<span class="cal-strip-ev"><i class="k-' + first.kind + '"></i><span class="cal-strip-t">' + esc((first.kind === 'urs' ? 'Urs: ' : '') + first.title) + more + '</span></span>' : '';
      return '<button type="button" class="cal-strip" onclick="openCalendar()" aria-label="Open the calendar. Today is ' + esc(hText(h) + ', ' + gText(t)) + '">'
        + line + '<span class="cal-strip-d">' + esc(hText(h, false)) + '</span></button>';
    } catch(e){ return ''; }
  };
  window.calMarkHTML = function(){
    return '<button class="cal-mark" onclick="openCalendar()" aria-label="Calendar"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"></rect><path d="M3.5 10h17M8 3.5v3M16 3.5v3"></path></svg></button>';
  };
  window.calNav = function(dir){
    if(dir > 0) setMonthFrom(addDays(st.first, st.len));
    else { var p = addDays(st.first, -1); setMonthFrom(addDays(p, -(hijriOf(p).d - 1))); }
    var t = today(), th = hijriOf(t);
    st.sel = (st.y === th.y && st.m === th.m) ? th.d - 1 : 0;
    render();
  };
  window.calToday = function(){ var t = today(), h = hijriOf(t); setMonthFrom(addDays(t, -(h.d - 1))); st.sel = h.d - 1; render(); };
  window.calPick = function(i){ st.sel = i; render(); };
  window.calFilter = function(k){ st.filt[k] = !st.filt[k]; render(); };
  window.calOpen = function(i){
    var e = st.list[i];
    if(!e || !e.open) return;
    var fn = window[OPEN[e.open.kind]];
    if(typeof fn === 'function') fn(e.open.idx);
  };

  var CSS = '.cal-strip{display:flex;align-items:center;justify-content:center;gap:.5rem;width:calc(100% - 2rem);max-width:30rem;margin:.35rem auto 0;padding:.15rem .5rem;background:none;border:0;color:var(--ink-soft,#666);font-size:.76rem;line-height:1.3;white-space:nowrap;overflow:hidden}'
    + '.cal-strip-ev{display:flex;align-items:center;gap:.35rem;min-width:0;color:var(--ink,#222)}.cal-strip-t{overflow:hidden;text-overflow:ellipsis}'
    + '.cal-strip-d{flex:none;opacity:.85}.cal-strip-d::before{content:"\\00b7";margin-right:.5rem}'
    + '.cal-more{color:var(--ink-soft,#666);font-weight:400;white-space:nowrap}.cal-strip:hover .cal-strip-t,.cal-strip:focus-visible .cal-strip-t{text-decoration:underline}'
    + '.cal-strip-ev i,.cal-dots i{display:inline-block;width:.45rem;height:.45rem;border-radius:50%;flex:none}'
    + '.k-urs{--k:#8a2b3d}.k-birth{--k:#2f7a4f}.k-occasion{--k:#a47a1f}.k-history{--k:#3a4f9a}'
    + '.cal-strip-ev i,.cal-dots i{background:var(--k)}'
    + '.cal{max-width:40rem;margin:0 auto;padding:.4rem .9rem 2rem;display:flex;flex-direction:column;gap:.9rem;color:var(--ink,#222)}'
    + '.cal-head{display:flex;align-items:center;justify-content:space-between;gap:.6rem}'
    + '.cal-title{text-align:center;display:flex;flex-direction:column;align-items:center;line-height:1.25}.cal-title b{font-size:1.15rem}.cal-title small{color:var(--ink-soft,#666);font-size:.8rem}'
    + '.cal-ar{font-family:"UthmanicHafs","Amiri",serif;font-size:1.25rem;color:var(--ar-color,var(--ink,#222))}'
    + '.cal-nav{width:2.6rem;height:2.6rem;border-radius:50%;border:1.5px solid var(--gold,#a47a1f);color:var(--gold,#a47a1f);font-size:1.4rem;line-height:1}'
    + '.cal-bar{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}'
    + '.cal-today{padding:.4rem .9rem;border-radius:999px;border:1.5px solid var(--gold,#a47a1f);color:var(--gold,#a47a1f);font-weight:700;font-size:.85rem}'
    + '.cal-chips{display:flex;gap:.4rem;flex-wrap:wrap}.cal-chip{padding:.35rem .7rem;border-radius:999px;border:1.5px solid var(--paper-edge,#ccc);font-size:.8rem;color:var(--ink-soft,#666)}'
    + '.cal-chip.on{border-color:var(--k);color:var(--ink,#222);box-shadow:inset 0 0 0 1px var(--k)}'
    + '.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:.25rem}'
    + '.cal-wd{text-align:center;font-size:.72rem;color:var(--ink-soft,#666);padding:.2rem 0}'
    + '.cal-day{position:relative;aspect-ratio:1/1.05;border:1px solid var(--paper-edge,#ddd);border-radius:10px;background:var(--card,#fff);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.05rem;color:var(--ink,#222);min-width:0}'
    + '.cal-day .h{font-size:1.05rem;font-weight:700;line-height:1}.cal-day .g{font-size:.62rem;color:var(--ink-soft,#666);line-height:1.1}'
    + '.cal-day.today{border-color:var(--gold,#a47a1f);box-shadow:inset 0 0 0 1.5px var(--gold,#a47a1f)}'
    + '.cal-day.sel{background:var(--paper-edge,#eee)}'
    + '.cal-day.has{background:#e6f3ea;border-color:#9fd1b1}.cal-day.has .h{color:#13803f}'
    + 'html.dark .cal-day.has{background:#173826;border-color:#2f6b49}html.dark .cal-day.has .h{color:#6fdc9b}'
    + '.cal-dots{position:absolute;bottom:.2rem;display:flex;gap:.12rem}'
    + '.cal-sec{display:flex;flex-direction:column;gap:.5rem}.cal-sec h2{font-size:1rem;margin:.2rem 0 0;display:flex;flex-direction:column;line-height:1.3}.cal-sec h2 small{color:var(--ink-soft,#666);font-weight:400;font-size:.82rem}'
    + '.cal-none,.cal-foot{color:var(--ink-soft,#666);font-size:.85rem}'
    + '.cal-ev{display:flex;align-items:flex-start;gap:.7rem;width:100%;text-align:left;padding:.65rem .8rem;border:1px solid var(--paper-edge,#ddd);border-radius:10px;background:var(--card,#fff);color:var(--ink,#222);min-width:0}'
    + 'button.cal-ev:active{transform:scale(.99)}'
    + '.cal-pill{flex:none;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;font-weight:700;color:#fff;background:var(--k);border-radius:6px;padding:.15rem .4rem;margin-top:.15rem}'
    + '.cal-ev-t{display:flex;flex-direction:column;min-width:0;flex:1;overflow-wrap:anywhere}.cal-ev-t small{color:var(--ink-soft,#666);font-size:.8rem}'
    + '.cal-ev-ar{font-family:"UthmanicHafs","Amiri",serif;font-size:1.15rem;color:var(--ar-color,var(--ink,#222))}.cal-ev .cal-chev{color:var(--gold,#a47a1f);font-size:1.2rem;align-self:center}'
    + '.cal-mrow{display:flex;gap:.6rem;align-items:flex-start}.cal-md{flex:none;width:3rem;text-align:center;font-weight:700;font-size:1.05rem;line-height:1.1;padding-top:.55rem}.cal-md small{display:block;font-weight:400;font-size:.62rem;color:var(--ink-soft,#666)}.cal-mrow .cal-ev{flex:1}'
    /* the header icon: same treatment as the bookmark beside it */
    + '.cal-mark{position:absolute;top:calc(env(safe-area-inset-top,0px) + .8rem);left:6.2rem;width:2.3rem;height:2.3rem;border-radius:50%;border:none;cursor:pointer;background:rgba(250,245,234,.14);color:var(--paper);display:flex;align-items:center;justify-content:center}'
    + '.cal-mark:active{background:rgba(250,245,234,.28)}.masthead.compact .cal-mark{position:static;top:auto;left:auto}'
    ;
  var sty = document.createElement('style'); sty.id = 'cal-css'; sty.textContent = CSS; document.head.appendChild(sty);
})();
