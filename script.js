/* ============================================================
   Box Box — JavaScript global
   - Menu mobile
   - Animations au scroll (IntersectionObserver)
   - Filtre catalogue (luxe.html)
   - Filtres marketplace
   - Simulateur de financement
   - Gestion des formulaires (feedback)
   ============================================================ */

(function () {
  'use strict';

  /* -------- 0. Préloader (écran de chargement animé) -------- */
  function initPreloader() {
    var pl = document.getElementById('preloader');
    if (!pl) return;

    // Affiché une seule fois par session : ignoré sur les pages suivantes
    var firstVisit = true;
    try { firstVisit = !sessionStorage.getItem('bb_seen'); } catch (e) {}
    if (!firstVisit) {
      pl.classList.add('is-skipped');
      return;
    }
    try { sessionStorage.setItem('bb_seen', '1'); } catch (e) {}

    document.body.classList.add('is-loading');

    var start = Date.now();
    var MIN_MS = 1700; // durée minimale d'affichage pour laisser jouer l'animation

    function hide() {
      var wait = Math.max(0, MIN_MS - (Date.now() - start));
      setTimeout(function () {
        pl.classList.add('is-done');
        document.body.classList.remove('is-loading');
      }, wait);
    }

    if (document.readyState === 'complete') {
      hide();
    } else {
      window.addEventListener('load', hide);
    }

    // Filet de sécurité : ne jamais bloquer la page
    setTimeout(function () {
      pl.classList.add('is-done');
      document.body.classList.remove('is-loading');
    }, 5000);
  }

  /* -------- 0b. Nav : état au scroll -------- */
  function initNavScroll() {
    var nav = document.querySelector('.nav');
    if (!nav) return;
    var onScroll = function () {
      nav.classList.toggle('nav--scrolled', window.scrollY > 20);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* -------- 0c. Compteurs animés -------- */
  function initCounters() {
    var nums = document.querySelectorAll('.stat__num');
    if (!nums.length || !('IntersectionObserver' in window)) return;

    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    function animate(el) {
      var text = el.textContent.trim();
      var m = text.match(/^([\d\s ]+)/);
      if (!m) return;
      var target = parseInt(m[1].replace(/[\s ]/g, ''), 10);
      if (isNaN(target)) return;
      var suffix = text.slice(m[1].length);

      var dur = 1500, t0 = null;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('fr-FR') + suffix;
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target.toLocaleString('fr-FR') + suffix;
      }
      requestAnimationFrame(step);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animate(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    nums.forEach(function (n) { io.observe(n); });
  }

  /* -------- 0e. Porte d'entrée (gate) -------- */
  function initGate() {
    var gate = document.getElementById('gate');
    if (!gate) return;

    // La vidéo d'entrée joue à CHAQUE arrivée sur l'accueil.
    document.body.classList.add('is-loading');
    var btn = document.getElementById('gateEnter');

    function open() {
      try { sessionStorage.setItem('bb_seen', '1'); } catch (e) {} // évite le préloader sur les pages suivantes
      gate.classList.add('is-open');
      document.body.classList.remove('is-loading');
      setTimeout(function () { gate.classList.add('is-removed'); }, 1500);
    }

    if (btn) btn.addEventListener('click', function (e) { e.stopPropagation(); open(); });

    // La vidéo d'entrée : entrer automatiquement à la fin, ou au clic sur la scène
    var vid = document.getElementById('gateVideo');
    if (vid) {
      vid.addEventListener('ended', function () {
        setTimeout(open, 400);
      });
      // relance la lecture si l'autoplay est bloqué
      var p = vid.play();
      if (p && p.catch) p.catch(function () {});
    }
    gate.addEventListener('click', function (e) {
      if (e.target === btn) return;
      open();
    });

    // touche Entrée / Espace pour entrer aussi
    document.addEventListener('keydown', function (e) {
      if (!gate.classList.contains('is-open') &&
          (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); }
    });
  }

  /* -------- 0f. Barre de progression de lecture -------- */
  function initScrollProgress() {
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);
    var update = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? (h.scrollTop || window.scrollY) / max : 0;
      bar.style.width = (p * 100) + '%';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* -------- 0g. Bouton retour en haut -------- */
  function initBackToTop() {
    var btn = document.createElement('button');
    btn.className = 'to-top';
    btn.setAttribute('aria-label', 'Retour en haut');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    document.body.appendChild(btn);
    var toggle = function () {
      btn.classList.toggle('is-visible', (window.scrollY || 0) > 600);
    };
    toggle();
    window.addEventListener('scroll', toggle, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* -------- 0d. Transitions entre pages -------- */
  function initPageTransitions() {
    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    document.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var a = e.target.closest('a');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || a.target === '_blank') return;
      if (href.charAt(0) === '#' ||
          href.indexOf('tel:') === 0 ||
          href.indexOf('mailto:') === 0 ||
          href.indexOf('http') === 0 ||
          href.indexOf('//') === 0) return;
      if (!/\.html(\?|#|$)/.test(href)) return;

      e.preventDefault();
      document.body.classList.add('page-leaving');
      setTimeout(function () { window.location.href = href; }, 340);
    });
  }

  /* -------- 0h. Album catalogue interactif -------- */
  function initCatalogue() {
    var el = document.getElementById('album');
    if (!el) return;
    var count = parseInt(el.dataset.count, 10);
    var base = el.dataset.base, ext = el.dataset.ext || 'jpg';
    var img = document.getElementById('albumImg');
    var cur = document.getElementById('albumCur');
    var thumbs = document.getElementById('albumThumbs');
    var lb = document.getElementById('albumLightbox');
    var lbImg = document.getElementById('albumLightboxImg');
    var i = 0;

    function pad(n) { return String(n + 1).padStart(2, '0'); }
    function src(n) { return base + pad(n) + '.' + ext; }

    for (var k = 0; k < count; k++) {
      (function (k) {
        var t = document.createElement('img');
        t.className = 'album__thumb';
        t.loading = 'lazy';
        t.src = src(k);
        t.alt = 'Page ' + (k + 1);
        t.addEventListener('click', function () { go(k); });
        thumbs.appendChild(t);
      })(k);
    }

    function go(n) {
      i = (n + count) % count;
      img.classList.add('is-fading');
      setTimeout(function () {
        img.src = src(i);
        img.classList.remove('is-fading');
      }, 180);
      cur.textContent = pad(i);
      var ts = thumbs.children;
      for (var j = 0; j < ts.length; j++) ts[j].classList.toggle('is-active', j === i);
      if (ts[i]) ts[i].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }

    function openLb() { lbImg.src = src(i); lb.classList.add('is-open'); }
    function closeLb() { lb.classList.remove('is-open'); }

    document.getElementById('albumPrev').addEventListener('click', function () { go(i - 1); });
    document.getElementById('albumNext').addEventListener('click', function () { go(i + 1); });
    document.getElementById('albumViewer').addEventListener('click', openLb);
    document.getElementById('albumZoom').addEventListener('click', openLb);
    document.getElementById('albumClose').addEventListener('click', closeLb);
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'Escape') closeLb();
    });

    var sx = null, stage = document.getElementById('albumViewer');
    stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1);
      sx = null;
    });

    go(0);
  }

  /* -------- 0i. Connexion Club -------- */
  function initClubLogin() {
    var form = document.getElementById('clubLogin');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      try { sessionStorage.setItem('bb_member', '1'); } catch (e) {}
      window.location.href = 'club-espace.html';
    });
  }

  /* -------- 0j. Galerie membres (lightbox) -------- */
  function initGallery() {
    var g = document.getElementById('gallery');
    if (!g) return;
    var lb = document.getElementById('galLightbox');
    var lbImg = document.getElementById('galLightboxImg');
    var close = document.getElementById('galClose');
    if (!lb) return;
    g.querySelectorAll('img').forEach(function (im) {
      im.addEventListener('click', function () {
        lbImg.src = im.src;
        lb.classList.add('is-open');
      });
    });
    function hide() { lb.classList.remove('is-open'); }
    lb.addEventListener('click', function (e) { if (e.target !== lbImg) hide(); });
    if (close) close.addEventListener('click', hide);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  }

  /* -------- 0k. Recherche dans la collection -------- */
  function initCarSearch() {
    var input = document.getElementById('carSearch');
    var wrap = document.querySelector('[data-filter-target="cars"]');
    if (!wrap) return;
    var group = document.querySelector('[data-filter-group="cars"]');
    var items = wrap.querySelectorAll('[data-cat]');
    var countEl = document.querySelector('[data-filter-count="cars"]');

    function activeCat() {
      var a = group && group.querySelector('.chip.is-active');
      return a ? a.getAttribute('data-value') : 'all';
    }
    function apply() {
      var q = (input && input.value || '').trim().toLowerCase();
      var cat = activeCat();
      var n = 0;
      items.forEach(function (it) {
        var cats = (it.getAttribute('data-cat') || '').split('|');
        var okCat = cat === 'all' || cats.indexOf(cat) !== -1;
        var h3 = it.querySelector('h3');
        var name = (h3 ? h3.textContent : '').toLowerCase();
        var okQ = !q || name.indexOf(q) !== -1;
        var show = okCat && okQ;
        it.classList.toggle('is-hidden', !show);
        if (show) n++;
      });
      if (countEl) countEl.textContent = n;
    }

    if (input) input.addEventListener('input', apply);
    // Re-appliquer après un clic sur une catégorie (laisse initFilters poser .is-active)
    if (group) group.querySelectorAll('.chip').forEach(function (ch) {
      ch.addEventListener('click', function () { setTimeout(apply, 0); });
    });
    // Pré-remplissage depuis l'URL (?q=...) venant de la page Location
    try {
      var q0 = new URLSearchParams(location.search).get('q');
      if (q0 && input) input.value = q0;
    } catch (e) {}
    apply();
  }

  /* -------- 1. Navigation mobile -------- */
  function initNav() {
    const nav = document.querySelector('.nav');
    const toggle = document.querySelector('.nav__toggle');
    if (!nav || !toggle) return;

    toggle.addEventListener('click', function () {
      nav.classList.toggle('is-open');
      const open = nav.classList.contains('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    // Fermer le menu au clic sur un lien
    nav.querySelectorAll('.nav__menu a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
      });
    });

    // Marquer le lien actif selon la page courante
    const here = location.pathname.split('/').pop() || 'index.html';
    nav.querySelectorAll('.nav__menu a').forEach(function (a) {
      const href = a.getAttribute('href');
      if (href === here) a.classList.add('is-active');
    });
  }

  /* -------- 2. Animations au scroll -------- */
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    els.forEach(function (el) { io.observe(el); });
  }

  /* -------- 3. Filtre catalogue (luxe.html) + résultats marketplace -------- */
  function initFilters() {
    document.querySelectorAll('[data-filter-group]').forEach(function (group) {
      const target = group.getAttribute('data-filter-group');
      const items = document.querySelectorAll('[data-filter-target="' + target + '"] [data-cat]');
      const countEl = document.querySelector('[data-filter-count="' + target + '"]');

      function apply(value) {
        let visible = 0;
        items.forEach(function (item) {
          const cats = (item.getAttribute('data-cat') || '').split('|');
          const show = value === 'all' || cats.indexOf(value) !== -1;
          item.classList.toggle('is-hidden', !show);
          if (show) visible++;
        });
        if (countEl) countEl.textContent = visible;
      }

      group.querySelectorAll('.chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          group.querySelectorAll('.chip').forEach(function (c) {
            c.classList.remove('is-active');
          });
          chip.classList.add('is-active');
          apply(chip.getAttribute('data-value'));
        });
      });
    });
  }

  /* -------- 4. Simulateur de financement -------- */
  function initSimulator() {
    const sim = document.querySelector('[data-sim]');
    if (!sim) return;

    const amount = sim.querySelector('#sim-amount');
    const months = sim.querySelector('#sim-months');
    const deposit = sim.querySelector('#sim-deposit');

    const amountOut  = sim.querySelector('#out-amount');
    const monthsOut  = sim.querySelector('#out-months');
    const depositOut = sim.querySelector('#out-deposit');
    const result     = sim.querySelector('#sim-result');
    const totalOut   = sim.querySelector('#sim-total');

    const TAEG = 0.0490; // taux indicatif annuel

    function fmt(n) {
      return Math.round(n).toLocaleString('fr-FR');
    }

    function compute() {
      const principalTotal = Number(amount.value);
      const n = Number(months.value);
      const depPct = Number(deposit.value);

      const depositValue = principalTotal * (depPct / 100);
      const financed = principalTotal - depositValue;

      const r = TAEG / 12;
      let monthly;
      if (r === 0) {
        monthly = financed / n;
      } else {
        monthly = financed * r / (1 - Math.pow(1 + r, -n));
      }

      amountOut.textContent  = fmt(principalTotal) + ' €';
      monthsOut.textContent  = n + ' mois';
      depositOut.textContent = depPct + ' % · ' + fmt(depositValue) + ' €';
      result.textContent     = fmt(monthly);
      if (totalOut) totalOut.textContent = fmt(monthly * n + depositValue) + ' €';
    }

    [amount, months, deposit].forEach(function (el) {
      if (el) el.addEventListener('input', compute);
    });
    compute();
  }

  /* -------- 6. Recherche comparateur (scroll vers résultats) -------- */
  function initSearch() {
    const search = document.querySelector('[data-search]');
    if (!search) return;
    search.addEventListener('submit', function (e) {
      e.preventDefault();
      const results = document.querySelector('#results');
      if (results) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* -------- Init -------- */
  document.addEventListener('DOMContentLoaded', function () {
    initGate();
    initPreloader();
    initCatalogue();
    initClubLogin();
    initGallery();
    initCarSearch();
    initPageTransitions();
    initScrollProgress();
    initBackToTop();
    initNavScroll();
    initCounters();
    initNav();
    initReveal();
    initFilters();
    initSimulator();
    initSearch();

    // Dates par défaut sur le comparateur
    const start = document.querySelector('#date-start');
    const end = document.querySelector('#date-end');
    if (start && end) {
      const today = new Date();
      const t3 = new Date(today.getTime() + 3 * 86400000);
      start.value = today.toISOString().slice(0, 10);
      end.value = t3.toISOString().slice(0, 10);
    }
  });
})();
