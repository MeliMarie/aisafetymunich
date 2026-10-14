/* MAIS cable net: the Olympiapark roof as slowly drifting line patterns. Drop-in, no dependencies.
   Any element with [data-cable-net] gets a pattern on load. Two shapes:
     data-cable-net          the saddle-shaped cable net (hero)
     data-cable-net="fan"    cables hanging from a mast, tied together by rings
   Options as data attributes: data-cols, data-rows (net), data-cables, data-rings (fan), data-period (seconds per loop).
   Pauses when out of view or in a background tab; draws one still frame for prefers-reduced-motion.
   Manual use: var net = window.MAISCableNet(element, { shape: 'fan', period: 24 }); net.destroy(); */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var W = 800, H = 600, STEPS = 28;
  var f1 = function (n) { return n.toFixed(1); };

  // ---- Shape 1: a saddle-shaped net seen at an angle, with a slow travelling sag.
  function saddle(opts) {
    var cols = Math.max(4, opts.cols || 16), rows = Math.max(4, opts.rows || 11);
    function point(u, v, t) {
      var su = u * 2 - 1, sv = v * 2 - 1;
      var z = 0.95 * (su * su - sv * sv) * (0.86 + 0.14 * Math.sin(t))
            + 0.1 * Math.sin(2.1 * su + t) * Math.cos(1.7 * sv - t);
      return [W / 2 + su * 360 + sv * 110, H / 2 - 10 + sv * 200 - z * 150];
    }
    function cable(fixed, isU, t) {
      var d = '', s, a, pt;
      for (s = 0; s <= STEPS; s++) {
        a = s / STEPS;
        pt = isU ? point(fixed, a, t) : point(a, fixed, t);
        d += (s ? 'L' : 'M') + f1(pt[0]) + ' ' + f1(pt[1]);
      }
      return d;
    }
    return {
      count: cols + rows, edges: 1,
      draw: function (t, lines, edges) {
        var k = 0, n;
        for (n = 0; n < cols; n++) lines[k++].setAttribute('d', cable(n / (cols - 1), true, t));
        for (n = 0; n < rows; n++) lines[k++].setAttribute('d', cable(n / (rows - 1), false, t));
        // The two heavy edge cables, front and back, as on the stadium roof.
        edges[0].setAttribute('d', cable(0, false, t) + cable(1, false, t));
      }
    };
  }

  // ---- Shape 2: cables fanning down from a mast top, each sagging under its own slow sway,
  // tied together by rings at fixed fractions along their length.
  function fan(opts) {
    var cables = Math.max(5, opts.cables || 15), rings = Math.max(0, opts.rings === undefined ? 4 : opts.rings);
    var mast = [W * 0.9, H * 0.04];
    var stops = [];
    for (var r = 0; r < rings; r++) stops.push(0.3 + 0.6 * (r + 1) / (rings + 1));
    function geometry(i, t) {
      var a = i / (cables - 1);
      var ax = W * (-0.08 + a * 1.06), ay = H * (1.02 - 0.3 * a * a);
      var dx = ax - mast[0], dy = ay - mast[1], len = Math.sqrt(dx * dx + dy * dy);
      var sag = len * 0.16 * (1 + 0.22 * Math.sin(t + a * 4.2));
      var cx = (mast[0] + ax) / 2 - sag * 0.35, cy = (mast[1] + ay) / 2 + sag;
      return [ax, ay, cx, cy];
    }
    function at(g, s) {
      var u = 1 - s;
      return [u * u * mast[0] + 2 * u * s * g[2] + s * s * g[0], u * u * mast[1] + 2 * u * s * g[3] + s * s * g[1]];
    }
    return {
      count: cables + stops.length, edges: 1,
      draw: function (t, lines, edges) {
        var gs = [], i, k = 0;
        for (i = 0; i < cables; i++) {
          var g = geometry(i, t);
          gs.push(g);
          lines[k++].setAttribute('d', 'M' + f1(mast[0]) + ' ' + f1(mast[1]) + 'Q' + f1(g[2]) + ' ' + f1(g[3]) + ' ' + f1(g[0]) + ' ' + f1(g[1]));
        }
        stops.forEach(function (s) {
          var d = '';
          gs.forEach(function (g, j) { var p = at(g, s); d += (j ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1]); });
          lines[k++].setAttribute('d', d);
        });
        // The mast itself.
        edges[0].setAttribute('d', 'M' + f1(mast[0]) + ' ' + f1(mast[1] - 40) + 'L' + f1(mast[0] + 18) + ' ' + f1(H * 0.62));
      }
    };
  }

  function cableNet(host, opts) {
    opts = opts || {};
    var shape = (opts.shape === 'fan' ? fan : saddle)(opts);
    var period = Math.max(4, opts.period || 20) * 1000;
    var reduce = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    function add(cls) {
      var p = document.createElementNS(NS, 'path');
      if (cls) p.setAttribute('class', cls);
      svg.appendChild(p);
      return p;
    }
    var lines = [], edges = [], i;
    for (i = 0; i < shape.count; i++) lines.push(add());
    for (i = 0; i < shape.edges; i++) edges.push(add('edge'));
    host.appendChild(svg);
    function draw(t) { shape.draw(t, lines, edges); }

    var raf = 0, visible = true, start = 0, offset = 0, last = 0;
    function frame(now) {
      if (!start) start = now - offset;
      last = now;
      draw(((now - start) % period) / period * Math.PI * 2);
      raf = global.requestAnimationFrame(frame);
    }
    function play() {
      if (raf || !visible || (reduce && reduce.matches)) return;
      start = 0;
      raf = global.requestAnimationFrame(frame);
    }
    function pause() {
      if (!raf) return;
      global.cancelAnimationFrame(raf);
      raf = 0;
      offset = (last - start) % period;
    }
    function still() { pause(); draw(Math.PI / 3); }

    var io = null;
    if ('IntersectionObserver' in global) {
      io = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) play(); else pause();
      });
      io.observe(host);
    }
    function onMotion() { if (reduce.matches) still(); else play(); }
    if (reduce) {
      if (reduce.addEventListener) reduce.addEventListener('change', onMotion);
      else if (reduce.addListener) reduce.addListener(onMotion);
    }

    draw(Math.PI / 3);
    play();

    return {
      destroy: function () {
        pause();
        if (io) io.disconnect();
        if (reduce) {
          if (reduce.removeEventListener) reduce.removeEventListener('change', onMotion);
          else if (reduce.removeListener) reduce.removeListener(onMotion);
        }
        if (svg.parentNode) svg.parentNode.removeChild(svg);
      }
    };
  }

  function num(el, name) {
    var v = parseFloat(el.getAttribute(name));
    return isNaN(v) ? undefined : v;
  }
  function init() {
    var els = document.querySelectorAll('[data-cable-net]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].__cableNet) continue;
      els[i].__cableNet = cableNet(els[i], {
        shape: els[i].getAttribute('data-cable-net'),
        cols: num(els[i], 'data-cols'),
        rows: num(els[i], 'data-rows'),
        cables: num(els[i], 'data-cables'),
        rings: num(els[i], 'data-rings'),
        period: num(els[i], 'data-period')
      });
    }
  }

  global.MAISCableNet = cableNet;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
