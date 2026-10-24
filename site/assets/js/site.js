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
      if (h.closest('.feature-card, .form, aside, .glance, .lost')) return;
      if (h.classList.contains('motto-line')) { h.querySelectorAll('span').forEach(splitWords); }
      else splitWords(h);
      if (!h.closest('[data-reveal]')) h.setAttribute('data-reveal', '');
    });
  }

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
      'main h2, .photo:not(.hero-photo), .quarters, .pathway, .feature-card, .motto, .wordband, .rule-gold, .programme, .steps li, .trio > div'
    )).filter(function (el) { return !el.closest('.side > :first-child, .feature-card h2, .form, aside'); })
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

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
