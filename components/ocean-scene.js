/**
 * Homepage ocean prototype: a WebGL sea with a realtime Worcester sun/moon,
 * a tunable paper veil so type stays readable, and a Zen mode that drops the UI.
 *
 * Query helpers for playing with the prototype:
 *   ?veil=0.65   override --ocean-veil-opacity
 *   ?hour=6      shift the sky to that Worcester hour
 *   ?ocean=1     start with the ocean on (also stored after the footer switch)
 *   ?zen=1       start in Zen (turns the ocean on for that visit)
 */

const WORCESTER = {
  lat: 42.2626,
  lon: -71.8023,
  timeZone: "America/New_York",
};

const SOUND_KEY = "ocean-zen-sound";
const VISIBLE_KEY = "ocean-background";
const DEG = Math.PI / 180;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const params = new URLSearchParams(window.location.search);

function sceneDate(now = new Date()) {
  const hourParam = params.get("hour");
  if (hourParam == null) return now;

  const hour = Number(hourParam);
  if (!Number.isFinite(hour)) return now;

  const worcesterHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: WORCESTER.timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );

  return new Date(now.getTime() + (((hour % 24) + 24) % 24 - worcesterHour) * 3600000);
}

function toJulian(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function directionFromHorizontal(altitude, azimuth) {
  // Camera looks south (−Z). 0° azimuth = north, clockwise.
  const cosAlt = Math.cos(altitude);
  return [
    -Math.sin(azimuth) * cosAlt,
    Math.sin(altitude),
    Math.cos(azimuth) * cosAlt,
  ];
}

function sunHorizontal(date, latDeg, lonDeg) {
  const jc = (toJulian(date) - 2451545) / 36525;
  let meanLong = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  if (meanLong < 0) meanLong += 360;

  const meanAnom = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const m = meanAnom * DEG;
  const center =
    Math.sin(m) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * jc) +
    Math.sin(3 * m) * 0.000289;

  const trueLong = meanLong + center;
  const omega = 125.04 - 1934.136 * jc;
  const lambda = (trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG)) * DEG;
  const eps0 =
    23 +
    (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega * DEG)) * DEG;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));

  const y = Math.tan(eps / 2) ** 2;
  const l = meanLong * DEG;
  const eqTime =
    4 *
    ((y * Math.sin(2 * l) -
      2 * 0.0167086 * Math.sin(m) +
      4 * 0.0167086 * y * Math.sin(m) * Math.cos(2 * l) -
      0.5 * y * y * Math.sin(4 * l) -
      1.25 * 0.0167086 ** 2 * Math.sin(2 * m)) /
      DEG);

  const minutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  let solar = (minutes + eqTime + 4 * lonDeg) % 1440;
  if (solar < 0) solar += 1440;

  let hourAngle = solar / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;

  const lat = latDeg * DEG;
  const ha = hourAngle * DEG;
  const altitude = Math.asin(
    Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha),
  );
  const azimuth =
    Math.PI +
    Math.atan2(
      Math.sin(ha),
      Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat),
    );

  return { altitude, azimuth };
}

function moonHorizontal(date, latDeg, lonDeg) {
  const jd = toJulian(date);
  const t = (jd - 2451545) / 36525;
  const L = 218.3164477 + 481267.88123421 * t;
  const Mp = (134.9633964 + 477198.8676313 * t) * DEG;
  const F = (93.272095 + 483202.0175233 * t) * DEG;
  const lambda = (L + 6.289 * Math.sin(Mp)) * DEG;
  const beta = 5.128 * Math.sin(F) * DEG;
  const eps = (23.439 - 0.0000004 * t) * DEG;

  const ra = Math.atan2(
    Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps),
    Math.cos(lambda),
  );
  const dec = Math.asin(
    Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda),
  );

  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545);
  const lst = (gmst + lonDeg) * DEG;
  const ha = lst - ra;
  const lat = latDeg * DEG;
  const altitude = Math.asin(
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha),
  );
  const azimuth =
    Math.PI +
    Math.atan2(
      Math.sin(ha),
      Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat),
    );

  return { altitude, azimuth };
}

