/* MAIS interactive net: the Olympiapark roof as a live network, plus the animated logo mark.
   No dependencies. Colors come from the element's CSS tokens (--muted for cables, --accent for signals, --text for the logo).
     <div data-mais-net></div>        cable-net roof with travelling signals; nodes react to the cursor
     <canvas data-mais-logo></canvas> logo mark: tower, arc and net, drawn still. Add data-animate for travelling signals and hover
   Options: data-speed (default 0.4). Pauses out of view; one still frame for prefers-reduced-motion. */
(function (global) {
  'use strict';
  var reduce = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = function () { return !!(reduce && reduce.matches); };
  var rgba = function (c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  function token(el, name, fallback) {
    var v = getComputedStyle(el).getPropertyValue(name).trim();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
    if (!m) return fallback;
    var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function host(canvas, draw, speed, isStill) {
    var ctx = canvas.getContext('2d');
    var st = { W: 0, H: 0, ctx: ctx, mouse: { x: -1e4, y: -1e4 } };
    var raf = 0, alive = true, visible = true, vt = performance.now(), last = vt;
    function resize() {
      var r = canvas.getBoundingClientRect(), d = Math.min(2, global.devicePixelRatio || 1);
      st.W = r.width; st.H = r.height;
      canvas.width = Math.max(1, Math.round(st.W * d)); canvas.height = Math.max(1, Math.round(st.H * d));
      ctx.setTransform(d, 0, 0, d, 0, 0); draw(vt, st);
    }
    function onMove(e) { var r = canvas.getBoundingClientRect(); st.mouse.x = e.clientX - r.left; st.mouse.y = e.clientY - r.top; }
    function onLeave() { st.mouse.x = st.mouse.y = -1e4; }
    function loop(t) {
      if (!alive) return;
      var dt = Math.min(64, t - last); last = t; vt += dt * speed;
      if (visible && !isStill()) draw(vt, st);
      raf = global.requestAnimationFrame(loop);
    }
    var ro = new ResizeObserver(resize); ro.observe(canvas);
    var io = null;
    if ('IntersectionObserver' in global) { io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }); io.observe(canvas); }
    global.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    resize(); raf = global.requestAnimationFrame(loop);
    return { destroy: function () { alive = false; global.cancelAnimationFrame(raf); ro.disconnect(); if (io) io.disconnect(); global.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); if (canvas.__maisOwned && canvas.parentNode) canvas.parentNode.removeChild(canvas); } };
  }

  // ---------- Roof net ----------
  var PEAKS = [
    { x: -1.8, z: 0.1, h: 0.42, r: 0.7, mast: [-0.2, 0.35] }, { x: -0.95, z: 0.15, h: 0.55, r: 0.8, mast: [-0.25, 0.35] },
    { x: -0.2, z: -0.25, h: 0.75, r: 0.95, mast: [0.05, -0.45] }, { x: 0.65, z: 0.2, h: 0.6, r: 0.82, mast: [0.25, 0.4] },
    { x: 1.35, z: -0.2, h: 0.45, r: 0.65, mast: [0.3, -0.3] }, { x: 2.0, z: 0.1, h: 0.32, r: 0.55 }
  ];
  function net(el, opts) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true'); canvas.__maisOwned = true;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    el.appendChild(canvas);
    var o = { x0: -2.8, x1: 2.8, z0: -1.35, z1: 1.35, nx: 96, nz: 46, th: 0.025, yaw: -0.82, pitch: 0.62, peaks: PEAKS };
    var line = token(el, '--muted', [157, 176, 200]), acc = token(el, '--accent', [255, 145, 80]), txt = token(el, '--text', [230, 237, 246]);
    var height = function (x, z) {
      var s = 0;
      for (var i = 0; i < o.peaks.length; i++) { var p = o.peaks[i], d = Math.hypot(x - p.x, (z - p.z) * 1.15) / p.r; if (d < 1) s += Math.pow(p.h * Math.pow(1 - d, 1.7), 4); }
      return Math.pow(s, 0.25);
    };
    var pts = [], nx = o.nx, nz = o.nz;
    for (var j = 0; j <= nz; j++) for (var i = 0; i <= nx; i++) {
      var x = o.x0 + (o.x1 - o.x0) * i / nx, z = o.z0 + (o.z1 - o.z0) * j / nz, h = height(x, z);
      pts.push({ x: x, z: z, h: h, m: h > o.th, a: 0, sx: 0, sy: 0 });
    }
    var live = pts.filter(function (p) { return p.m; });
    // Shading: height (higher = brighter) mixed with Lambert light from the upper right
    var hMax = 0; live.forEach(function (p) { hMax = Math.max(hMax, p.h); });
    var L = [0.55, 0.75, -0.35], Ln = Math.hypot(L[0], L[1], L[2]); L = [L[0] / Ln, L[1] / Ln, L[2] / Ln];
    live.forEach(function (p) {
      var e = 0.02, dx = (height(p.x + e, p.z) - height(p.x - e, p.z)) / (2 * e), dz = (height(p.x, p.z + e) - height(p.x, p.z - e)) / (2 * e);
      var nl = Math.hypot(dx, 1, dz), lam = Math.max(0, (-dx * L[0] + L[1] - dz * L[2]) / nl);
      p.lum = Math.max(0, Math.min(1, 0.6 * Math.pow(p.h / hMax, 0.8) + 0.5 * lam - 0.12));
    });
    var LEVELS = 8;
    var waves = [], lastSpawn = 0;
    function edges(fn) {
      for (var j = 0; j <= nz; j++) for (var i = 0; i <= nx; i++) {
        var p = pts[j * (nx + 1) + i]; if (!p.m) continue;
        if (i < nx) { var q = pts[j * (nx + 1) + i + 1]; if (q.m) fn(p, q); }
        if (j < nz) { var q2 = pts[(j + 1) * (nx + 1) + i]; if (q2.m) fn(p, q2); }
      }
    }
    function draw(t, st) {
      var W = st.W, H = st.H, ctx = st.ctx, mouse = st.mouse;
      if (!W || !H) return;
      var mo = !reduced(), tt = mo ? t : 0;
      ctx.clearRect(0, 0, W, H);
      var yaw = o.yaw + (mo ? Math.sin(tt * 0.00006) * 0.16 : 0);
      var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
      var narrow = W < 640;
      var S = Math.min(W * (narrow ? 0.3 : 0.25), H * (narrow ? 0.42 : 0.5)), cx = W * (narrow ? 0.62 : 0.7), cy = H * (narrow ? 0.5 : 0.5), f = 4.2;
      function proj(x, y, z) { var xr = x * cyw - z * syw, zr = x * syw + z * cyw, yy = y * cp - zr * sp, zz = y * sp + zr * cp, k = f / (f - zz); return [cx + xr * S * k, cy - yy * S * k]; }
      if (mo && t - lastSpawn > 1800) { lastSpawn = t; var sp0 = live[(Math.random() * live.length) | 0]; waves.push({ x: sp0.x, z: sp0.z, t0: t }); }
      while (waves.length && t - waves[0].t0 > 4200) waves.shift();
      for (var k = 0; k < live.length; k++) {
        var p = live[k], a = 0;
        for (var w = 0; w < waves.length; w++) { var wv = waves[w], age = (t - wv.t0) / 1000, d = Math.hypot(p.x - wv.x, p.z - wv.z), q = (d - age * 0.62) / 0.08; a += Math.exp(-q * q) * Math.max(0, 1 - age / 4); }
        var br = mo ? 0.012 * Math.sin(tt * 0.0011 + p.x * 2.3 + p.z * 3.1) : 0;
        var s = proj(p.x, p.h + br, p.z), sx = s[0], sy = s[1];
        var dm = Math.hypot(sx - mouse.x, sy - mouse.y);
        if (dm < 140) { var qm = 1 - dm / 140; a += qm * qm; sy += qm * qm * 10; }
        p.sx = sx; p.sy = sy; p.a = Math.min(1, a);
      }
      var shade = []; for (var lv = 0; lv < LEVELS; lv++) shade.push([]);
      edges(function (p, q) { shade[Math.min(LEVELS - 1, (((p.lum + q.lum) / 2) * LEVELS) | 0)].push(p, q); });
      for (var lv2 = 0; lv2 < LEVELS; lv2++) {
        var b = shade[lv2]; if (!b.length) continue;
        var u = (lv2 + 0.5) / LEVELS;
        var col = [line[0] + (txt[0] - line[0]) * u, line[1] + (txt[1] - line[1]) * u, line[2] + (txt[2] - line[2]) * u].map(Math.round);
        ctx.strokeStyle = rgba(col, 0.08 + u * u * 0.62); ctx.lineWidth = 0.55 + u * 0.55; ctx.beginPath();
        for (var k2 = 0; k2 < b.length; k2 += 2) { ctx.moveTo(b[k2].sx, b[k2].sy); ctx.lineTo(b[k2 + 1].sx, b[k2 + 1].sy); }
        ctx.stroke();
      }
      var buckets = [[], [], [], [], []];
      edges(function (p, q) { var a = (p.a + q.a) / 2; if (a > 0.05) buckets[Math.min(4, (a * 5) | 0)].push(p, q); });
      ctx.lineWidth = 1.2;
      buckets.forEach(function (b, i) {
        if (!b.length) return; ctx.strokeStyle = rgba(acc, 0.22 + i * 0.18); ctx.beginPath();
        for (var k = 0; k < b.length; k += 2) { ctx.moveTo(b[k].sx, b[k].sy); ctx.lineTo(b[k + 1].sx, b[k + 1].sy); }
        ctx.stroke();
      });
      ctx.fillStyle = rgba(acc, 0.95);
      for (var n = 0; n < live.length; n++) { var lp = live[n]; if (lp.a > 0.3) { ctx.beginPath(); ctx.arc(lp.sx, lp.sy, 0.8 + lp.a * 1.8, 0, 6.283); ctx.fill(); } }
      function drawMasts() {
      ctx.strokeStyle = rgba(line, 0.14); ctx.lineWidth = 0.8;
      o.peaks.forEach(function (p) {
        if (!p.mast) return;
        var mx = p.mast[0], mz = p.mast[1];
        var T = proj(p.x + mx * 0.6, p.h + 0.42, p.z + mz * 0.6), B = proj(p.x + mx, 0, p.z + mz), P = proj(p.x, height(p.x, p.z), p.z), G = proj(p.x + mx * 1.9, 0, p.z + mz * 1.9);
        ctx.beginPath(); ctx.moveTo(B[0], B[1]); ctx.lineTo(T[0], T[1]); ctx.stroke();
        ctx.save(); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(T[0], T[1]); ctx.lineTo(P[0], P[1]);
        [-0.18, 0.18].forEach(function (dx) { var Q = proj(p.x + dx, height(p.x + dx, p.z), p.z); ctx.moveTo(T[0], T[1]); ctx.lineTo(Q[0], Q[1]); });
        ctx.moveTo(T[0], T[1]); ctx.lineTo(G[0], G[1]); ctx.stroke(); ctx.restore();
      });
      }
    }
    return host(canvas, draw, opts.speed, function () { return reduced(); });
  }

  // ---------- Logo mark (traced from the Olympiapark logo draft) ----------
  var LN = [
    [230, 825, 13], [443, 695, 12], [677, 558, 17], [902, 732, 12], [1038, 832, 12],
    [105, 932, 0], [180, 945, 11], [265, 970, 11], [445, 938, 14], [595, 1000, 13], [805, 940, 13], [918, 1010, 11], [1068, 942, 12], [1148, 932, 0],
    [272, 907, 7], [385, 895, 11], [478, 885, 7], [503, 830, 8], [550, 920, 11], [612, 826, 11], [620, 726, 8], [677, 740, 16], [718, 868, 15],
    [748, 780, 7], [790, 845, 10], [845, 848, 7], [895, 915, 9], [965, 918, 11], [948, 950, 7], [1000, 893, 7], [390, 820, 5], [320, 897, 5], [522, 862, 9]
  ];
  var SCALLOP = [[5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]];
  var CABLES = [[0, 5], [0, 6], [0, 14], [0, 31], [1, 31], [1, 30], [1, 16], [2, 15], [2, 17], [2, 20], [2, 21], [2, 23], [2, 25], [3, 25], [3, 26], [3, 27], [4, 29], [4, 12], [4, 13], [4, 28]];
  var NET = [[6, 14], [7, 14], [14, 15], [15, 8], [8, 16], [16, 32], [16, 17], [17, 20], [17, 19], [19, 20], [20, 21], [21, 23], [21, 22], [19, 22], [19, 32], [32, 18], [8, 18], [18, 22], [18, 9], [22, 9], [22, 24], [23, 24], [24, 25], [22, 10], [24, 10], [10, 26], [26, 25], [26, 27], [27, 28], [28, 12], [27, 29], [29, 12], [11, 28], [30, 15], [31, 14]];

  function logo(canvas, opts) {
    var c = token(canvas, '--text', [230, 237, 246]), spark = token(canvas, '--accent', [255, 145, 80]);
    var all = [].concat(SCALLOP.map(function (e) { return [e[0], e[1], 's']; }), CABLES.map(function (e) { return [e[0], e[1], 'c']; }), NET.map(function (e) { return [e[0], e[1], 'n']; }));
    var adj = LN.map(function () { return []; });
    all.forEach(function (e, k) { adj[e[0]].push(k); adj[e[1]].push(k); });
    var glow = LN.map(function () { return 0; }), pulses = [], lastSpawn = 0, lastT = 0, hover = 0;
    function ctrl(p, q, kind) {
      if (kind === 's') return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 26];
      if (kind === 'c') return [p[0] * 0.6 + q[0] * 0.4, p[1] * 0.25 + q[1] * 0.75];
      return null;
    }
    function bez(p, cc, q, u) { return cc ? [(1 - u) * (1 - u) * p[0] + 2 * (1 - u) * u * cc[0] + u * u * q[0], (1 - u) * (1 - u) * p[1] + 2 * (1 - u) * u * cc[1] + u * u * q[1]] : [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; }
    function spawn(from, t, hops) { var ks = adj[from], k = ks[(Math.random() * ks.length) | 0]; pulses.push({ k: k, fwd: all[k][0] === from, t0: t, dur: 700 + Math.random() * 500, hops: hops }); }
    function draw(t, st) {
      var W = st.W, H = st.H, ctx = st.ctx, mouse = st.mouse;
      if (!W || !H) return;
      var mo = !opts.still && !reduced(), dt = lastT ? Math.min(64, t - lastT) : 16; lastT = t;
      var bx0 = 95, by0 = 170, bw = 1065, bh = 860;
      var s = Math.min(W / bw, H / bh), ox = (W - bw * s) / 2 - bx0 * s, oy = (H - bh * s) / 2 - by0 * s;
      var X = function (x) { return ox + x * s; }, Y = function (y) { return oy + y * s; };
      var inside = mouse.x > -20 && mouse.x < W + 20 && mouse.y > -20 && mouse.y < H + 20;
      hover += ((inside ? 1 : 0) - hover) * Math.min(1, dt * 0.01);
      ctx.clearRect(0, 0, W, H);
      var P = LN.map(function (n, i) {
        var px = n[0], py = n[1];
        if (mo && n[2] && i > 4) { px += Math.sin(t * 0.0009 + i * 1.7) * 3; py += Math.cos(t * 0.0011 + i * 2.3) * 3; }
        if (mo && inside) {
          var d = Math.hypot(X(px) - mouse.x, Y(py) - mouse.y), R = Math.max(16, W * 0.45);
          if (d < R && d > 0.01) { var q = 1 - d / R; px += (X(px) - mouse.x) / d * q * q * 60; py += (Y(py) - mouse.y) / d * q * q * 60; glow[i] = Math.max(glow[i], q); }
        }
        return [px, py, n[2]];
      });
      for (var g = 0; g < glow.length; g++) glow[g] = Math.max(0, glow[g] - dt * 0.0015);
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(c, 1); ctx.lineWidth = 36 * s;
      var a0 = Math.PI - 0.295; ctx.beginPath(); ctx.arc(X(626), Y(686), 496 * s, a0, a0 + Math.PI + 0.59); ctx.stroke();
      ctx.fillStyle = rgba(c, 1); ctx.lineWidth = 8 * s;
      ctx.beginPath(); ctx.moveTo(X(388), Y(345)); ctx.lineTo(X(388), Y(475)); ctx.stroke();
      [[382, 440, 394, 470], [378, 470, 398, 505], [372, 505, 404, 535], [352, 543, 424, 578], [350, 588, 426, 598], [356, 604, 420, 613], [362, 619, 414, 627]].forEach(function (r) { ctx.fillRect(X(r[0]), Y(r[1]), (r[2] - r[0]) * s, (r[3] - r[1]) * s); });
      ctx.beginPath(); ctx.moveTo(X(374), Y(627)); ctx.lineTo(X(402), Y(627)); ctx.lineTo(X(404), Y(798)); ctx.lineTo(X(372), Y(798)); ctx.closePath(); ctx.fill();
      [[1, 862, 7, 12], [3, 885, 7, 12], [4, 928, 6, 11]].forEach(function (m) {
        var x = P[m[0]][0], y = P[m[0]][1], bxm = LN[m[0]][0];
        ctx.beginPath(); ctx.moveTo(X(x - m[2]), Y(y)); ctx.lineTo(X(x + m[2]), Y(y)); ctx.lineTo(X(bxm + m[3]), Y(m[1])); ctx.lineTo(X(bxm - m[3]), Y(m[1])); ctx.closePath(); ctx.fill();
      });
      all.forEach(function (e) {
        var p = P[e[0]], q = P[e[1]], cc = ctrl(p, q, e[2]);
        ctx.strokeStyle = rgba(c, 1); ctx.lineWidth = (e[2] === 's' ? 9 : 7) * s;
        ctx.beginPath(); ctx.moveTo(X(p[0]), Y(p[1]));
        if (cc) ctx.quadraticCurveTo(X(cc[0]), Y(cc[1]), X(q[0]), Y(q[1])); else ctx.lineTo(X(q[0]), Y(q[1]));
        ctx.stroke();
      });
      if (mo) {
        var every = 1400 - hover * 1100;
        if (t - lastSpawn > every) { lastSpawn = t; spawn((Math.random() * LN.length) | 0, t, (Math.random() * 3) | 0); }
        for (var i = pulses.length - 1; i >= 0; i--) {
          var pu = pulses[i], u = (t - pu.t0) / pu.dur, e = all[pu.k], to = pu.fwd ? e[1] : e[0];
          if (u >= 1) { glow[to] = 1; pulses.splice(i, 1); if (pu.hops > 0) spawn(to, t, pu.hops - 1); continue; }
          var cc2 = ctrl(P[e[0]], P[e[1]], e[2]), uu = pu.fwd ? u : 1 - u;
          var hd = bez(P[e[0]], cc2, P[e[1]], uu);
          ctx.fillStyle = rgba(spark, 1); ctx.beginPath(); ctx.arc(X(hd[0]), Y(hd[1]), Math.max(1.4, 14 * s), 0, 6.283); ctx.fill();
        }
      }
      P.forEach(function (n, i) {
        if (!n[2]) return;
        var gl = glow[i], r = n[2] * s * 1.7;
        ctx.fillStyle = gl > 0.05 ? rgba(spark, Math.min(1, 0.4 + gl)) : rgba(c, 1);
        ctx.beginPath(); ctx.arc(X(n[0]), Y(n[1]), Math.max(1, r * (1 + gl * 0.35)), 0, 6.283); ctx.fill();
      });
    }
    return host(canvas, draw, opts.speed, function () { return opts.still || reduced(); });
  }

  function init() {
    var nets = document.querySelectorAll('[data-mais-net]');
    for (var i = 0; i < nets.length; i++) if (!nets[i].__maisNet) nets[i].__maisNet = net(nets[i], { speed: parseFloat(nets[i].getAttribute('data-speed')) || 0.4 });
    var logos = document.querySelectorAll('[data-mais-logo]');
    for (var j = 0; j < logos.length; j++) if (!logos[j].__maisNet) logos[j].__maisNet = logo(logos[j], { speed: parseFloat(logos[j].getAttribute('data-speed')) || 0.5, still: !logos[j].hasAttribute('data-animate') });
  }
  global.MAISNet = { net: net, logo: logo, init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
