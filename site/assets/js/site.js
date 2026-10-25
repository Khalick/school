/* Olive International Schools — site behaviour (no dependencies) */
(function () {
  'use strict';

  var WHATSAPP = '254796042535';
  var EMAIL = 'oliveschool946@gmail.com';
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  /* header: solid once the page has scrolled (on the home page it starts over the photograph) */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 24); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* mobile menu */
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    };
    toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 1220) setOpen(false); });
  }

  var motion = !reduceMotion && 'IntersectionObserver' in window && 'requestAnimationFrame' in window;
  if (motion) root.classList.add('js-motion');

  /* headings are split into words so they can rise in one after another */
  var splitWords = function (el) {
    var i = 0;
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        var frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var outer = document.createElement('span'), inner = document.createElement('span');
          outer.className = 'w'; inner.textContent = part; inner.style.setProperty('--i', i++);
          outer.appendChild(inner); frag.appendChild(outer);
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === 1 && node.tagName !== 'BR') {
        var o = document.createElement('span'), n = document.createElement('span');
        o.className = 'w'; n.style.setProperty('--i', i++);
        node.parentNode.replaceChild(o, node); n.appendChild(node); o.appendChild(n);
      }
    });
  };
  if (motion) {
    document.querySelectorAll('main h1, main h2, .motto-line').forEach(function (h) {
      if (h.closest('.feature-card, .form, aside, .glance, .lost, .apply-success')) return;
      if (h.classList.contains('motto-line')) { h.querySelectorAll('span').forEach(splitWords); }
      else splitWords(h);
      if (!h.closest('[data-reveal]')) h.setAttribute('data-reveal', '');
    });
  }

  /* key dates: each date carries its months (data-from, data-until), so the timeline marks
     the dates that have passed and the one happening now, or next, and stays right as time goes on */
  var today = new Date();
  var thisMonth = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2);
  document.querySelectorAll('.dates').forEach(function (list) {
    var marked = false;
    list.querySelectorAll('li').forEach(function (li, i) {
      li.style.setProperty('--i', i);
      var from = li.getAttribute('data-from'), until = li.getAttribute('data-until');
      if (!from || !until) return;
      li.classList.remove('is-now', 'is-next', 'is-past');
      if (until < thisMonth) li.classList.add('is-past');
      else if (!marked) { li.classList.add(from <= thisMonth ? 'is-now' : 'is-next'); marked = true; }
    });
  });

  /* arrival: blocks rise in as they enter the screen and leave again when scrolled past,
     coming back from whichever direction the visitor is scrolling */
  var reveal = document.querySelectorAll('[data-reveal]');
  if (motion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (entry.isIntersecting) { el.classList.add('is-in'); }
        else {
          el.classList.remove('is-in');
          el.setAttribute('data-from', entry.boundingClientRect.top < 0 ? 'above' : 'below');
        }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    reveal.forEach(function (el) {
      /* neighbours arrive one after another rather than as a single block */
      var sibs = el.parentElement ? el.parentElement.querySelectorAll(':scope > [data-reveal]') : [];
      var idx = Array.prototype.indexOf.call(sibs, el);
      if (idx > 0) el.style.transitionDelay = Math.min(idx, 4) * 90 + 'ms';
      io.observe(el);
    });
  } else {
    reveal.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* scroll engine: tells each moving element where it sits on the screen (--p, --d).
     Values glide towards their targets with a little inertia, so movement stays smooth
     with a mouse wheel, a trackpad or a finger, and plays backwards when scrolling up. */
  if (motion) {
    var heroEl = document.querySelector('.hero');
    var EASE = window.matchMedia('(max-width: 760px)').matches ? 0.16 : 0.1;
    var tracked = Array.prototype.slice.call(document.querySelectorAll(
      'main h2, .photo:not(.hero-photo), .quarters, .pathway, .feature-card, .motto, .wordband, .rule-gold, .programme, .steps li, .trio > div, .has-branch'
    )).filter(function (el) { return !el.closest('.side > :first-child, .feature-card h2, .form, aside, .apply-success'); })
      .map(function (el) { return { el: el, top: 0, h: 0, p: null, d: null }; });
    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
    var docTop = function (el) { var t = 0; while (el) { t += el.offsetTop; el = el.offsetParent; } return t; };
    var measure = function () {
      tracked.forEach(function (t) { t.top = docTop(t.el); t.h = t.el.offsetHeight; });
    };
    var hsCur = null, scrollCur = null, running = false;
    var frame = function () {
      var vh = window.innerHeight, y = window.scrollY, moving = false;
      for (var k = 0; k < tracked.length; k++) {
        var t = tracked[k];
        var top = t.top - y;
        if (top + t.h < -vh * 0.6 || top > vh * 1.6) { continue; }
        var target = clamp(((top + t.h / 2) - vh / 2) / (vh / 2 + t.h / 2), -1, 1);
        if (t.p === null) t.p = target;
        var diff = target - t.p;
        if (Math.abs(diff) > 0.0004) { t.p += diff * EASE; moving = true; } else t.p = target;
        var d = clamp((1 - t.p) * 1.35, 0, 1);
        if (t.lp === undefined || Math.abs(t.p - t.lp) > 0.0002) { t.el.style.setProperty('--p', t.p.toFixed(4)); t.lp = t.p; }
        if (t.d === null || Math.abs(d - t.d) > 0.0002) { t.el.style.setProperty('--d', d.toFixed(4)); t.d = d; }
      }
      if (heroEl) {
        var hs = Math.min(y, heroEl.offsetHeight);
        if (hsCur === null) hsCur = hs;
        if (Math.abs(hs - hsCur) > 0.3) { hsCur += (hs - hsCur) * EASE * 1.4; moving = true; } else hsCur = hs;
        heroEl.style.setProperty('--hs', hsCur.toFixed(1) + 'px');
        heroEl.style.setProperty('--hs-n', Math.min(hsCur / 300, 1).toFixed(3));
      }
      if (header) {
        var max = document.documentElement.scrollHeight - vh;
        var s = max > 0 ? y / max : 0;
        if (scrollCur === null) scrollCur = s;
        if (Math.abs(s - scrollCur) > 0.0005) { scrollCur += (s - scrollCur) * 0.2; moving = true; } else scrollCur = s;
        header.style.setProperty('--scroll', scrollCur.toFixed(4));
      }
      if (moving) window.requestAnimationFrame(frame); else running = false;
    };
    var kick = function () { if (!running) { running = true; window.requestAnimationFrame(frame); } };
    var remeasure = function () { measure(); kick(); };
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', remeasure);
    window.addEventListener('load', remeasure);
    document.addEventListener('toggle', remeasure, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    measure();
    running = true; frame();
  }

  /* hero slideshow: a slow cross-fade between photographs, with a pause button */
  var slideshow = document.querySelector('[data-slides]');
  if (slideshow) {
    var hero = slideshow.closest('.hero-photo');
    var slides = slideshow.querySelectorAll('img');
    var dots = hero.querySelectorAll('.hero-dot');
    var pause = hero.querySelector('.hero-pause');
    var count = hero.querySelector('[data-count]');
    var SLIDE_TIME = 7000;
    var current = 0, timer = null, paused = reduceMotion;
    hero.style.setProperty('--slide-time', SLIDE_TIME + 'ms');

    var show = function (i) {
      current = (i + slides.length) % slides.length;
      slides.forEach(function (img, n) { img.classList.toggle('is-active', n === current); });
      dots.forEach(function (d, n) {
        d.classList.remove('is-active');
        d.removeAttribute('aria-current');
        if (n === current) { void d.offsetWidth; d.classList.add('is-active'); d.setAttribute('aria-current', 'true'); }
      });
      if (count) count.textContent = ('0' + (current + 1)).slice(-2);
    };
    var schedule = function () {
      clearTimeout(timer);
      if (!paused && !document.hidden) timer = setTimeout(function () { show(current + 1); schedule(); }, SLIDE_TIME);
    };
    var setPaused = function (p) {
      paused = p;
      hero.classList.toggle('is-paused', p);
      if (pause) {
        pause.setAttribute('aria-pressed', String(p));
        pause.setAttribute('aria-label', p ? 'Play the slideshow' : 'Pause the slideshow');
      }
      schedule();
    };
    dots.forEach(function (d, n) { d.addEventListener('click', function () { show(n); schedule(); }); });
    if (pause) pause.addEventListener('click', function () { setPaused(!paused); });
    document.addEventListener('visibilitychange', schedule);
    setPaused(paused);
  }

  /* enquiry form: writes the message for WhatsApp (or email); nothing is stored */
  var form = document.getElementById('enquiry-form');
  if (form) {
    /* arriving from the KCSE page: pre-select the KCSE option */
    if (/[?&]programme=kcse(&|$)/.test(window.location.search)) {
      var kcse = form.querySelector('input[value="KCSE private candidate"]');
      if (kcse) kcse.checked = true;
    }
    var compose = function () {
      var d = new FormData(form);
      var val = function (k) { return (d.get(k) || '').toString().trim(); };
      var lines = ['Hello Olive International Schools,', ''];
      if (val('parent')) lines.push('My name is ' + val('parent') + '.');
      if (val('child') || val('age')) {
        lines.push('I am enquiring for ' + (val('child') || 'my child') + (val('age') ? ' (age ' + val('age') + ')' : '') + '.');
      }
      if (val('level')) lines.push('Programme: ' + val('level') + '.');
      if (val('message')) { lines.push(''); lines.push(val('message')); }
      if (val('phone')) { lines.push(''); lines.push('My phone number is ' + val('phone') + '.'); }
      lines.push('', 'Thank you.');
      return lines.join('\n');
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(compose()), '_blank', 'noopener');
    });
    var mail = document.getElementById('send-email');
    if (mail) {
      mail.addEventListener('click', function () {
        if (!form.reportValidity()) return;
        window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Admissions enquiry') + '&body=' + encodeURIComponent(compose());
      });
    }
  }

  /* fees: a switch for the study mode. Each card then shows one price, and the prices roll
     to the new figure when the mode changes. Without JavaScript all three prices are listed.
     Links such as /admissions?mode=online#fees open on that mode. */
  var rateSwitch = document.querySelector('.rate-switch');
  var rateCards = document.querySelector('.rates');
  if (rateSwitch && rateCards) {
    var modeButtons = Array.prototype.slice.call(rateSwitch.querySelectorAll('button[data-mode]'));
    var money = function (n) { return 'KSh ' + Math.round(n).toLocaleString('en-US'); };
    var mode = null;
    rateCards.querySelectorAll('dd b').forEach(function (b) { b.setAttribute('data-value', b.textContent.replace(/\D/g, '')); });

    var placeMarker = function () {
      var on = rateSwitch.querySelector('[aria-pressed="true"]');
      if (!on) return;
      rateSwitch.style.setProperty('--x', on.offsetLeft + 'px');
      rateSwitch.style.setProperty('--w', on.offsetWidth + 'px');
    };
    var roll = function (b, from, to) {
      var t0 = null;
      var step = function (now) {
        if (t0 === null) t0 = now;
        var k = Math.min((now - t0) / 650, 1), eased = 1 - Math.pow(1 - k, 3);
        b.textContent = money(Math.round((from + (to - from) * eased) / 1000) * 1000);
        if (k < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };
    var setMode = function (next, animate) {
      var prev = mode;
      mode = next;
      modeButtons.forEach(function (btn) { btn.setAttribute('aria-pressed', String(btn.getAttribute('data-mode') === next)); });
      placeMarker();
      rateCards.querySelectorAll('.rate-card').forEach(function (card) {
        var row = card.querySelector('dl > [data-mode="' + next + '"]');
        if (!row) return;
        card.querySelectorAll('dl > div').forEach(function (r) { r.hidden = r !== row; });
        var b = row.querySelector('b'), to = +b.getAttribute('data-value');
        var old = prev && card.querySelector('dl > [data-mode="' + prev + '"] b');
        if (!animate || !old || reduceMotion) { b.textContent = money(to); return; }
        row.classList.remove('is-rolling'); void row.offsetWidth; row.classList.add('is-rolling');
        roll(b, +old.getAttribute('data-value'), to);
      });
    };

    modeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () { if (btn.getAttribute('data-mode') !== mode) setMode(btn.getAttribute('data-mode'), true); });
    });
    var askedMode = (window.location.search.match(/[?&]mode=([a-z]+)/) || [])[1];
    rateSwitch.hidden = false;
    rateCards.classList.add('is-switched');
    setMode(modeButtons.some(function (b) { return b.getAttribute('data-mode') === askedMode; }) ? askedMode : 'homeschooling', false);
    window.addEventListener('resize', placeMarker);
    window.addEventListener('load', placeMarker);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeMarker);
  }

  /* application form (/apply): three short steps, then the application is sent to the
     school's Google Apps Script, which saves it to a Google Sheet, stores any documents
     in Google Drive and emails the school */
  var app = document.getElementById('application-form');
  if (app) {
    var endpoint = (app.getAttribute('data-endpoint') || '').trim();
    var configured = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(endpoint);
    var MAX_FILE = 5 * 1024 * 1024;
    var FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    var steps = Array.prototype.slice.call(app.querySelectorAll('.apply-step'));
    var dots = Array.prototype.slice.call(document.querySelectorAll('[data-step-dot]'));
    var stepper = document.querySelector('.stepper');
    var status = app.querySelector('.form-status');
    var submitBtn = app.querySelector('button[type="submit"]');
    var success = document.getElementById('application-success');
    var current = 0;

    /* arriving from a programme link, e.g. /apply?programme=kcse */
    var wanted = (window.location.search.match(/[?&]programme=([a-z-]+)/) || [])[1];
    if (wanted) {
      var opt = app.querySelector('select[name="programme"] option[data-key="' + wanted + '"]');
      if (opt) opt.selected = true;
    }

    var say = function (html, kind) {
      status.className = 'form-status' + (kind ? ' is-' + kind : '');
      status.innerHTML = html;
    };

    var goTo = function (i, back) {
      current = i;
      steps.forEach(function (s, n) {
        s.hidden = n !== i;
        s.classList.toggle('from-back', !!back);
      });
      dots.forEach(function (d, n) {
        d.classList.toggle('is-active', n === i);
        d.classList.toggle('is-done', n < i);
        if (n === i) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
      if (stepper) stepper.style.setProperty('--progress', i / (steps.length - 1));
      say('');
      var title = steps[i].querySelector('.step-title');
      var top = stepper.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 16;
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
      if (title) title.focus({ preventScroll: true });
    };

    /* checks only the fields in one step, and points to the first one that needs attention */
    var stepValid = function (i) {
      var step = steps[i];
      var fields = Array.prototype.slice.call(step.querySelectorAll('input, select, textarea'));
      var bad = fields.filter(function (f) { return !f.checkValidity(); });
      step.classList.add('was-validated');
      if (!bad.length) return true;
      var label = step.querySelector('label[for="' + bad[0].id + '"]');
      say('Please complete: ' + bad.map(function (f) {
        var l = step.querySelector('label[for="' + f.id + '"]');
        return l ? l.textContent.replace('*', '').trim() : (f.name === 'confirm' ? 'the declaration' : f.name);
      }).filter(function (v, n, a) { return a.indexOf(v) === n; }).join(', ') + '.', 'error');
      bad[0].focus();
      return false;
    };

    app.querySelectorAll('[data-next]').forEach(function (btn) {
      btn.addEventListener('click', function () { if (stepValid(current)) goTo(current + 1); });
    });
    app.querySelectorAll('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', function () { goTo(current - 1, true); });
    });

    /* show the chosen file's name, and reject files that are too big or the wrong type */
    var checkFile = function (input) {
      var box = input.closest('.file'), label = box.querySelector('.file-name');
      var f = input.files && input.files[0];
      box.classList.remove('has-file', 'has-error');
      input.setCustomValidity('');
      if (!f) { label.textContent = label.getAttribute('data-empty'); return; }
      if (FILE_TYPES.indexOf(f.type) === -1) {
        input.setCustomValidity('Please choose a PDF or a photo (JPG, PNG or WebP).');
        box.classList.add('has-error'); label.textContent = 'Please choose a PDF or a photo'; return;
      }
      if (f.size > MAX_FILE) {
        input.setCustomValidity('This file is larger than 5 MB.');
        box.classList.add('has-error'); label.textContent = f.name + ' is larger than 5 MB'; return;
      }
      box.classList.add('has-file'); label.textContent = f.name;
    };
    app.querySelectorAll('input[type="file"]').forEach(function (input) {
      input.addEventListener('change', function () { checkFile(input); });
    });

    var readFile = function (input) {
      return new Promise(function (resolve, reject) {
        var f = input.files && input.files[0];
        if (!f) { resolve(null); return; }
        var r = new FileReader();
        r.onload = function () {
          resolve({ field: input.name, name: f.name, type: f.type, data: String(r.result).split(',')[1] || '' });
        };
        r.onerror = function () { reject(new Error('Could not read ' + f.name)); };
        r.readAsDataURL(f);
      });
    };

    var collect = function () {
      var d = new FormData(app), out = {};
      d.forEach(function (v, k) { if (typeof v === 'string') out[k] = v.trim(); });
      out.submittedFrom = window.location.href;
      return out;
    };

    var summary = function (data) {
      var rows = [
        ['Student', data.studentName], ['Student email', data.studentEmail], ['Date of birth', data.dateOfBirth], ['Gender', data.gender],
        ['Current class or grade', data.currentLevel], ['Programme', data.programme], ['Mode of study', data.studyOption],
        ['Subjects', data.subjects], ['Parent or guardian', data.parentName], ['Phone', data.parentPhone], ['Email', data.parentEmail]
      ];
      return 'Hello Olive International Schools,\n\nI would like to apply.\n\n' +
        rows.filter(function (r) { return r[1]; }).map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') + '\n\nThank you.';
    };
    var fallbackLinks = function (data) {
      var text = summary(data);
      return '<a href="mailto:' + EMAIL + '?subject=' + encodeURIComponent('Application: ' + (data.studentName || '')) +
        '&body=' + encodeURIComponent(text) + '">email</a> or <a href="https://wa.me/' + WHATSAPP + '?text=' +
        encodeURIComponent(text) + '" target="_blank" rel="noopener">WhatsApp</a>';
    };

    app.addEventListener('submit', function (e) {
      e.preventDefault();
      /* pressing Enter on an earlier step moves to the next step instead of submitting */
      if (current < steps.length - 1) { if (stepValid(current)) goTo(current + 1); return; }
      for (var i = 0; i < steps.length; i++) {
        if (!steps[i].querySelector(':invalid')) continue;
        if (i !== current) goTo(i);
        stepValid(i);
        return;
      }
      var data = collect();

      if (!configured) {
        /* the Google Apps Script address has not been added yet: offer email or WhatsApp instead */
        say('Online applications are being set up. Please send your application by ' + fallbackLinks(data) + ' instead.', 'info');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      say('Sending your application. Please keep this page open.', 'info');

      var inputs = Array.prototype.slice.call(app.querySelectorAll('input[type="file"]'));
      Promise.all(inputs.map(readFile))
        .then(function (files) {
          data.files = files.filter(Boolean);
          /* sent as plain text so the browser does not need a CORS preflight; Apps Script reads the JSON body */
          return fetch(endpoint, { method: 'POST', body: JSON.stringify(data), redirect: 'follow' });
        })
        .then(function (res) { return res.json(); })
        .then(function (result) {
          if (!result || !result.ok) throw new Error((result && result.error) || 'The application could not be saved.');
          success.querySelector('[data-ref]').textContent = result.ref;
          var sentTo = data.parentEmail;
          if (data.studentEmail && data.studentEmail.toLowerCase() !== data.parentEmail.toLowerCase()) sentTo += ' and ' + data.studentEmail;
          success.querySelector('[data-email]').textContent = sentTo;
          app.hidden = true;
          if (stepper) stepper.hidden = true;
          success.hidden = false;
          var top = success.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 24;
          window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
          success.focus({ preventScroll: true });
        })
        .catch(function () {
          say('Sorry, your application could not be sent. Please try again, or send it by ' + fallbackLinks(data) + '.', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit application';
        });
    });
  }

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