function celestialState(date = sceneDate()) {
  const sun = sunHorizontal(date, WORCESTER.lat, WORCESTER.lon);
  const moon = moonHorizontal(date, WORCESTER.lat, WORCESTER.lon);
  return {
    date,
    sunDir: directionFromHorizontal(sun.altitude, sun.azimuth),
    moonDir: directionFromHorizontal(moon.altitude, moon.azimuth),
    sunAlt: sun.altitude,
    moonAlt: moon.altitude,
  };
}

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function lookAt(eye, center, up) {
  const z = normalize(sub(eye, center));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return [
    x[0],
    y[0],
    z[0],
    0,
    x[1],
    y[1],
    z[1],
    0,
    x[2],
    y[2],
    z[2],
    0,
    -dot(x, eye),
    -dot(y, eye),
    -dot(z, eye),
    1,
  ];
}

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) * nf,
    -1,
    0,
    0,
    2 * far * near * nf,
    0,
  ];
}

const SKY_GLSL = `
vec3 skyColor(vec3 dir, vec3 sunDir, vec3 moonDir, float sunAlt) {
  vec3 rd = normalize(dir);
  vec3 sun = normalize(sunDir);
  float h = rd.y;
  float day = smoothstep(-0.18, 0.12, sunAlt);
  float dusk = 1.0 - smoothstep(0.16, 0.48, abs(sunAlt));
  float night = 1.0 - day;

  vec3 dayZenith = vec3(0.23, 0.50, 0.90);
  vec3 dayHorizon = vec3(0.70, 0.84, 0.96);
  vec3 nightZenith = vec3(0.01, 0.02, 0.05);
  vec3 nightHorizon = vec3(0.04, 0.06, 0.12);
  vec3 duskOrange = vec3(1.0, 0.22, 0.02);
  vec3 duskRose = vec3(0.72, 0.06, 0.36);
  vec3 duskPurple = vec3(0.28, 0.04, 0.50);
  vec3 duskDeep = vec3(0.08, 0.02, 0.20);

  float elev = pow(clamp((h + 0.08) / 0.82, 0.0, 1.0), 0.78);
  vec3 daySky = mix(dayHorizon, dayZenith, elev);
  vec3 nightSky = mix(nightHorizon, nightZenith, elev);
  vec3 duskSky = mix(duskOrange, duskRose, smoothstep(0.0, 0.30, elev));
  duskSky = mix(duskSky, duskPurple, smoothstep(0.20, 0.60, elev));
  duskSky = mix(duskSky, duskDeep, smoothstep(0.52, 1.0, elev));

  vec3 flatRd = normalize(vec3(rd.x, 0.0, rd.z) + vec3(0.0001, 0.0, 0.0));
  vec3 flatSun = normalize(vec3(sun.x, 0.0, sun.z) + vec3(0.0001, 0.0, 0.0));
  float towardSun = max(dot(flatRd, flatSun), 0.0);
  duskSky = mix(duskSky, duskOrange, pow(towardSun, 2.2) * (1.0 - elev) * 0.75);
  duskSky = mix(duskSky, duskPurple, (1.0 - towardSun) * elev * 0.28);

  vec3 col = mix(nightSky, daySky, day);
  col = mix(col, duskSky, dusk);

  if (h < 0.0) {
    vec3 deep = mix(vec3(0.01, 0.03, 0.05), vec3(0.02, 0.08, 0.10), day);
    deep = mix(deep, vec3(0.14, 0.03, 0.04), dusk);
    col = mix(deep, col, pow(clamp(h + 1.0, 0.0, 1.0), 6.0));
  }

  float sunDot = max(dot(rd, sun), 0.0);
  vec3 sunCol = mix(vec3(1.0, 0.96, 0.82), vec3(0.95, 0.18, 0.02), dusk);
  col += sunCol * smoothstep(0.993, 0.9988, sunDot) * mix(2.2, 0.55, dusk);
  col += sunCol * pow(sunDot, 32.0) * mix(0.35, 0.75, dusk);
  col += sunCol * pow(sunDot, 5.0) * mix(0.08, 0.42, dusk);

  float moonDot = max(dot(rd, normalize(moonDir)), 0.0);
  float moonVis = smoothstep(-0.06, 0.03, moonDir.y) * night * (1.0 - dusk);
  col += vec3(0.86, 0.90, 1.0) * smoothstep(0.997, 0.9996, moonDot) * 1.8 * moonVis;
  col += vec3(0.45, 0.55, 0.75) * pow(moonDot, 32.0) * 0.28 * moonVis;

  float star = fract(sin(dot(rd.xy * 240.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += vec3(0.85, 0.9, 1.0) * step(0.9965, star) * night * (1.0 - dusk) * smoothstep(0.02, 0.18, h);

  return col;
}
`;

