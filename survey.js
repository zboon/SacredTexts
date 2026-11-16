/* A hidden survey page. Not linked from anywhere in the app: it opens only from
   a link ending in #survey, e.g. https://zboon.github.io/SacredTexts/#survey.
   Answers are posted to the Supabase project the live sessions already use
   (SESSION_CONFIG in app.js), into the table made by docs/survey-setup.sql.
   That table lets the public key INSERT and nothing else, so nobody who has the
   key can read anyone's answers back. Loaded after app.js. */
(function(){
  var SURVEY = 'calendar';
  var QUESTIONS = [
    { key:'cal', type:'one', title:'1. Which calendar should the dates use?',
      help:'Death anniversaries (the urs) are traditionally kept by the Hijri date.',
      opts:[['Hijri and Gregorian together'],['Hijri only'],['Gregorian only']] },
    { key:'front', type:'one', title:'2. How should the calendar appear on the front page?',
      help:'The existing tiles stay exactly as they are in every option.', mock:true, other:'Describe your idea',
      opts:[['A slim "Today" line above the tiles','Shows today’s Hijri date and any anniversaries today. Tapping it opens the full calendar.'],
            ['A small calendar icon in the header','Next to the bookmark icon. The front page stays untouched.'],
            ['Both of the above']] },
    { key:'source', type:'one', title:'3. Where should the dates come from?',
      help:'The Biographies section is empty so far, and the Silsila masters have no dates yet.',
      opts:[['Optional birth and death dates on any biography or silsila entry','Add them once and the calendar picks them up automatically.'],
            ['Biographies section only'],['A separate hand-kept list of dates']] },
    { key:'dates', type:'many', title:'4. Which dates should it show?', help:'Tick all that apply.', other:'Which other dates?',
      opts:[['Birth dates'],['Death dates / urs'],
            ['Islamic occasions','For example Mawlid, Laylat al-Qadr, Ashura, the start of Ramadan.'],['Dates in Ottoman history']] }
  ];

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function clientId(){
    try { var c = localStorage.getItem('st-survey-client'); if(!c){ c = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('st-survey-client', c); } return c; }
    catch(e){ return null; }
  }
  var CSS = '.sv [hidden]{display:none !important}.sv{max-width:40rem;margin:0 auto;padding:1.2rem 1rem 3rem;display:flex;flex-direction:column;gap:1rem;font-family:inherit}'
    + '.sv h1{font-size:1.6rem;margin:.2rem 0 0;line-height:1.2;color:var(--ink,#222)}'
    + '.sv .lede,.sv .help{color:var(--ink-soft,#666);font-size:.95rem;line-height:1.5;margin:0}'
    + '.sv .eyebrow{font-size:.72rem;letter-spacing:.09em;text-transform:uppercase;color:var(--gold,#a47a1f);font-weight:700}'
    + '.sv .q{background:var(--card,#fff);border:1px solid var(--paper-edge,#ddd);border-radius:14px;padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.6rem}'
    + '.sv .q h2{font-size:1.05rem;margin:0;color:var(--ink,#222)}'
    + '.sv label.o{display:flex;gap:.7rem;align-items:flex-start;padding:.65rem .8rem;border:1px solid var(--paper-edge,#ddd);border-radius:10px;cursor:pointer;color:var(--ink,#222)}'
    + '.sv label.o:has(input:checked){border-color:var(--gold,#a47a1f);box-shadow:inset 0 0 0 1px var(--gold,#a47a1f)}'
    + '.sv label.o input{margin-top:.25rem;accent-color:var(--gold,#a47a1f);flex:none;width:1.05rem;height:1.05rem}'
    + '.sv label.o small{display:block;color:var(--ink-soft,#666);font-size:.85rem;margin-top:.1rem}'
    + '.sv input[type=text],.sv textarea{width:100%;box-sizing:border-box;font:inherit;color:var(--ink,#222);background:var(--card,#fff);border:1px solid var(--paper-edge,#ddd);border-radius:8px;padding:.6rem .7rem}'
    + '.sv textarea{min-height:5.5rem;resize:vertical}'
    + '.sv .err{color:#a33a1a;font-size:.88rem;margin:0}'
    + '.sv button{font:inherit;cursor:pointer;border-radius:10px;padding:.8rem 1.3rem;border:1px solid var(--gold,#a47a1f);background:var(--gold,#a47a1f);color:#fff;font-weight:700}'
    + '.sv button.quiet{background:transparent;color:var(--gold,#a47a1f)}.sv button:disabled{opacity:.55}'
    + '.sv .mock{border:1px dashed var(--paper-edge,#ccc);border-radius:10px;padding:.6rem;display:flex;flex-direction:column;gap:.4rem}'
    + '.sv .mock .strip{display:flex;justify-content:space-between;padding:.4rem .6rem;border-radius:7px;background:var(--paper-edge,#eee);font-size:.85rem;color:var(--ink,#222)}'
    + '.sv .mock .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem}.sv .mock .tiles i{height:1.9rem;border-radius:6px;border:1px solid var(--paper-edge,#ccc)}'
    + '.sv .mock .cap{font-size:.75rem;color:var(--ink-soft,#666)}.sv .thanks{text-align:center;align-items:center}';

  function qHTML(q){
    var type = q.type === 'one' ? 'radio' : 'checkbox';
    var h = '<section class="q" data-q="' + q.key + '"><h2>' + esc(q.title) + '</h2><p class="help">' + esc(q.help) + '</p>';
    if(q.mock) h += '<div class="mock" aria-hidden="true"><div class="strip"><span><b>Today</b> &nbsp;Example date · example anniversary</span><span>›</span></div><div class="tiles"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="cap">Illustration of the slim "Today" line. The text is a placeholder.</div></div>';
    q.opts.forEach(function(o){
      h += '<label class="o"><input type="' + type + '" name="' + q.key + '" value="' + esc(o[0]) + '"><span>' + esc(o[0]) + (o[1] ? '<small>' + esc(o[1]) + '</small>' : '') + '</span></label>';
    });
    if(q.other) h += '<label class="o"><input type="' + type + '" name="' + q.key + '" value="Other"><span>Other</span></label><input type="text" id="sv-' + q.key + '-other" maxlength="300" placeholder="' + esc(q.other) + '" hidden>';
    return h + '<p class="err" hidden></p></section>';
  }

  window.openSurvey = function(){
    if(!document.getElementById('sv-css')){ var st = document.createElement('style'); st.id = 'sv-css'; st.textContent = CSS; document.head.appendChild(st); }
    document.documentElement.classList.remove('is-home');
    var root = document.getElementById('app');
    root.innerHTML = '<div class="sv"><div class="eyebrow">Sacred Texts</div><h1>A calendar for the app</h1>'
      + '<p class="lede">We are thinking of adding a calendar to the front page that shows dates such as the births and deaths of shaykhs and scholars, pulled from the Biographies and Silsila sections as people are added. It would not replace or change the existing tiles. Four short questions, about two minutes.</p>'
      + '<form id="sv-form" novalidate style="display:flex;flex-direction:column;gap:1rem">' + QUESTIONS.map(qHTML).join('')
      + '<section class="q"><h2>Anything else?</h2><p class="help">Optional. Other things you would want from the calendar, or any concerns.</p><textarea id="sv-comment" maxlength="2000" aria-label="Comments"></textarea><input type="text" id="sv-name" maxlength="80" placeholder="Your name (optional)" aria-label="Your name"></section>'
      + '<div><button type="submit" id="sv-submit">Submit answers</button><p class="err" id="sv-err" hidden></p></div></form>'
      + '<section class="q thanks" id="sv-done" hidden><h2>Thank you</h2><p class="help">Your answers have been sent.</p><button type="button" class="quiet" id="sv-open">Open the app</button></section></div>';
    window.scrollTo(0, 0);
    var form = document.getElementById('sv-form');
    form.addEventListener('change', function(){
      QUESTIONS.forEach(function(q){ if(q.other){ var el = document.getElementById('sv-' + q.key + '-other'); el.hidden = !form.querySelector('input[name=' + q.key + '][value=Other]:checked'); } });
    });
    document.getElementById('sv-open').addEventListener('click', function(){
      try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}
      selectTab('home');
    });
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var answers = {}, bad = false;
      QUESTIONS.forEach(function(q){
        var sec = form.querySelector('[data-q=' + q.key + ']'), err = sec.querySelector('.err');
        var picked = [].map.call(form.querySelectorAll('input[name=' + q.key + ']:checked'), function(e){ return e.value; });
        answers[q.key] = q.type === 'one' ? (picked[0] || null) : picked;
        if(q.other){ var t = document.getElementById('sv-' + q.key + '-other').value.trim(); if(t) answers[q.key + 'Other'] = t; }
        var missing = q.type === 'one' ? !picked[0] : !picked.length;
        err.hidden = !missing; err.textContent = missing ? 'Please choose an answer.' : '';
        if(missing) bad = true;
      });
      var errEl = document.getElementById('sv-err'); errEl.hidden = true;
      if(bad){ errEl.hidden = false; errEl.textContent = 'Some questions still need an answer.'; return; }
      var comment = document.getElementById('sv-comment').value.trim(); if(comment) answers.comment = comment;
      var cid = clientId(); if(cid) answers.client = cid;
      var name = document.getElementById('sv-name').value.trim();
      var btn = document.getElementById('sv-submit'); btn.disabled = true;
      var cfg = (typeof SESSION_CONFIG !== 'undefined') ? SESSION_CONFIG : null;
      if(!cfg || !cfg.url || !cfg.key){ btn.disabled = false; errEl.hidden = false; errEl.textContent = 'Sending is not set up in this copy of the app.'; return; }
      fetch(cfg.url + '/rest/v1/survey_responses', {
        method: 'POST',
        headers: { 'apikey': cfg.key, 'Authorization': 'Bearer ' + cfg.key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ survey: SURVEY, name: name || null, answers: answers })
      }).then(function(r){
        if(!r.ok) throw new Error('HTTP ' + r.status);
        form.hidden = true; document.getElementById('sv-done').hidden = false; window.scrollTo(0, 0);
      }).catch(function(){
        btn.disabled = false; errEl.hidden = false;
        errEl.textContent = 'That did not send. Check your connection and try again. Your answers are still here.';
      });
    });
  };

  window.maybeOpenSurvey = function(){ if(/(^|[#&?])survey(=|&|$)/.test(location.hash || '')) window.openSurvey(); };
  window.addEventListener('hashchange', window.maybeOpenSurvey);
})();
