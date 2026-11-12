// Estela de fluido que sigue al ratón (simulación de fluidos estable en WebGL2).
// Inspirado en WebGL-Fluid-Simulation de Pavel Dobryakov (MIT). Implementación propia y reducida.
// Solo con ratón fino, sin «reducir movimiento» y con WebGL2 + EXT_color_buffer_float.
// Se duerme cuando el ratón lleva unos segundos quieto.
(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var c = document.createElement('canvas');
  c.className = 'fluido';
  c.setAttribute('aria-hidden', 'true');
  var gl = c.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return;
  document.body.appendChild(c);

  var SIM = 128, DYE = 512, ITER = 20;
  var VEL_DISS = 0.25, DYE_DISS = 1.1, CURL = 22, FUERZA = 5200, RADIO = 0.0022;
  var PALETA = [[0.02, 0.71, 0.83], [0.22, 0.74, 0.97], [0.75, 0.52, 0.99], [0.98, 0.44, 0.52]];

  var VS = '#version 300 es\nprecision highp float;in vec2 aPos;uniform vec2 texel;out vec2 vUv,vL,vR,vT,vB;' +
    'void main(){vUv=aPos*.5+.5;vL=vUv-vec2(texel.x,0.);vR=vUv+vec2(texel.x,0.);vT=vUv+vec2(0.,texel.y);vB=vUv-vec2(0.,texel.y);gl_Position=vec4(aPos,0.,1.);}';
  var H = '#version 300 es\nprecision highp float;precision highp sampler2D;in vec2 vUv,vL,vR,vT,vB;out vec4 o;';
  var FS = {
    splat: 'uniform sampler2D uT;uniform float aspect,radius;uniform vec3 color;uniform vec2 point;' +
      'void main(){vec2 p=vUv-point;p.x*=aspect;o=vec4(texture(uT,vUv).xyz+exp(-dot(p,p)/radius)*color,1.);}',
    advect: 'uniform sampler2D uVel,uSrc;uniform vec2 simTexel;uniform float dt,diss;' +
      'void main(){vec2 q=vUv-dt*texture(uVel,vUv).xy*simTexel;o=texture(uSrc,q)/(1.+diss*dt);}',
    divergence: 'uniform sampler2D uVel;void main(){vec2 C=texture(uVel,vUv).xy;float L=texture(uVel,vL).x,R=texture(uVel,vR).x,T=texture(uVel,vT).y,B=texture(uVel,vB).y;' +
      'if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;o=vec4(.5*(R-L+T-B),0.,0.,1.);}',
    curl: 'uniform sampler2D uVel;void main(){float L=texture(uVel,vL).y,R=texture(uVel,vR).y,T=texture(uVel,vT).x,B=texture(uVel,vB).x;o=vec4(.5*(R-L-T+B),0.,0.,1.);}',
    vorticity: 'uniform sampler2D uVel,uCurl;uniform float curl,dt;void main(){float L=texture(uCurl,vL).x,R=texture(uCurl,vR).x,T=texture(uCurl,vT).x,B=texture(uCurl,vB).x,C=texture(uCurl,vUv).x;' +
      'vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+1e-4;f*=curl*C;f.y*=-1.;vec2 v=texture(uVel,vUv).xy+f*dt;o=vec4(clamp(v,-1000.,1000.),0.,1.);}',
    pressure: 'uniform sampler2D uP,uDiv;void main(){float L=texture(uP,vL).x,R=texture(uP,vR).x,T=texture(uP,vT).x,B=texture(uP,vB).x;o=vec4((L+R+B+T-texture(uDiv,vUv).x)*.25,0.,0.,1.);}',
    gradient: 'uniform sampler2D uP,uVel;void main(){float L=texture(uP,vL).x,R=texture(uP,vR).x,T=texture(uP,vT).x,B=texture(uP,vB).x;o=vec4(texture(uVel,vUv).xy-vec2(R-L,T-B),0.,1.);}',
    clear: 'uniform sampler2D uT;uniform float val;void main(){o=val*texture(uT,vUv);}',
    display: 'uniform sampler2D uT;void main(){vec3 c=texture(uT,vUv).rgb;o=vec4(c/(1.+max(c.r,max(c.g,c.b))*.35),1.);}'
  };

  function shader(tipo, src) {
    var s = gl.createShader(tipo);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var vs = shader(gl.VERTEX_SHADER, VS);
  var P = {};
  Object.keys(FS).forEach(function (k) {
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, H + FS[k]));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    var u = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var nom = gl.getActiveUniform(p, i).name; u[nom] = gl.getUniformLocation(p, nom); }
    P[k] = { p: p, u: u };
  });

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  function fbo(w, h) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { t: t, f: f, w: w, h: h, tx: [1 / w, 1 / h] };
  }
  function doble(w, h) {
    var a = fbo(w, h), b = fbo(w, h);
    return { get r() { return a; }, get w() { return b; }, swap: function () { var x = a; a = b; b = x; } };
  }
  function res(base) {
    var asp = innerWidth / innerHeight;
    return asp > 1 ? [Math.round(base * asp), base] : [base, Math.round(base / asp)];
  }

  var vel, dye, div, curl, pres, simTx;
  function crear() {
    var s = res(SIM), d = res(DYE);
    vel = doble(s[0], s[1]); pres = doble(s[0], s[1]);
    div = fbo(s[0], s[1]); curl = fbo(s[0], s[1]);
    dye = doble(d[0], d[1]);
    simTx = [1 / s[0], 1 / s[1]];
  }
  function tam() { c.width = innerWidth; c.height = innerHeight; }
  tam(); crear();
  var rt;
  addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { tam(); crear(); despertar(); }, 200); });

  var unidad = 0;
  function usar(k) { gl.useProgram(P[k].p); unidad = 0; return P[k].u; }
  function tex(loc, t) { gl.activeTexture(gl.TEXTURE0 + unidad); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unidad++); }
  function dibujar(dest, texel) {
    var u = gl.getParameter(gl.CURRENT_PROGRAM);
    var lt = gl.getUniformLocation(u, 'texel');
    if (lt) gl.uniform2fv(lt, texel || (dest ? dest.tx : [1 / c.width, 1 / c.height]));
    if (dest) { gl.viewport(0, 0, dest.w, dest.h); gl.bindFramebuffer(gl.FRAMEBUFFER, dest.f); }
    else { gl.viewport(0, 0, c.width, c.height); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  function splat(x, y, dx, dy, col) {
    var asp = c.width / c.height;
    var r = asp > 1 ? RADIO * asp : RADIO;
    var u = usar('splat');
    tex(u.uT, vel.r.t); gl.uniform1f(u.aspect, asp); gl.uniform1f(u.radius, r);
    gl.uniform2f(u.point, x, y); gl.uniform3f(u.color, dx, dy, 0);
    dibujar(vel.w); vel.swap();
    u = usar('splat');
    tex(u.uT, dye.r.t); gl.uniform1f(u.aspect, asp); gl.uniform1f(u.radius, r);
    gl.uniform2f(u.point, x, y); gl.uniform3f(u.color, col[0], col[1], col[2]);
    dibujar(dye.w); dye.swap();
  }

  function paso(dt) {
    var u = usar('curl'); tex(u.uVel, vel.r.t); dibujar(curl);
    u = usar('vorticity'); tex(u.uVel, vel.r.t); tex(u.uCurl, curl.t); gl.uniform1f(u.curl, CURL); gl.uniform1f(u.dt, dt); dibujar(vel.w); vel.swap();
    u = usar('divergence'); tex(u.uVel, vel.r.t); dibujar(div);
    u = usar('clear'); tex(u.uT, pres.r.t); gl.uniform1f(u.val, 0.8); dibujar(pres.w); pres.swap();
    for (var i = 0; i < ITER; i++) { u = usar('pressure'); tex(u.uP, pres.r.t); tex(u.uDiv, div.t); dibujar(pres.w); pres.swap(); }
    u = usar('gradient'); tex(u.uP, pres.r.t); tex(u.uVel, vel.r.t); dibujar(vel.w); vel.swap();
    u = usar('advect'); tex(u.uVel, vel.r.t); tex(u.uSrc, vel.r.t); gl.uniform2fv(u.simTexel, simTx); gl.uniform1f(u.dt, dt); gl.uniform1f(u.diss, VEL_DISS); dibujar(vel.w); vel.swap();
    u = usar('advect'); tex(u.uVel, vel.r.t); tex(u.uSrc, dye.r.t); gl.uniform2fv(u.simTexel, simTx); gl.uniform1f(u.dt, dt); gl.uniform1f(u.diss, DYE_DISS); dibujar(dye.w, simTx); dye.swap();
    u = usar('display'); tex(u.uT, dye.r.t); dibujar(null);
  }

  var cola = [], ultimo = 0, antes = 0, vivo = false, px = -1, py = -1;
  function color(t) {
    var f = (t / 2600) % PALETA.length, i = Math.floor(f), k = f - i;
    var a = PALETA[i], b = PALETA[(i + 1) % PALETA.length], m = 0.12;
    return [(a[0] + (b[0] - a[0]) * k) * m, (a[1] + (b[1] - a[1]) * k) * m, (a[2] + (b[2] - a[2]) * k) * m];
  }
  addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var x = e.clientX, y = e.clientY;
    if (px >= 0) {
      var dx = (x - px) / innerWidth, dy = (py - y) / innerHeight;
      if (dx || dy) cola.push([x / innerWidth, 1 - y / innerHeight, dx * FUERZA, dy * FUERZA]);
    }
    px = x; py = y;
    despertar();
  }, { passive: true });
  document.addEventListener('mouseleave', function () { px = py = -1; });

  function despertar() {
    ultimo = performance.now();
    if (!vivo && !document.hidden) { vivo = true; antes = ultimo; requestAnimationFrame(cuadro); }
  }
  function cuadro(t) {
    var dt = Math.min((t - antes) / 1000, 1 / 30);
    antes = t;
    var col = color(t);
    for (var i = 0; i < cola.length; i++) splat(cola[i][0], cola[i][1], cola[i][2], cola[i][3], col);
    cola.length = 0;
    paso(dt);
    if (t - ultimo < 5000 && !document.hidden) requestAnimationFrame(cuadro);
    else vivo = false;
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) despertar(); });
})();