const SKY_VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const SKY_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform vec3 u_camForward;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform float u_tanHalfFov;
uniform float u_aspect;
uniform vec3 u_sunDir;
uniform vec3 u_moonDir;
uniform float u_sunAlt;
${SKY_GLSL}
void main() {
  vec3 dir = normalize(
    u_camForward +
    u_camRight * v_uv.x * u_tanHalfFov * u_aspect +
    u_camUp * v_uv.y * u_tanHalfFov
  );
  gl_FragColor = vec4(skyColor(dir, u_sunDir, u_moonDir, u_sunAlt), 1.0);
}
`;

const WATER_VERT = `
attribute vec2 a_xz;
uniform mat4 u_viewProj;
uniform float u_time;
varying vec3 v_world;
varying vec3 v_normal;
varying float v_height;

void gerstner(inout vec3 pos, inout vec3 nrm, vec2 dir, float amp, float lambda, float steep, float time) {
  float k = 6.2831853 / lambda;
  float speed = sqrt(9.8 * k);
  float phase = k * dot(dir, pos.xz) - speed * time;
  float q = steep / (k * amp * 5.0 + 0.0001);
  float c = cos(phase);
  float s = sin(phase);
  pos.xz += dir * q * amp * c;
  pos.y += amp * s;
  float wa = k * amp;
  nrm.x -= dir.x * wa * c;
  nrm.z -= dir.y * wa * c;
  nrm.y -= q * wa * s;
}

void main() {
  vec3 pos = vec3(a_xz.x, 0.0, a_xz.y);
  vec3 nrm = vec3(0.0, 1.0, 0.0);
  float t = u_time;
  gerstner(pos, nrm, normalize(vec2(0.86, 0.50)), 0.62, 32.0, 0.72, t);
  gerstner(pos, nrm, normalize(vec2(-0.62, 0.78)), 0.34, 18.0, 0.58, t);
  gerstner(pos, nrm, normalize(vec2(0.18, 0.98)), 0.18, 9.5, 0.46, t);
  gerstner(pos, nrm, normalize(vec2(-0.94, 0.34)), 0.11, 5.4, 0.40, t);
  gerstner(pos, nrm, normalize(vec2(0.58, -0.81)), 0.06, 3.1, 0.32, t);
  v_world = pos;
  v_normal = nrm;
  v_height = pos.y;
  gl_Position = u_viewProj * vec4(pos, 1.0);
}
`;

const WATER_FRAG = `
precision mediump float;
varying vec3 v_world;
varying vec3 v_normal;
varying float v_height;
uniform vec3 u_camPos;
uniform vec3 u_sunDir;
uniform vec3 u_moonDir;
uniform float u_sunAlt;
${SKY_GLSL}
void main() {
  vec3 N = normalize(v_normal);
  vec3 V = normalize(u_camPos - v_world);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);

  float day = smoothstep(-0.18, 0.12, u_sunAlt);
  float dusk = 1.0 - smoothstep(0.16, 0.48, abs(u_sunAlt));
  vec3 deep = mix(vec3(0.01, 0.03, 0.06), vec3(0.01, 0.08, 0.12), day);
  vec3 shallow = mix(vec3(0.04, 0.08, 0.12), vec3(0.05, 0.22, 0.26), day);
  deep = mix(deep, vec3(0.08, 0.02, 0.05), dusk);
  shallow = mix(shallow, vec3(0.22, 0.06, 0.05), dusk);
  vec3 water = mix(deep, shallow, clamp(N.y * 0.65 + 0.2, 0.0, 1.0));

  vec3 sky = skyColor(R, u_sunDir, u_moonDir, u_sunAlt);
  float fresnel = mix(0.05, 1.0, pow(1.0 - max(dot(N, V), 0.0), 5.0));
  vec3 col = mix(water, sky, fresnel);

  vec3 sunCol = mix(vec3(1.0, 0.95, 0.78), vec3(0.95, 0.18, 0.02), dusk);
  col += sunCol * pow(max(dot(R, normalize(u_sunDir)), 0.0), 220.0) * mix(1.7, 0.7, dusk);
  col += vec3(0.65, 0.74, 0.9) * pow(max(dot(R, normalize(u_moonDir)), 0.0), 280.0) * (1.0 - day) * 0.55;

  float foam = smoothstep(0.42, 0.92, v_height);
  col = mix(col, vec3(0.86, 0.91, 0.94), foam * 0.32);

  float sparkle = fract(sin(dot(v_world.xz, vec2(12.9898, 78.233))) * 43758.5453);
  col += sunCol * step(0.992, sparkle) * pow(max(dot(N, normalize(u_sunDir)), 0.0), 8.0) * day * 0.35;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || "Shader compile failed");
  }
  return shader;
}

