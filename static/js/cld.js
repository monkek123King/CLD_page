/* ============================================================
   CLD project page — interactive demos (static, pre-computed)
   ============================================================ */
(function () {
  'use strict';

  var BASE = 'static/demo';
  var LOCAL = window.location.protocol === 'file:';
  var offlineImages = null;
  var M = null;                      // manifest
  var byId = {};

  var ICON = {
    eye:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.1 10.1 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A10.1 10.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/></svg>',
    trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.1-5.6L3 10"/></svg>',
    dl:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>'
  };

  var PALETTE = ['#5a4be0','#00a7bd','#e0484b','#f2a104','#28b36b','#d64ba6',
                 '#4b8de0','#8c5be0','#e07a3c','#17a398','#c33c6d','#6fa800'];

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function q(sel, root) { return (root || document).querySelector(sel); }
  function fmtBox(b) {
    return Math.round(b[0] * 1024) + ',' + Math.round(b[1] * 1024) + '  ' +
           Math.round((b[2] - b[0]) * 1024) + '×' + Math.round((b[3] - b[1]) * 1024);
  }
  function layerName(c, k) { return k === 0 ? 'Background' : 'Layer ' + k; }
  function color(k) { return k === 0 ? '#8b92a6' : PALETTE[(k - 1) % PALETTE.length]; }

  /* deterministic RNG so the perturbation illustration is stable per reload */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  /* mirrors _quantize_boxes() in infer/app.py */
  function perturbBoxes(boxes, ratio, seed) {
    var r = rng(seed || 1);
    return boxes.map(function (b) {
      var x0 = b[0], y0 = b[1], x1 = b[2], y1 = b[3];
      if (ratio > 0) {
        var w = x1 - x0, h = y1 - y0;
        x0 -= r() * ratio * w; y0 -= r() * ratio * h;
        x1 += r() * ratio * w; y1 += r() * ratio * h;
      }
      return [Math.max(0, x0), Math.max(0, y0), Math.min(1, x1), Math.min(1, y1)];
    });
  }

  function caseTabs(host, onPick, initial) {
    var cur = initial || 0;
    M.cases.forEach(function (c, i) {
      var b = el('button', 'tab', 'Case ' + (i + 1));
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === cur ? 'true' : 'false');
      b.onclick = function () {
        cur = i;
        Array.prototype.forEach.call(host.children, function (x, j) {
          x.setAttribute('aria-selected', j === i ? 'true' : 'false');
        });
        onPick(M.cases[i]);
      };
      host.appendChild(b);
    });
    onPick(M.cases[cur]);
  }

  function svgBoxes(host, c, boxes, opts) {
    opts = opts || {};
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'box-svg');
    svg.setAttribute('viewBox', '0 0 1000 1000');
    svg.setAttribute('preserveAspectRatio', 'none');
    var rects = [];
    boxes.forEach(function (b, i) {
      var k = opts.skipBase ? i + 1 : i;
      if (k === 0) return;
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', b[0] * 1000); r.setAttribute('y', b[1] * 1000);
      r.setAttribute('width', Math.max(1, (b[2] - b[0]) * 1000));
      r.setAttribute('height', Math.max(1, (b[3] - b[1]) * 1000));
      r.setAttribute('stroke', opts.color || color(k));
      r.setAttribute('rx', 3);
      r.dataset.k = k;
      svg.appendChild(r);
      rects.push(r);
    });
    host.appendChild(svg);

    if (opts.labels) {
      boxes.forEach(function (b, i) {
        var k = opts.skipBase ? i + 1 : i;
        if (k === 0) return;
        var t = el('span', 'bnum', String(k));
        t.style.left = (b[0] * 100) + '%';
        t.style.top  = (b[1] * 100) + '%';
        t.style.background = opts.color || color(k);
        host.appendChild(t);
      });
    }
    return rects;
  }

  /* ========================================================
     1. Decomposition explorer
     ======================================================== */
  function buildExplorer() {
    var root = q('#explorer'); if (!root) return;
    var tabsHost = q('#exp-tabs');
    var imgHost  = q('#exp-canvas');
    var stack    = q('#exp-stack');
    var rail     = q('#exp-rail');
    var spread   = q('#exp-spread');
    var cap      = q('#exp-caption');
    var count    = q('#exp-count');
    var rects = [], plies = [], chips = [], hot = -1;

    function setHot(k) {
      hot = k;
      rects.forEach(function (r) { r.classList.toggle('on', +r.dataset.k === k); });
      plies.forEach(function (p, i) {
        p.classList.toggle('hot', i === k);
        p.classList.toggle('dim', k >= 0 && i !== k);
      });
      chips.forEach(function (ch, i) { ch.classList.toggle('on', i === k); });
    }

    function load(c) {
      imgHost.innerHTML = ''; stack.innerHTML = ''; rail.innerHTML = '';
      rects = []; plies = []; chips = []; hot = -1;
      var dir = BASE + '/case_' + c.id;

      var im = el('img');
      im.src = dir + (c.hasInput ? '/input.webp' : '/composite.webp');
      im.alt = 'Input raster image, case ' + c.id;
      imgHost.appendChild(im);
      rects = svgBoxes(imgHost, c, c.boxes.slice(1), { skipBase: true });
      rects.forEach(function (r) {
        r.onmouseenter = function () { setHot(+r.dataset.k); };
        r.onmouseleave = function () { setHot(-1); };
      });

      stack.style.setProperty('--spread', spread.value + 'px');
      c.boxes.forEach(function (b, k) {
        var d = el('div', 'ply' + (k === 0 ? ' base' : ''));
        d.style.setProperty('--i', k);
        var i2 = el('img');
        i2.src = dir + '/layers/L' + k + '.webp';
        i2.loading = 'lazy';
        i2.alt = layerName(c, k);
        d.appendChild(i2);
        d.onmouseenter = function () { setHot(k); };
        d.onmouseleave = function () { setHot(-1); };
        stack.appendChild(d); plies.push(d);

        var ch = el('div', 'chip');
        ch.innerHTML = '<div class="tn checker lite"><img loading="lazy" src="' + dir +
          '/thumb/L' + k + '.webp" alt=""></div><div class="meta"><div class="nm">' +
          layerName(c, k) + '</div><div class="sz">' + fmtBox(b) + '</div></div>';
        ch.onmouseenter = function () { setHot(k); };
        ch.onmouseleave = function () { setHot(-1); };
        rail.appendChild(ch); chips.push(ch);
      });

      count.textContent = (c.nFg + 1) + ' layers';
      cap.textContent = c.nFg + ' foreground layers + background';
    }

    spread.oninput = function () { stack.style.setProperty('--spread', spread.value + 'px'); };
    caseTabs(tabsHost, load);
  }

  /* ========================================================
     2. Mode A (detector) vs Mode B (user boxes)
     ======================================================== */
  function buildModes() {
    var root = q('#modes'); if (!root) return;
    var tabsHost = q('#mode-tabs');
    var aBox = q('#mode-a-canvas'), bBox = q('#mode-b-canvas');
    var aStrip = q('#mode-a-strip'), bStrip = q('#mode-b-strip');
    var note = q('#mode-note');


    function load(c) {
      var dir = BASE + '/case_' + c.id;
      var src = dir + (c.hasInput ? '/input.webp' : '/composite.webp');

      [[aBox, c.predBoxes, '#00a7bd'], [bBox, c.boxes.slice(1), null]].forEach(function (p) {
        p[0].innerHTML = '';
        var im = el('img'); im.src = src; im.alt = ''; p[0].appendChild(im);
        if (p[1]) svgBoxes(p[0], c, p[1], { skipBase: true, color: p[2], labels: true });
      });

      layerStrip(bStrip, dir, 'layers', c.nFg, 'Case ' + (c.n + 1) + ' · user boxes');
      if (c.nPred) layerStrip(aStrip, dir, 'pred', c.nPred, 'Case ' + (c.n + 1) + ' · detector boxes');
      else aStrip.innerHTML = '<p class="sz">No detector run for this case.</p>';

      note.innerHTML = '<span class="mode-summary">Automatic <b>' + c.nPred + ' regions</b></span>' +
        '<span class="mode-summary">User-defined <b>' + c.nFg + ' regions</b></span>' +
        '<span class="mode-caption">Same CLD model. Your boxes control the layer granularity.</span>';
    }
    caseTabs(tabsHost, load);
  }

  /* ========================================================
     3. Robustness to box perturbation
     ======================================================== */
  function buildRobust() {
    var root = q('#robust'); if (!root) return;
    var tabsHost = q('#rb-tabs');
    var canvas = q('#rb-canvas');
    var strip  = q('#rb-strip');
    var sl     = q('#rb-slider');
    var ticks  = q('#rb-ticks');
    var cur = null;
    var LEVELS = [0, 10, 20];

    LEVELS.forEach(function (v) { ticks.appendChild(el('span', '', v + '%')); });

    // Fit the largest square tiles into the space beside the input panel.
    function layoutLayers() {
      if (window.innerWidth <= 900) {
        strip.style.removeProperty('--rb-tile');
        return;
      }
      var count = strip.children.length;
      var width = strip.clientWidth, height = strip.clientHeight;
      if (!count || !width || !height) return;
      var size = 0, gap = 12;
      for (var n = 1; n <= count; n++) {
        var rows = Math.ceil(count / n);
        var candidate = Math.min((width - gap * (n - 1)) / n,
                                 (height - gap * (rows - 1)) / rows);
        if (candidate > size) size = candidate;
      }
      strip.style.setProperty('--rb-tile', Math.floor(size) + 'px');
    }
    var resizeObserver = new ResizeObserver(layoutLayers);
    resizeObserver.observe(strip);
    window.addEventListener('resize', layoutLayers);

    function render(lv) {
      if (!cur) return;
      var c = cur, dir = BASE + '/case_' + c.id;
      Array.prototype.forEach.call(ticks.children, function (s, i) {
        s.classList.toggle('on', LEVELS[i] === lv);
      });

      canvas.innerHTML = '';
      var im = el('img');
      im.src = dir + (c.hasInput ? '/input.webp' : '/composite.webp');
      im.alt = ''; canvas.appendChild(im);
      var pb = perturbBoxes(c.boxes.slice(1), lv / 100, c.id * 7 + 11);
      svgBoxes(canvas, c, pb, { skipBase: true, labels: true });

      var sub = lv === 0 ? 'layers' : 'p' + lv;
      layerStrip(strip, dir, sub, c.nFg,
                 'Case ' + (c.n + 1) + ' · ' + (lv === 0 ? 'exact boxes' : lv + '% box perturbation'));
      layoutLayers();
    }

    sl.oninput = function () { render(LEVELS[+sl.value]); };
    caseTabs(tabsHost, function (c) { cur = c; render(LEVELS[+sl.value]); });
  }

  /* ========================================================
     4. Design studio  (the PowerPoint-style editing surface)
     ======================================================== */
  function buildStudio() {
    var root = q('#studio'); if (!root) return;
    var tabsHost = q('#st-tabs');
    var board = q('#st-board');
    var list  = q('#st-list');
    var cur = null, objs = [], sel = -1;
    var marq, poly, tag, handles = {};

    var HANDLES = [
      { id:'nw', ax:0, ay:0, ang:135, corner:true  },
      { id:'n',  ax:.5, ay:0, ang:0,  corner:false },
      { id:'ne', ax:1, ay:0, ang:45,  corner:true  },
      { id:'e',  ax:1, ay:.5, ang:90, corner:false },
      { id:'se', ax:1, ay:1, ang:135, corner:true  },
      { id:'s',  ax:.5, ay:1, ang:0,  corner:false },
      { id:'sw', ax:0, ay:1, ang:45,  corner:true  },
      { id:'w',  ax:0, ay:.5, ang:90, corner:false }
    ];
    var OPP = { nw:'se', n:'s', ne:'sw', e:'w', se:'nw', s:'n', sw:'ne', w:'e' };
    var CURSORS = ['ns-resize','nesw-resize','ew-resize','nwse-resize'];

    function snapshot() {
      return objs.map(function (o) {
        return { k:o.k, tx:o.tx, ty:o.ty, sx:o.sx, sy:o.sy, rot:o.rot, vis:o.vis, dup:o.dup };
      });
    }
    var initial = [];

    function mk(c, k, dup) {
      return { k:k, tx:0, ty:0, sx:1, sy:1, rot:0, vis:true, dup:!!dup, box:c.boxes[k] };
    }

    /* ---- geometry: base (untransformed) coords <-> board coords ---- */
    function ctrOf(o) { var b = o.box; return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; }

    function anchorPt(o, h) {
      var b = o.box;
      return [b[0] + (b[2] - b[0]) * h.ax, b[1] + (b[3] - b[1]) * h.ay];
    }

    function fwd(o, p) {                       // base point -> board point
      var c = ctrOf(o), r = o.rot * Math.PI / 180;
      var vx = (p[0] - c[0]) * o.sx, vy = (p[1] - c[1]) * o.sy;
      var ca = Math.cos(r), sa = Math.sin(r);
      return [c[0] + o.tx + vx * ca - vy * sa, c[1] + o.ty + vx * sa + vy * ca];
    }

    function invPt(o, p) {                     // board point -> base point
      var c = ctrOf(o), r = -o.rot * Math.PI / 180;
      var dx = p[0] - c[0] - o.tx, dy = p[1] - c[1] - o.ty;
      var ca = Math.cos(r), sa = Math.sin(r);
      return [c[0] + (dx * ca - dy * sa) / o.sx, c[1] + (dx * sa + dy * ca) / o.sy];
    }

    function nrm(ev, bb) {
      return [(ev.clientX - bb.left) / bb.width, (ev.clientY - bb.top) / bb.height];
    }

    /* ---- marquee ---- */
    function buildMarquee() {
      marq = el('div', 'marq');
      marq.innerHTML =
        '<svg class="marq-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">' +
          '<polygon points="" /></svg>' +
        '<span class="tag"></span>';
      poly = q('polygon', marq);
      tag  = q('.tag', marq);

      HANDLES.forEach(function (h) {
        var n = el('span', 'h');
        n.dataset.h = h.id;
        n.addEventListener('pointerdown', startResize(h));
        marq.appendChild(n);
        handles[h.id] = n;
      });
      var rn = el('span', 'h rot');
      rn.dataset.h = 'rot';
      rn.title = 'Rotate';
      rn.addEventListener('pointerdown', startRotate);
      marq.appendChild(rn);
      handles.rot = rn;
    }

    function place(n, p) {
      n.style.left = (p[0] * 100) + '%';
      n.style.top  = (p[1] * 100) + '%';
    }

    function drawMarquee() {
      var o = objs[sel];
      if (!o || !o.vis) { marq.classList.remove('on'); return; }
      marq.classList.add('on');

      var b = o.box;
      var corners = [[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].map(function (p) {
        return fwd(o, p);
      });
      poly.setAttribute('points', corners.map(function (p) {
        return (p[0] * 1000) + ',' + (p[1] * 1000);
      }).join(' '));

      HANDLES.forEach(function (h) {
        var p = fwd(o, anchorPt(o, h));
        place(handles[h.id], p);
        var a = (((h.ang + o.rot) % 180) + 180) % 180;
        handles[h.id].style.cursor = CURSORS[Math.round(a / 45) % 4];
      });

      // rotate handle sits above the top edge, along the layer's local -Y
      var top = fwd(o, anchorPt(o, HANDLES[1]));
      var mid = fwd(o, ctrOf(o));
      var dx = top[0] - mid[0], dy = top[1] - mid[1];
      var len = Math.hypot(dx, dy) || 1;
      place(handles.rot, [top[0] + dx / len * 0.062, top[1] + dy / len * 0.062]);

      var tp = corners.reduce(function (a, p) { return p[1] < a[1] ? p : a; }, corners[0]);
      place(tag, [tp[0], tp[1]]);
      tag.textContent = (o.k === 0 ? 'Background' : 'Layer ' + o.k) + (o.dup ? ' (copy)' : '') +
        '  ·  ' + Math.round(o.sx * 100) + '×' + Math.round(o.sy * 100) + '%' +
        (Math.round(o.rot) ? '  ·  ' + Math.round(o.rot) + '°' : '');
    }

    function paint() {
      objs.forEach(function (o, i) {
        var n = o.node, c = ctrOf(o);
        n.style.zIndex = i;
        n.classList.toggle('gone', !o.vis);
        n.style.transformOrigin = (c[0] * 100) + '% ' + (c[1] * 100) + '%';
        n.style.transform =
          'translate(' + (o.tx * 100) + '%,' + (o.ty * 100) + '%) ' +
          'rotate(' + o.rot + 'deg) scale(' + o.sx + ',' + o.sy + ')';
      });
      drawMarquee();
    }

    /* ---- drag: resize (corner = both axes, edge = one axis) ---- */
    function startResize(h) {
      return function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var o = objs[sel]; if (!o) return;
        var bb = board.getBoundingClientRect();
        var c = ctrOf(o);
        var A = anchorPt(o, HANDLES.filter(function (x) { return x.id === OPP[h.id]; })[0]);
        var D = anchorPt(o, h);
        var sx0 = o.sx, sy0 = o.sy, tx0 = o.tx, ty0 = o.ty;
        var r = o.rot * Math.PI / 180;
        var ca = Math.cos(-r), sa = Math.sin(-r);
        var cb = Math.cos(r),  sb = Math.sin(r);

        function mv(e) {
          var P = nrm(e, bb);
          var dx = P[0] - c[0] - tx0, dy = P[1] - c[1] - ty0;
          var qx = dx * ca - dy * sa, qy = dx * sa + dy * ca;
          var nsx = sx0, nsy = sy0;
          if (Math.abs(D[0] - A[0]) > 1e-6) nsx = (qx - sx0 * (A[0] - c[0])) / (D[0] - A[0]);
          if (Math.abs(D[1] - A[1]) > 1e-6) nsy = (qy - sy0 * (A[1] - c[1])) / (D[1] - A[1]);
          if (e.shiftKey && h.corner) {        // keep the aspect ratio
            var f = Math.abs(nsx / sx0) > Math.abs(nsy / sy0) ? nsx / sx0 : nsy / sy0;
            nsx = sx0 * f; nsy = sy0 * f;
          }
          nsx = Math.max(0.08, Math.min(4, nsx));
          nsy = Math.max(0.08, Math.min(4, nsy));
          var ux = (sx0 - nsx) * (A[0] - c[0]), uy = (sy0 - nsy) * (A[1] - c[1]);
          o.tx = tx0 + ux * cb - uy * sb;
          o.ty = ty0 + ux * sb + uy * cb;
          o.sx = nsx; o.sy = nsy;
          paint();
        }
        function up() {
          document.removeEventListener('pointermove', mv);
          document.removeEventListener('pointerup', up);
        }
        document.addEventListener('pointermove', mv);
        document.addEventListener('pointerup', up);
      };
    }

    /* ---- drag: rotate ---- */
    function startRotate(ev) {
      ev.preventDefault(); ev.stopPropagation();
      var o = objs[sel]; if (!o) return;
      var bb = board.getBoundingClientRect();
      var c = ctrOf(o);
      var cx = (c[0] + o.tx) * bb.width + bb.left;
      var cy = (c[1] + o.ty) * bb.height + bb.top;
      var a0 = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      var r0 = o.rot;
      function mv(e) {
        var a = Math.atan2(e.clientY - cy, e.clientX - cx);
        var d = r0 + (a - a0) * 180 / Math.PI;
        if (e.shiftKey) d = Math.round(d / 15) * 15;
        o.rot = ((d % 360) + 360) % 360;
        if (o.rot > 180) o.rot -= 360;
        paint();
      }
      function up() {
        document.removeEventListener('pointermove', mv);
        document.removeEventListener('pointerup', up);
      }
      document.addEventListener('pointermove', mv);
      document.addEventListener('pointerup', up);
    }

    /* ---- layer panel ---- */
    function renderList() {
      list.innerHTML = '';
      var dir = BASE + '/case_' + cur.id;
      for (var i = objs.length - 1; i >= 0; i--) {
        (function (i) {
          var o = objs[i];
          var li = el('li', 'li' + (i === sel ? ' on' : '') + (o.vis ? '' : ' off'));
          li.dataset.i = i;
          li.innerHTML =
            '<span class="grip" aria-hidden="true">☰</span>' +
            '<span class="tn checker lite"><img loading="lazy" src="' + dir + '/thumb/L' + o.k + '.webp" alt=""></span>' +
            '<span class="nm">' + (o.k === 0 ? 'Background' : 'Layer ' + o.k) + (o.dup ? ' copy' : '') + '</span>' +
            '<button class="eye" title="Toggle visibility" aria-label="Toggle visibility">' +
              (o.vis ? ICON.eye : ICON.eyeOff) + '</button>';
          li.onclick = function (e) {
            if (e.target.closest('.eye')) { o.vis = !o.vis; renderList(); paint(); return; }
            sel = i; renderList(); drawMarquee();
          };
          q('.grip', li).addEventListener('pointerdown', startReorder(i));
          list.appendChild(li);
        })(i);
      }
      q('#st-count').textContent = objs.length;
    }

    function startReorder(from) {
      return function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var src = ev.currentTarget.closest('.li');
        src.classList.add('drag');
        var last = null;
        function move(e) {
          var t = document.elementFromPoint(e.clientX, e.clientY);
          var li = t && t.closest ? t.closest('.li') : null;
          if (last && last !== li) last.classList.remove('over');
          if (li && li !== src) { li.classList.add('over'); last = li; }
        }
        function up() {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
          src.classList.remove('drag');
          if (last) {
            last.classList.remove('over');
            var to = +last.dataset.i;
            var o = objs.splice(from, 1)[0];
            if (to > from) to -= 1;
            objs.splice(to, 0, o);
            sel = to;
            renderList(); paint();
          }
        }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      };
    }

    /* ---- select + move on the board ---- */
    function hit(nx, ny) {
      for (var i = objs.length - 1; i >= 0; i--) {
        var o = objs[i];
        if (!o.vis || o.k === 0) continue;
        var p = invPt(o, [nx, ny]), b = o.box;
        if (p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]) return i;
      }
      return -1;
    }

    board.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.h')) return;
      ev.preventDefault();                      // no text selection while dragging
      var bb = board.getBoundingClientRect();
      var P = nrm(ev, bb);
      var i = hit(P[0], P[1]);
      sel = i; renderList(); drawMarquee();
      if (i < 0) return;
      var o = objs[i], tx0 = o.tx, ty0 = o.ty;
      function mv(e) {
        var Q = nrm(e, bb);
        o.tx = tx0 + (Q[0] - P[0]);
        o.ty = ty0 + (Q[1] - P[1]);
        paint();
      }
      function up() {
        document.removeEventListener('pointermove', mv);
        document.removeEventListener('pointerup', up);
      }
      document.addEventListener('pointermove', mv);
      document.addEventListener('pointerup', up);
    });

    document.addEventListener('keydown', function (e) {
      if (sel < 0 || !objs[sel]) return;
      if (LB.isOpen()) return;
      var a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      var r = board.getBoundingClientRect();           // only while the board is on screen
      if (r.bottom < 60 || r.top > window.innerHeight - 60) return;
      var o = objs[sel], step = e.shiftKey ? 0.04 : 0.008, used = true;
      if (e.key === 'ArrowLeft') o.tx -= step;
      else if (e.key === 'ArrowRight') o.tx += step;
      else if (e.key === 'ArrowUp') o.ty -= step;
      else if (e.key === 'ArrowDown') o.ty += step;
      else if (e.key === 'Delete' || e.key === 'Backspace') { del(); return; }
      else used = false;
      if (used) { e.preventDefault(); paint(); }
    });

    /* ---- toolbar actions ---- */
    function del() {
      if (sel < 0) return;
      objs.splice(sel, 1);
      rebuildNodes(); sel = -1; renderList(); paint();
    }
    function dup() {
      if (sel < 0) return;
      var o = objs[sel], n = mk(cur, o.k, true);
      n.tx = o.tx + 0.06; n.ty = o.ty + 0.06;
      n.sx = o.sx; n.sy = o.sy; n.rot = o.rot;
      objs.splice(sel + 1, 0, n);
      rebuildNodes(); sel = sel + 1; renderList(); paint();
    }
    function shuffle() {
      objs.forEach(function (o) {
        if (o.k === 0) return;
        o.tx  = (Math.random() - .5) * .18;
        o.ty  = (Math.random() - .5) * .18;
        o.sx  = 0.82 + Math.random() * 0.42;
        o.sy  = 0.82 + Math.random() * 0.42;
        o.rot = (Math.random() - .5) * 16;
      });
      paint();
    }
    function reset() {
      objs = initial.map(function (s) {
        var o = mk(cur, s.k, s.dup);
        o.tx = s.tx; o.ty = s.ty; o.sx = s.sx; o.sy = s.sy; o.rot = s.rot; o.vis = s.vis;
        return o;
      });
      rebuildNodes(); sel = -1; renderList(); paint();
    }
    function hideTop() {
      for (var i = objs.length - 1; i >= 0; i--) {
        if (objs[i].k !== 0 && objs[i].vis) { objs[i].vis = false; sel = i; break; }
      }
      renderList(); paint();
    }

    function rebuildNodes() {
      var dir = BASE + '/case_' + cur.id;
      board.innerHTML = '';
      objs.forEach(function (o) {
        var n = el('div', 'ob pick');
        var im = el('img');
        im.src = dir + '/layers/L' + o.k + '.webp';
        im.alt = ''; im.draggable = false;
        n.appendChild(im);
        o.node = n;
        board.appendChild(n);
      });
      board.appendChild(marq);
    }

    function exportPNG() {
      var exportButton = q('#st-export');
      exportButton.disabled = true;
      var caseId = cur.id;
      var S = 1024, cv = document.createElement('canvas');
      cv.width = cv.height = S;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);
      var pend = snapshot().filter(function (o) { return o.vis; });
      pend.forEach(function (o) { o.box = cur.boxes[o.k]; });
      Promise.all(pend.map(function (o) {
        var path = 'case_' + caseId + '/layers/L' + o.k + '.webp';
        return new Promise(function (resolve, reject) {
          var src = LOCAL ? offlineImages[path] : BASE + '/' + path;
          if (!src) { reject(new Error('Missing export layer: ' + path)); return; }
          var i = new Image();
          i.onload = function () { resolve(i); };
          i.onerror = function () { reject(new Error('Cannot load export layer: ' + path)); };
          i.src = src;
        });
      })).then(function (imgs) {
        pend.forEach(function (o, n) {
          var c = ctrOf(o);
          ctx.save();
          ctx.translate(o.tx * S, o.ty * S);
          ctx.translate(c[0] * S, c[1] * S);
          ctx.rotate(o.rot * Math.PI / 180);
          ctx.scale(o.sx, o.sy);
          ctx.translate(-c[0] * S, -c[1] * S);
          ctx.drawImage(imgs[n], 0, 0, S, S);
          ctx.restore();
        });
        var a = document.createElement('a');
        a.download = 'cld_case' + caseId + '_edit.png';
        a.href = cv.toDataURL('image/png');
        document.body.appendChild(a);
        a.click();
        a.remove();
      }).catch(function (e) {
        console.error('CLD demo: PNG export failed', e);
        window.alert('PNG export failed. Please check that the complete page folder was downloaded.');
      }).then(function () {
        exportButton.disabled = false;
      });
    }

    q('#st-del').onclick     = del;
    q('#st-dup').onclick     = dup;
    q('#st-hide').onclick    = hideTop;
    q('#st-shuffle').onclick = shuffle;
    q('#st-reset').onclick   = reset;
    q('#st-export').onclick  = exportPNG;

    buildMarquee();
    caseTabs(tabsHost, function (c) {
      cur = c;
      objs = [];
      for (var k = 0; k <= c.nFg; k++) objs.push(mk(c, k, false));
      initial = snapshot();
      rebuildNodes();
      sel = -1;
      renderList(); paint();
    });
  }

  /* ========================================================
     5. Efficiency chart
     ======================================================== */
  function buildChart() {
    var host = q('#eff-chart'); if (!host) return;
    var QW = [[2,120,64],[3,163,70],[4,217,76],[5,276,77],[6,346,77]];
    var OURS = [[3,33],[11,48],[37,138]];
    var W = 560, H = 300, P = { l:46, r:16, t:16, b:38 };
    var maxL = 38, maxT = 360;
    function X(l) { return P.l + (l / maxL) * (W - P.l - P.r); }
    function Y(t) { return H - P.b - (t / maxT) * (H - P.t - P.b); }

    var s = ['<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Inference time versus number of layers">'];
    for (var t = 0; t <= 360; t += 90) {
      s.push('<line x1="' + P.l + '" y1="' + Y(t) + '" x2="' + (W - P.r) + '" y2="' + Y(t) +
             '" stroke="var(--panel-line)" stroke-width="1"/>');
      s.push('<text x="' + (P.l - 9) + '" y="' + (Y(t) + 4) + '" fill="var(--panel-mut)" font-size="11" text-anchor="end">' + t + 's</text>');
    }
    [2,10,20,30,37].forEach(function (l) {
      s.push('<text x="' + X(l) + '" y="' + (H - 14) + '" fill="var(--panel-mut)" font-size="11" text-anchor="middle">' + l + '</text>');
    });
    s.push('<text x="' + (W / 2) + '" y="' + (H - 1) + '" fill="var(--panel-mut)" font-size="11" text-anchor="middle">number of layers</text>');

    var qp = QW.map(function (d) { return X(d[0]) + ',' + Y(d[1]); }).join(' ');
    s.push('<polyline points="' + qp + '" fill="none" stroke="#e0484b" stroke-width="2.5" stroke-linejoin="round"/>');
    QW.forEach(function (d) {
      s.push('<circle cx="' + X(d[0]) + '" cy="' + Y(d[1]) + '" r="4" fill="#e0484b"/>');
    });
    s.push('<line x1="' + X(7) + '" y1="' + P.t + '" x2="' + X(7) + '" y2="' + (H - P.b) +
           '" stroke="#e0484b" stroke-width="1.5" stroke-dasharray="4 4" opacity=".75"/>');
    s.push('<text x="' + (X(7) + 7) + '" y="' + (P.t + 14) + '" fill="#e0484b" font-size="11.5" font-weight="700">OOM at 7 layers</text>');

    var op = OURS.map(function (d) { return X(d[0]) + ',' + Y(d[1]); }).join(' ');
    s.push('<polyline points="' + op + '" fill="none" stroke="#00a7bd" stroke-width="2.5" stroke-linejoin="round"/>');
    OURS.forEach(function (d) {
      s.push('<circle cx="' + X(d[0]) + '" cy="' + Y(d[1]) + '" r="4" fill="#00a7bd"/>');
    });
    s.push('<text x="' + (X(37) - 6) + '" y="' + (Y(138) - 11) + '" fill="#00a7bd" font-size="11.5" font-weight="700" text-anchor="end">37 layers, 138s</text>');
    s.push('</svg>');
    host.innerHTML = s.join('');
  }

  /* ========================================================
     6. Gallery
     ======================================================== */
  function buildGallery() {
    var host = q('#gallery'); if (!host) return;
    var list = M.gallery || [];
    host.innerHTML = '';
    if (!list.length) { host.closest('section').hidden = true; return; }

    list.forEach(function (g, idx) {
      var dir = BASE + '/gal_' + g.n;
      var card = el('figure', 'gcard');

      var shot = el('div', 'shot');
      var main = el('img');
      main.src = dir + '/input.webp';
      main.alt = 'Example ' + (idx + 1) + ', composited input';
      shot.appendChild(main);
      card.appendChild(shot);

      var bar = el('figcaption', 'bar');
      var label = el('b', '', 'Example ' + (idx + 1));
      bar.appendChild(label);
      bar.appendChild(el('span', '', (g.nFg + 1) + ' layers'));
      card.appendChild(bar);

      var items = [{ src: dir + '/input.webp', label: 'Example ' + (idx + 1) + ' · input' }];
      for (var k = 0; k <= g.nFg; k++) {
        items.push({
          src: dir + '/layers/L' + k + '.webp',
          label: 'Example ' + (idx + 1) + ' · ' + (k === 0 ? 'Background' : 'Layer ' + k)
        });
      }

      var rail = el('div', 'grail');
      function show(k) {
        main.src = k < 0 ? dir + '/input.webp' : dir + '/layers/L' + k + '.webp';
        label.textContent = k < 0 ? 'Example ' + (idx + 1)
                                  : (k === 0 ? 'Background' : 'Layer ' + k);
        Array.prototype.forEach.call(rail.children, function (t, m) {
          t.classList.toggle('on', m === k);
        });
      }
      for (var k2 = 0; k2 <= g.nFg; k2++) {
        (function (k) {
          var t = el('button', 'gth');
          t.type = 'button';
          t.setAttribute('aria-label', 'Enlarge ' + (k === 0 ? 'background layer' : 'layer ' + k));
          t.innerHTML = '<img loading="lazy" src="' + dir + '/thumb/L' + k + '.webp" alt="">';
          t.onmouseenter = function () { show(k); };
          t.onfocus = function () { show(k); };
          t.onclick = function () { LB.open(items, k + 1); };
          rail.appendChild(t);
        })(k2);
      }
      rail.onmouseleave = function () { show(-1); };
      shot.onclick = function () { LB.open(items, 0); };
      shot.style.cursor = 'zoom-in';
      card.appendChild(rail);
      host.appendChild(card);
    });
  }


  /* ========================================================
     Lightbox — click any layer tile to inspect it full size
     ======================================================== */
  var LB = (function () {
    var root, imgEl, capEl, idxEl, prevB, nextB;
    var items = [], at = 0, lastFocus = null;

    function build() {
      root = el('div', 'lb');
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', 'Layer preview');
      root.innerHTML =
        '<div class="lb-back"></div>' +
        '<div class="lb-panel">' +
          '<div class="lb-top">' +
            '<span class="lb-cap"></span>' +
            '<span class="lb-idx"></span>' +
            '<button class="lb-x" aria-label="Close">&#10005;</button>' +
          '</div>' +
          '<div class="lb-stage checker"><img alt=""></div>' +
          '<button class="lb-nav lb-prev" aria-label="Previous layer">&#8249;</button>' +
          '<button class="lb-nav lb-next" aria-label="Next layer">&#8250;</button>' +
        '</div>';
      document.body.appendChild(root);
      imgEl = q('.lb-stage img', root);
      capEl = q('.lb-cap', root);
      idxEl = q('.lb-idx', root);
      prevB = q('.lb-prev', root);
      nextB = q('.lb-next', root);
      q('.lb-back', root).onclick = close;
      q('.lb-x', root).onclick = close;
      prevB.onclick = function () { go(at - 1); };
      nextB.onclick = function () { go(at + 1); };
      document.addEventListener('keydown', function (e) {
        if (!root.classList.contains('on')) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowLeft')  { e.preventDefault(); go(at - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
      });
    }

    function go(i) {
      if (!items.length) return;
      at = (i + items.length) % items.length;
      var it = items[at];
      imgEl.src = it.src;
      imgEl.alt = it.label;
      capEl.textContent = it.label;
      idxEl.textContent = (at + 1) + ' / ' + items.length;
      var one = items.length < 2;
      prevB.hidden = one; nextB.hidden = one;
    }

    function open(list, i) {
      if (!root) build();
      items = list; lastFocus = document.activeElement;
      root.classList.add('on');
      document.body.style.overflow = 'hidden';
      go(i);
      q('.lb-x', root).focus();
    }

    function close() {
      root.classList.remove('on');
      document.body.style.overflow = '';
      imgEl.removeAttribute('src');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    return { open: open, isOpen: function () { return !!root && root.classList.contains('on'); } };
  })();

  /* a strip of clickable layer tiles that share one lightbox gallery */
  function layerStrip(host, dir, sub, n, title) {
    host.innerHTML = '';
    var items = [];
    for (var k = 0; k <= n; k++) {
      items.push({
        src: dir + '/' + sub + '/L' + k + '.webp',
        label: title + ' · ' + (k === 0 ? 'Background' : 'Layer ' + k)
      });
    }
    for (var j = 0; j <= n; j++) {
      (function (j) {
        var b = el('button', 'cell checker');
        b.type = 'button';
        b.setAttribute('aria-label', 'Enlarge ' + items[j].label);
        b.innerHTML = '<img loading="lazy" src="' + dir + '/' + sub + '/L' + j + '.webp" alt="">' +
                      '<em>' + (j === 0 ? 'bg' : j) + '</em>' +
                      '<span class="zoom" aria-hidden="true">' +
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
                      'stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6M11 8v6M8 11h6"/>' +
                      '</svg></span>';
        b.onclick = function () { LB.open(items, j); };
        host.appendChild(b);
      })(j);
    }
  }

  /* ======================================================== */
  function loadManifest() {
    if (LOCAL) {
      // Classic scripts can load alongside a file:// page; fetch() cannot.
      return new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = BASE + '/offline.js';
        script.onload = function () {
          var data = window.CLD_OFFLINE;
          if (!data || !data.manifest || !data.images) {
            reject(new Error('The local demo bundle is invalid. Please download the complete page folder again.'));
            return;
          }
          offlineImages = data.images;
          resolve(data.manifest);
        };
        script.onerror = function () {
          reject(new Error('Local demo data could not be loaded. Keep static/demo/offline.js with index.html in the complete page folder.'));
        };
        document.head.appendChild(script);
      });
    }
    return fetch(BASE + '/manifest.json').then(function (r) {
      if (!r.ok) throw new Error('Could not load static/demo/manifest.json (HTTP ' + r.status + ').');
      return r.json();
    });
  }

  function boot() {
    loadManifest()
      .then(function (m) {
        M = m;
        M.cases.forEach(function (c, i) { byId[c.id] = c; c.n = i; c.hasInput = !!c.hasInput; });
        buildExplorer();
        buildModes();
        buildRobust();
        buildStudio();
        buildChart();
        buildGallery();
      })
      .catch(function (e) {
        console.error('CLD demo: initialization failed', e);
        Array.prototype.forEach.call(document.querySelectorAll('.needs-demo'), function (n) {
          n.innerHTML = '';
          var message = el('div', 'app-body');
          message.style.cssText = 'text-align:center;color:var(--panel-mut)';
          message.textContent = 'Demo could not start. ' + e.message;
          n.appendChild(message);
        });
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