function program(gl, vert, frag) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) || "Program link failed");
  }
  return prog;
}

function createGrid(segments, size) {
  const verts = new Float32Array((segments + 1) * (segments + 1) * 2);
  const half = size / 2;
  let i = 0;
  for (let z = 0; z <= segments; z += 1) {
    for (let x = 0; x <= segments; x += 1) {
      verts[i] = (x / segments) * size - half;
      verts[i + 1] = (z / segments) * size - half;
      i += 2;
    }
  }

  const indices = new Uint16Array(segments * segments * 6);
  let t = 0;
  for (let z = 0; z < segments; z += 1) {
    for (let x = 0; x < segments; x += 1) {
      const a = z * (segments + 1) + x;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      indices[t] = a;
      indices[t + 1] = c;
      indices[t + 2] = b;
      indices[t + 3] = b;
      indices[t + 4] = c;
      indices[t + 5] = d;
      t += 6;
    }
  }

  return { verts, indices };
}

class OceanRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      depth: true,
      powerPreference: "low-power",
    });
    if (!this.gl) throw new Error("WebGL unavailable");

    const gl = this.gl;
    this.sky = program(gl, SKY_VERT, SKY_FRAG);
    this.water = program(gl, WATER_VERT, WATER_FRAG);

    this.skyPos = gl.getAttribLocation(this.sky, "a_pos");
    this.waterPos = gl.getAttribLocation(this.water, "a_xz");
    this.skyUniforms = {
      camForward: gl.getUniformLocation(this.sky, "u_camForward"),
      camRight: gl.getUniformLocation(this.sky, "u_camRight"),
      camUp: gl.getUniformLocation(this.sky, "u_camUp"),
      tanHalfFov: gl.getUniformLocation(this.sky, "u_tanHalfFov"),
      aspect: gl.getUniformLocation(this.sky, "u_aspect"),
      sunDir: gl.getUniformLocation(this.sky, "u_sunDir"),
      moonDir: gl.getUniformLocation(this.sky, "u_moonDir"),
      sunAlt: gl.getUniformLocation(this.sky, "u_sunAlt"),
    };
    this.waterUniforms = {
      viewProj: gl.getUniformLocation(this.water, "u_viewProj"),
      time: gl.getUniformLocation(this.water, "u_time"),
      camPos: gl.getUniformLocation(this.water, "u_camPos"),
      sunDir: gl.getUniformLocation(this.water, "u_sunDir"),
      moonDir: gl.getUniformLocation(this.water, "u_moonDir"),
      sunAlt: gl.getUniformLocation(this.water, "u_sunAlt"),
    };

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const mobile = window.matchMedia("(max-width: 809.98px)").matches;
    const grid = createGrid(mobile ? 48 : 72, 160);
    this.indexCount = grid.indices.length;
    this.waterVerts = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.waterVerts);
    gl.bufferData(gl.ARRAY_BUFFER, grid.verts, gl.STATIC_DRAW);
    this.waterIndex = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.waterIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grid.indices, gl.STATIC_DRAW);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    this.start = performance.now();
    this.frame = 0;
    this.running = false;
    this.resize();
  }

  resize() {
    const cap = window.matchMedia("(max-width: 809.98px)").matches ? 1.25 : 1.6;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  camera(sky) {
    const body = sky.sunAlt > -0.08 ? sky.sunDir : sky.moonDir;
    const rawYaw = Math.atan2(body[0], -body[2]);
    const horizonNeed = 1 - Math.max(0, body[1]);
    const yawLimit = 0.32 + 0.95 * horizonNeed;
    const yaw = Math.max(-yawLimit, Math.min(yawLimit, rawYaw));
    const zen = document.documentElement.classList.contains("is-zen");
    const pitch = zen ? 0.34 + 0.12 * Math.max(0, body[1]) : 0.16;
    const forward = normalize([
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ]);
    const eye = [0, 2.35, 12];
    const target = [
      eye[0] + forward[0] * 40,
      eye[1] + forward[1] * 40,
      eye[2] + forward[2] * 40,
    ];
    const right = normalize(cross(forward, [0, 1, 0]));
    const up = cross(right, forward);
    const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
    const fov = 72 * DEG;
    return { eye, target, forward, right, up, aspect, fov };
  }

  draw(sky, time) {
    const gl = this.gl;
    this.resize();
    const cam = this.camera(sky);
    const view = lookAt(cam.eye, cam.target, [0, 1, 0]);
    const proj = perspective(cam.fov, cam.aspect, 0.2, 220);
    const viewProj = multiply(proj, view);

    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.sky);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.skyPos);
    gl.vertexAttribPointer(this.skyPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(this.skyUniforms.camForward, cam.forward);
    gl.uniform3fv(this.skyUniforms.camRight, cam.right);
    gl.uniform3fv(this.skyUniforms.camUp, cam.up);
    gl.uniform1f(this.skyUniforms.tanHalfFov, Math.tan(cam.fov / 2));
    gl.uniform1f(this.skyUniforms.aspect, cam.aspect);
    gl.uniform3fv(this.skyUniforms.sunDir, sky.sunDir);
    gl.uniform3fv(this.skyUniforms.moonDir, sky.moonDir);
    gl.uniform1f(this.skyUniforms.sunAlt, sky.sunAlt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.water);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.waterVerts);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.waterIndex);
    gl.enableVertexAttribArray(this.waterPos);
    gl.vertexAttribPointer(this.waterPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(this.waterUniforms.viewProj, false, viewProj);
    gl.uniform1f(this.waterUniforms.time, reduceMotion.matches ? 8.5 : time);
    gl.uniform3fv(this.waterUniforms.camPos, cam.eye);
    gl.uniform3fv(this.waterUniforms.sunDir, sky.sunDir);
    gl.uniform3fv(this.waterUniforms.moonDir, sky.moonDir);
    gl.uniform1f(this.waterUniforms.sunAlt, sky.sunAlt);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  startLoop() {
    if (this.running) return;
    this.running = true;
    const tick = (now) => {
      if (!this.running) return;
      if (!document.hidden) {
        this.draw(celestialState(), (now - this.start) / 1000);
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stopLoop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i += 1) {
    const ai0 = a[i];
    const ai1 = a[i + 4];
    const ai2 = a[i + 8];
    const ai3 = a[i + 12];
    out[i] = ai0 * b[0] + ai1 * b[1] + ai2 * b[2] + ai3 * b[3];
    out[i + 4] = ai0 * b[4] + ai1 * b[5] + ai2 * b[6] + ai3 * b[7];
    out[i + 8] = ai0 * b[8] + ai1 * b[9] + ai2 * b[10] + ai3 * b[11];
    out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
  }
  return out;
}

class OceanSound {
  constructor() {
    this.ctx = null;
    this.nodes = [];
    this.enabled = false;
  }

  async start() {
    if (this.enabled) return;
    const ctx = this.ctx ?? new AudioContext();
    this.ctx = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.4;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 380;
    filter.Q.value = 0.65;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const swell = ctx.createGain();
    swell.gain.value = 0.2;
    const swellLfo = ctx.createOscillator();
    swellLfo.frequency.value = 0.06;
    const swellAmt = ctx.createGain();
    swellAmt.gain.value = 0.07;
    swellLfo.connect(swellAmt);
    swellAmt.connect(swell.gain);

    noise.connect(filter);
    filter.connect(swell);
    swell.connect(master);
    noise.start();
    lfo.start();
    swellLfo.start();

    this.nodes = [noise, lfo, swellLfo, master];
    this.enabled = true;
  }

  async stop() {
    if (!this.enabled) return;
    this.nodes.forEach((node) => {
      try {
        node.stop?.();
      } catch {
        /* already stopped */
      }
      try {
        node.disconnect?.();
      } catch {
        /* already disconnected */
      }
    });
    this.nodes = [];
    this.enabled = false;
    if (this.ctx) await this.ctx.suspend();
  }
}

function formatWorcesterClock(date) {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: WORCESTER.timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${time} · Worcester`;
}

const oceanListeners = new Set();
const oceanState = {
  available: false,
  visible: false,
  zen: false,
};

function emitOcean() {
  const snapshot = { ...oceanState };
  oceanListeners.forEach((listener) => listener(snapshot));
}

export function getOceanState() {
  return { ...oceanState };
}

export function subscribeOcean(listener) {
  oceanListeners.add(listener);
  listener({ ...oceanState });
  return () => oceanListeners.delete(listener);
}

function readVisiblePref() {
  if (params.get("ocean") === "0") return false;
  if (params.get("ocean") === "1") return true;
  return window.localStorage.getItem(VISIBLE_KEY) === "1";
}

let setOceanVisibleImpl = () => {};
let setZenImpl = () => {};

export function setOceanVisible(on) {
  setOceanVisibleImpl(Boolean(on));
}

export function setZen(on) {
  setZenImpl(Boolean(on));
}

function initOcean() {
  if (window.matchMedia("(forced-colors: active)").matches) return;

  const canvas = document.querySelector("[data-ocean-canvas]");
  const veil = document.querySelector("[data-ocean-veil]");
  const chrome = document.querySelector("[data-ocean-zen-chrome]");
  const clock = document.querySelector("[data-ocean-clock]");
  const soundButton = document.querySelector("[data-ocean-sound]");
  const exitButton = document.querySelector("[data-ocean-zen-exit]");
  const page = document.querySelector(".page-shell");
  if (!canvas || !veil || !chrome || !page) return;

  const veilParam = params.get("veil");
  if (veilParam != null && veilParam !== "") {
    document.documentElement.style.setProperty("--ocean-veil-opacity", veilParam);
  }

  let renderer;
  try {
    renderer = new OceanRenderer(canvas);
  } catch {
    return;
  }

  chrome.hidden = false;
  chrome.inert = true;

  const sound = new OceanSound();
  let lastFocus = null;
  let clockTimer = 0;

  const syncClock = () => {
    if (clock) clock.textContent = formatWorcesterClock(sceneDate());
  };

  const syncSoundLabel = () => {
    if (!soundButton) return;
    soundButton.textContent = sound.enabled ? "Sound on" : "Sound off";
    soundButton.setAttribute("aria-pressed", sound.enabled ? "true" : "false");
  };

  const setSound = async (on) => {
    if (on) await sound.start();
    else await sound.stop();
    window.localStorage.setItem(SOUND_KEY, on ? "1" : "0");
    syncSoundLabel();
  };

  const applyVisible = (on) => {
    oceanState.visible = on;
    canvas.hidden = !on;
    veil.hidden = !on;
    document.documentElement.classList.toggle("has-ocean", on);
    if (on) renderer.startLoop();
    else renderer.stopLoop();
  };

  const enterZen = async () => {
    if (oceanState.zen) return;
    if (!oceanState.visible) applyVisible(true);
    oceanState.zen = true;
    lastFocus = document.activeElement;
    document.documentElement.classList.add("is-zen");
    page.inert = true;
    chrome.inert = false;
    chrome.setAttribute("aria-hidden", "false");
    document.querySelectorAll("details.mobile-menu").forEach((menu) => {
      menu.open = false;
    });
    syncClock();
    window.clearInterval(clockTimer);
    clockTimer = window.setInterval(syncClock, 15000);
    if (window.localStorage.getItem(SOUND_KEY) === "1") await setSound(true);
    (exitButton ?? chrome).focus();
    emitOcean();
  };

  const exitZen = async () => {
    if (!oceanState.zen) return;
    oceanState.zen = false;
    document.documentElement.classList.remove("is-zen");
    page.inert = false;
    chrome.inert = true;
    chrome.setAttribute("aria-hidden", "true");
    window.clearInterval(clockTimer);
    await setSound(false);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    emitOcean();
  };

  setOceanVisibleImpl = (on) => {
    if (on === oceanState.visible) return;
    if (!on && oceanState.zen) {
      exitZen().then(() => {
        applyVisible(false);
        window.localStorage.setItem(VISIBLE_KEY, "0");
        emitOcean();
      });
      return;
    }
    applyVisible(on);
    window.localStorage.setItem(VISIBLE_KEY, on ? "1" : "0");
    emitOcean();
  };

  setZenImpl = (on) => {
    if (on) enterZen();
    else exitZen();
  };

  exitButton?.addEventListener("click", () => {
    exitZen();
  });

  soundButton?.addEventListener("click", () => {
    setSound(!sound.enabled);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && oceanState.zen) {
      event.preventDefault();
      exitZen();
    }
  });

  syncClock();
  syncSoundLabel();

  oceanState.available = true;
  const startVisible = readVisiblePref() || params.get("zen") === "1";
  applyVisible(startVisible);
  emitOcean();

  if (params.get("zen") === "1") enterZen();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initOcean, { once: true });
} else {
  initOcean();
}
