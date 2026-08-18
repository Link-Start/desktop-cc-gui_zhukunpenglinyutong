/**
 * First-run fluid backdrop.
 *
 * Adapted from `@deepseek-ai/dsh-client-ui-aqua` / DSH-Transparent-UI-Plugin
 * (`src/client/fluid-shader.ts`), MIT License, Copyright (c) 2026 John Wu.
 * https://github.com/WYH66666666/DSH-Transparent-UI-Plugin
 *
 * WebGL2 fluid backdrop. Drift is a two-pass domain warp (quarter-res
 * flow + full-res noise). Structured motions (taiji / storm / tornado /
 * chase) are separate display programs so WebView2 / ANGLE does not have
 * to compile one mega-shader or honor an early-return branch. Reduced-motion
 * paints one static frame. WebGL2 / compile failure is a silent CSS
 * fallback — this must never block first-run setup.
 */

export type FluidMotionMode = 0 | 1 | 2 | 3 | 4;

export function clampFluidMotionMode(
  mode: number | undefined,
): FluidMotionMode {
  const rounded = Math.round(mode ?? 0);
  if (rounded === 1 || rounded === 2 || rounded === 3 || rounded === 4) {
    return rounded;
  }
  return 0;
}

export interface FluidParams {
  mouseRadius: number;
  mouseStrength: number;
  decay: number;
  distortBoost: number;
  noiseBoost: number;
  swirlBoost: number;
  speed: number;
  distortion: number;
  swirl: number;
  swirlIterations: number;
  scale: number;
  rotation: number;
  proportion: number;
  softness: number;
  shapeScale: number;
  offsetX: number;
  offsetY: number;
  color1: string;
  color2: string;
  color3: string;
  /** 0 drift / 1 taiji / 2 storm / 3 tornado / 4 chase. Defaults to drift. */
  motionMode?: number;
}

export const SITE_FLUID_PARAMS: FluidParams = {
  mouseRadius: 0.22,
  mouseStrength: 1.1,
  decay: 0.96,
  distortBoost: 1.35,
  noiseBoost: 0,
  swirlBoost: 0.45,
  speed: 14,
  distortion: 20,
  swirl: 12,
  swirlIterations: 8,
  scale: 0.5,
  rotation: -5,
  proportion: 50,
  softness: 100,
  shapeScale: 10,
  offsetX: 0,
  offsetY: 65,
  color1: "#8AA3D6",
  color2: "#FFFFFF",
  color3: "#FFFFFF",
  motionMode: 0,
};

const VERTEX_SHADER = `#version 300 es
in vec4 a_position;
out vec2 vUv;
void main() {
  vUv = a_position.xy * 0.5 + 0.5;
  gl_Position = a_position;
}
`;

const FLOW_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D u_prev;
uniform vec2 u_mouse;
uniform vec2 u_velocity;
uniform float u_brushRadius;
uniform float u_brushStrength;
uniform float u_decay;
out vec4 fragColor;

void main() {
  vec4 prev = texture(u_prev, vUv);

  prev.r *= u_decay;
  prev.gb = mix(vec2(0.5), prev.gb, u_decay);

  float dist = distance(vUv, u_mouse);

  float influence = exp(-dist * dist / (u_brushRadius * u_brushRadius * 0.5));
  influence = max(0.0, influence - 0.01);

  float speed = length(u_velocity);
  float presenceStrength = u_brushStrength * 0.3;
  float velBonus = min(speed * 3.0, 0.7) * u_brushStrength;
  float totalStrength = presenceStrength + velBonus;

  prev.r = max(prev.r, influence * totalStrength);
  float blendAmt = influence * min(totalStrength, 0.4) * 0.3;
  prev.g = mix(prev.g, clamp(u_velocity.x * 2.0 + 0.5, 0.0, 1.0), blendAmt);
  prev.b = mix(prev.b, clamp(u_velocity.y * 2.0 + 0.5, 0.0, 1.0), blendAmt);

  fragColor = prev;
}
`;

const DISPLAY_COMMON = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_color1, u_color2, u_color3;
out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) { return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv; }
`;

const DISPLAY_NOISE = `
float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }
float noise(vec2 st) {
  vec2 i = floor(st); vec2 f = fract(st);
  float a = random(i), b = random(i + vec2(1,0)), c = random(i + vec2(0,1)), d = random(i + vec2(1,1));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
`;

const DRIFT_DISPLAY_SHADER = `${DISPLAY_COMMON}
uniform float u_pixelRatio;
uniform float u_scale;
uniform float u_rotation;
uniform float u_colorCount;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;
uniform vec2 u_offset;
uniform sampler2D u_flowmap;
uniform float u_distortBoost;
uniform float u_noiseBoost;
uniform float u_swirlBoost;
${DISPLAY_NOISE}
vec3 blend_multi(float mixer, float softness) {
  float edge = 1.0 - softness;
  vec3 col = u_color1.rgb;
  if (u_colorCount > 1.5) { col = mix(col, u_color2.rgb, smoothstep(0.0 + 0.35*edge, 0.7 - 0.35*edge, mixer)); }
  if (u_colorCount > 2.5) { col = mix(col, u_color3.rgb, smoothstep(0.3 + 0.35*edge, 1.0 - 0.35*edge, mixer)); }
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = .5 * u_time;
  float ns = .0005 + .006 * u_scale;
  uv -= .5; uv *= (ns * u_resolution); uv = rotate(uv, u_rotation * .5 * PI);
  uv /= u_pixelRatio; uv += .5; uv += u_offset;

  vec2 fragUV = gl_FragCoord.xy / u_resolution.xy;
  vec4 flow = texture(u_flowmap, fragUV);
  float influence = flow.r;
  vec2 flowDir = (flow.gb - 0.5) * 2.0;

  float n1 = noise(uv + t), n2 = noise(uv*2. - t);
  float angle = n1 * TWO_PI;

  float totalDistortion = u_distortion + influence * u_distortBoost;
  uv.x += 4. * totalDistortion * n2 * cos(angle);
  uv.y += 4. * totalDistortion * n2 * sin(angle);

  uv += flowDir * influence * 0.15;

  if (influence > 0.001) {
    float localNoise = noise(uv * 2.0 + t * 1.5);
    uv += influence * u_noiseBoost * vec2(cos(localNoise * TWO_PI), sin(localNoise * TWO_PI));
  }

  float iters = ceil(clamp(u_swirlIterations, 1., 30.));
  float swirlAmt = clamp(u_swirl, 0., 2.) + influence * u_swirlBoost;
  for (float i = 1.; i <= 30.0; i++) {
    if (i > iters) break;
    uv.x += swirlAmt / i * cos(t + i*1.5*uv.y);
    uv.y += swirlAmt / i * cos(t + i*1.*uv.x);
  }

  float proportion = clamp(u_proportion, 0., 1.);
  vec2 cuv = uv * (.5 + 3.5 * u_shapeScale);
  float shape = .5 + .5 * sin(cuv.x) * cos(cuv.y);
  float mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
  vec3 col = blend_multi(mixer, clamp(u_softness, 0., 1.));
  fragColor = vec4(col, 1.0);
}
`;

const TAIJI_DISPLAY_SHADER = `${DISPLAY_COMMON}
vec3 motionTaiji(vec2 uv, float t) {
  vec2 p = uv - 0.5;
  p.x *= u_resolution.x / u_resolution.y;
  p = rotate(p, t * 0.45);
  p *= 1.72;
  float disk = smoothstep(1.06, 0.9, length(p));
  float topC = length(p - vec2(0.0, 0.5));
  float botC = length(p - vec2(0.0, -0.5));
  float right = smoothstep(-0.03, 0.03, p.x);
  float yang = mix(smoothstep(0.52, 0.46, botC), 1.0 - smoothstep(0.52, 0.46, topC), right);
  yang = mix(yang, 1.0, 1.0 - smoothstep(0.09, 0.13, length(p - vec2(0.0, 0.5))));
  yang = mix(yang, 0.0, 1.0 - smoothstep(0.09, 0.13, length(p - vec2(0.0, -0.5))));
  vec3 fish = mix(u_color1.rgb, u_color2.rgb, yang);
  vec3 wash = mix(u_color3.rgb, u_color2.rgb, 0.35);
  return mix(wash, fish, disk);
}

void main() {
  fragColor = vec4(motionTaiji(vUv, u_time * 7.0), 1.0);
}
`;

const STORM_DISPLAY_SHADER = `${DISPLAY_COMMON}
${DISPLAY_NOISE}
vec3 motionStorm(vec2 uv, float t) {
  vec2 p = uv;
  p.x += t * 0.06;
  float clouds = noise(p * vec2(2.2, 1.4) + t * 0.12);
  clouds = mix(clouds, noise(p * 5.0 - t * 0.2), 0.35);
  float rain = 0.0;
  // Float induction matches the working prototype. ANGLE/D3D can reject
  // or miscompile small integer loops in otherwise valid ES 3.00 sources.
  for (float i = 1.0; i <= 4.0; i++) {
    vec2 q = p * vec2(14.0 * i, 64.0 * i);
    q.x += q.y * 0.42;
    q.y += t * (3.2 + i * 0.8);
    float cell = random(floor(q));
    float streak = smoothstep(0.78, 0.96, cell) * (1.0 - fract(q.y));
    rain += streak / i;
  }
  float flash = pow(max(0.0, sin(t * 0.55) * sin(t * 1.21 + 1.7)), 22.0);
  vec3 col = mix(u_color1.rgb, u_color3.rgb, clouds);
  col = mix(col, u_color2.rgb, clamp(rain, 0.0, 1.0));
  col += flash * 0.38 * u_color2.rgb;
  return col;
}

void main() {
  fragColor = vec4(motionStorm(vUv, u_time * 7.0), 1.0);
}
`;

const TORNADO_DISPLAY_SHADER = `${DISPLAY_COMMON}
${DISPLAY_NOISE}
vec3 motionTornado(vec2 uv, float t) {
  vec2 p = uv - vec2(0.5, 0.46);
  p.x *= u_resolution.x / u_resolution.y;
  float funnel = 0.16 + 0.78 * smoothstep(-0.75, 0.95, p.y);
  p.x /= max(funnel, 0.08);
  float r = length(p);
  float ang = atan(p.y, p.x);
  ang += 1.65 / (r + 0.12) + t * 1.35;
  vec2 sp = vec2(cos(ang), sin(ang)) * r;
  float arms = 0.5 + 0.5 * sin(ang * 3.0 + r * 9.0 - t * 2.8);
  float dust = noise(sp * 5.5 + t * 0.6);
  float core = smoothstep(0.5, 0.0, r);
  vec3 col = mix(u_color3.rgb, u_color1.rgb, arms);
  col = mix(col, u_color2.rgb, dust * 0.38);
  col = mix(col, u_color1.rgb * 0.22, core * 0.75);
  float mask = smoothstep(1.25, 0.28, r);
  return mix(u_color3.rgb, col, mask);
}

void main() {
  fragColor = vec4(motionTornado(vUv, u_time * 7.0), 1.0);
}
`;

function chaseDisplayShader(spine: number, legCount: number): string {
  const alongStep = (0.64 / Math.max(legCount, 1)).toFixed(2);
  return `${DISPLAY_COMMON}
uniform float u_strokeScale;
${DISPLAY_NOISE}
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
  return length(pa - ba * h);
}

// Tapered segment: radius lerps r0 -> r1 along a -> b. Claws, horns,
// whiskers and tail barbs all need sharp tips, which a uniform-radius
// capsule cannot express.
float sdSegT(vec2 p, vec2 a, vec2 b, float r0, float r1) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
  return length(pa - ba * h) - mix(r0, r1, h);
}

float hash11(float n) {
  return random(vec2(n, n * 1.37));
}

// 0 left / 1 right / 2 bottom / 3 top. Points sit past the viewport
// so a dragon can enter and leave like a stage curtain.
vec2 edgePoint(float side, float along, float aspect, float margin) {
  float x = mix(-margin, aspect + margin, along);
  float y = mix(-margin, 1.0 + margin, along);
  if (side < 0.5) return vec2(-margin, y);
  if (side < 1.5) return vec2(aspect + margin, y);
  if (side < 2.5) return vec2(x, -margin);
  return vec2(x, 1.0 + margin);
}

void tourCtrl(float slot, float gen, float aspect, out vec2 a, out vec2 b, out vec2 c, out vec2 d, out float sz) {
  float h = slot * 19.73 + gen * 91.31 + 4.7;
  float entrySide = floor(hash11(h) * 4.0);
  float exitSide = mod(entrySide + 1.0 + floor(hash11(h + 1.3) * 3.0), 4.0);
  float margin = 0.30;
  float alongA = 0.12 + 0.76 * hash11(h + 2.7);
  float alongD = 0.12 + 0.76 * hash11(h + 3.1);
  a = edgePoint(entrySide, alongA, aspect, margin);
  d = edgePoint(exitSide, alongD, aspect, margin);
  // Adjacent edges can collapse into a corner hop. Flip the nearer
  // along so every tour actually crosses the stage.
  vec2 stage = vec2(aspect, 1.0);
  float minSpan = 0.72 * length(stage);
  if (length(d - a) < minSpan) {
    alongA = 1.0 - alongA;
    a = edgePoint(entrySide, alongA, aspect, margin);
    if (length(d - a) < minSpan) {
      alongD = 1.0 - alongD;
      d = edgePoint(exitSide, alongD, aspect, margin);
    }
  }
  vec2 chord = d - a;
  vec2 nrm = normalize(vec2(-chord.y, chord.x) + vec2(1e-4, 0.0));
  float span = max(length(chord), 1e-3);
  // One shared bow + a small S, controls on the chord thirds. Pulling
  // toward screen-center used to loop/cusp and snap the heading.
  float bow = (hash11(h + 4.9) - 0.5) * 0.22 * span;
  float sBend = (hash11(h + 5.5) - 0.5) * 0.08 * span;
  b = mix(a, d, 0.32) + nrm * (bow + sBend);
  c = mix(a, d, 0.68) + nrm * (bow - sBend);
  // Slot 0 stays readable; guests roll a modest random size.
  float roll = hash11(h + 8.8);
  sz = slot < 0.5
    ? mix(0.92, 1.78, roll)
    : mix(0.62, 1.48, roll);
}

vec2 bezierTan(vec2 a, vec2 b, vec2 c, vec2 d, float u) {
  float v = 1.0 - u;
  return 3.0 * v * v * (b - a) + 6.0 * v * u * (c - b) + 3.0 * u * u * (d - c);
}

// Extend the cubic linearly off-stage so the body never curls back
// onto the entry/exit edge.
vec2 bezierExt(vec2 a, vec2 b, vec2 c, vec2 d, float u) {
  if (u <= 0.0) {
    return a + normalize(bezierTan(a, b, c, d, 0.0) + vec2(1e-4, 0.0)) * u * 1.15;
  }
  if (u >= 1.0) {
    return d + normalize(bezierTan(a, b, c, d, 1.0) + vec2(1e-4, 0.0)) * (u - 1.0) * 1.15;
  }
  float v = 1.0 - u;
  return v * v * v * a + 3.0 * v * v * u * b + 3.0 * v * u * u * c + u * u * u * d;
}

// Heading from a look-ahead chord so the skull banks into the turn
// instead of snapping onto the instantaneous derivative.
vec2 tourFwd(vec2 a, vec2 b, vec2 c, vec2 d, float u) {
  float back = 0.05;
  float ahead = 0.12;
  vec2 p0 = bezierExt(a, b, c, d, u - back);
  vec2 p1 = bezierExt(a, b, c, d, u + ahead);
  return normalize(p1 - p0 + vec2(1e-4, 0.0));
}

// Body samples earlier path parameter — a one-way crossing never folds.
// Wave heading uses the cheap cubic tangent; skull still banks with tourFwd.
vec2 dragonSpine(float t, float seed, vec2 a, vec2 b, vec2 c, vec2 d, float headU, float sz, float along) {
  float trail = 0.07 + 0.22 * sz;
  float u = headU - along * trail;
  vec2 pos = bezierExt(a, b, c, d, u);
  vec2 fwd = normalize(bezierTan(a, b, c, d, clamp(u, 0.0, 1.0)) + vec2(1e-4, 0.0));
  vec2 side = vec2(-fwd.y, fwd.x);
  float wave = sin(along * 11.0 - t * 2.4 + seed) * (0.052 * sz * (0.28 + along));
  wave += sin(along * 19.0 - t * 3.1 + seed * 1.4) * (0.013 * sz * along);
  return pos + side * wave;
}

// x = body+head+legs+claws, y = horns/whiskers/ridge/brow/tail-fin, z = eye
// Original Chinese-dragon SDF, scaled onto the curtain tour spine.
vec3 dragonStroke(vec2 p, float t, float seed, vec2 a, vec2 b, vec2 c, vec2 d, float headU, float size) {
  float sc = max(u_strokeScale, 1.0);
  float sz = max(size, 0.45);
  float aa = 1.5 * sc / max(u_resolution.y, 1.0);
  float pad = 0.0035 * (sc - 1.0);

  vec2 bmin = min(min(a, b), min(c, d)) - (0.36 * sz + 0.10);
  vec2 bmax = max(max(a, b), max(c, d)) + (0.36 * sz + 0.10);
  if (p.x < bmin.x || p.y < bmin.y || p.x > bmax.x || p.y > bmax.y) {
    return vec3(0.0);
  }

  vec2 prev = dragonSpine(t, seed, a, b, c, d, headU, sz, 0.0);
  float body = 1e5;
  float ridge = 1e5;
  for (int i = 1; i <= ${spine}; i++) {
    float along = float(i) / ${spine.toFixed(1)};
    vec2 next = dragonSpine(t, seed, a, b, c, d, headU, sz, along);
    float thick = mix(0.024, 0.0040, pow(along, 0.8)) * sz;
    thick *= 1.0 + 0.10 * sin(along * 40.0 + seed);
    body = min(body, sdSegment(p, prev, next) - thick);
    float saw = abs(fract(along * 15.0 - t * 0.15) * 2.0 - 1.0);
    ridge = min(ridge, sdSegment(p, prev, next) - thick * (0.10 + 0.30 * saw) * (1.0 - along * 0.55));
    prev = next;
  }

  vec2 head = dragonSpine(t, seed, a, b, c, d, headU, sz, 0.0);
  vec2 fwd = tourFwd(a, b, c, d, headU);
  vec2 side = vec2(-fwd.y, fwd.x);

  float headSd = sdSegT(p, head - fwd * 0.030 * sz, head + fwd * 0.020 * sz, 0.019 * sz, 0.0145 * sz);
  headSd = min(headSd, sdSegT(p, head + fwd * 0.020 * sz, head + fwd * 0.050 * sz, 0.0145 * sz, 0.0090 * sz));
  headSd = min(headSd, length(p - (head + fwd * 0.055 * sz)) - 0.0105 * sz);
  vec2 jawDir = rotate(fwd, 0.40);
  headSd = min(headSd, sdSegT(p, head + fwd * 0.006 * sz, head + fwd * 0.006 * sz + jawDir * 0.036 * sz, 0.0075 * sz, 0.0025 * sz));

  float mane = 1e5;
  for (int k = -2; k <= 2; k++) {
    float kf = float(k);
    vec2 m0 = head - fwd * 0.006 * sz + side * kf * 0.013 * sz;
    vec2 m1 = m0 - fwd * (0.024 + abs(kf) * 0.005) * sz + side * kf * 0.018 * sz;
    vec2 m2 = m1 - fwd * 0.013 * sz + side * kf * 0.012 * sz + fwd * 0.007 * sz * sin(t * 2.2 + kf * 1.3 + seed);
    mane = min(mane, sdSegT(p, m0, m1, 0.0060 * sz, 0.0034 * sz));
    mane = min(mane, sdSegT(p, m1, m2, 0.0034 * sz, 0.0007 * sz));
  }

  float horn = 1e5;
  for (int hi = 0; hi < 2; hi++) {
    float hs = hi == 0 ? 1.0 : -1.0;
    vec2 hb = head - fwd * 0.014 * sz + side * hs * 0.012 * sz;
    vec2 hm = hb - fwd * 0.034 * sz + side * hs * 0.020 * sz;
    vec2 ht = hb - fwd * 0.060 * sz + side * hs * 0.046 * sz;
    horn = min(horn, sdSegT(p, hb, hm, 0.0050 * sz, 0.0034 * sz));
    horn = min(horn, sdSegT(p, hm, ht, 0.0034 * sz, 0.0011 * sz));
    vec2 t1 = hb - fwd * 0.014 * sz + side * hs * 0.036 * sz;
    vec2 t2 = hm - fwd * 0.016 * sz + side * hs * 0.036 * sz;
    horn = min(horn, sdSegT(p, mix(hb, hm, 0.45), t1, 0.0026 * sz, 0.0008 * sz));
    horn = min(horn, sdSegT(p, mix(hm, ht, 0.40), t2, 0.0022 * sz, 0.0007 * sz));
  }

  float whisk = 1e5;
  for (int wi = 0; wi < 2; wi++) {
    float ws = wi == 0 ? 1.0 : -1.0;
    vec2 wPrev = head + fwd * 0.048 * sz + side * ws * 0.009 * sz;
    for (int si = 1; si <= 4; si++) {
      float fs = float(si) / 4.0;
      float sway = sin(fs * 5.5 - t * 1.8 + seed + ws) * 0.009 * fs;
      vec2 wp = head + fwd * (0.048 - fs * 0.115) * sz
        + side * ws * (0.009 + 0.040 * sin(fs * 2.2) + sway) * sz;
      whisk = min(whisk, sdSegT(p, wPrev, wp, mix(0.0018, 0.0005, fs - 0.25) * sz, mix(0.0018, 0.0005, fs) * sz));
      wPrev = wp;
    }
  }

  float legs = 1e5;
  for (int li = 0; li < ${legCount}; li++) {
    float la = 0.15 + float(li) * ${alongStep};
    float sgn = (li == 0 || li == 2) ? 1.0 : -1.0;
    float paddle = sin(t * 1.9 + float(li) * 1.7 + seed) * 0.10;
    vec2 root = dragonSpine(t, seed, a, b, c, d, headU, sz, la);
    vec2 p0 = dragonSpine(t, seed, a, b, c, d, headU, sz, max(la - 0.04, 0.0));
    vec2 p1 = dragonSpine(t, seed, a, b, c, d, headU, sz, min(la + 0.04, 1.0));
    vec2 alongDir = normalize(p1 - p0 + vec2(1e-4, 0.0));
    vec2 outDir = rotate(vec2(-alongDir.y, alongDir.x) * sgn, paddle);
    vec2 knee = root + outDir * 0.026 * sz + alongDir * 0.012 * sz;
    vec2 ankle = knee + outDir * 0.017 * sz - alongDir * 0.022 * sz;
    legs = min(legs, sdSegT(p, root, knee, 0.0100 * sz, 0.0062 * sz));
    legs = min(legs, sdSegT(p, knee, ankle, 0.0062 * sz, 0.0040 * sz));
    for (int ci = 0; ci < 3; ci++) {
      float ca = (float(ci) - 1.0) * 0.55;
      vec2 cdir = rotate(-alongDir, ca);
      vec2 tip = ankle + cdir * (0.015 - abs(ca) * 0.004) * sz;
      legs = min(legs, sdSegT(p, ankle, tip, 0.0034 * sz, 0.0007 * sz));
    }
  }

  vec2 tailTip = dragonSpine(t, seed, a, b, c, d, headU, sz, 1.0);
  vec2 tailPre = dragonSpine(t, seed, a, b, c, d, headU, sz, 0.94);
  vec2 tailDir = rotate(
    normalize(tailTip - tailPre + vec2(1e-5, 0.0)),
    0.15 * sin(t * 2.0 + seed)
  );
  float tailFin = 1e5;
  for (int fi = 0; fi < 3; fi++) {
    float fa = (float(fi) - 1.0) * 0.42;
    vec2 fd = rotate(tailDir, fa);
    vec2 fe = tailTip + fd * (0.050 - abs(fa) * 0.010) * sz;
    vec2 fpa = p - tailTip;
    vec2 fba = fe - tailTip;
    float fh = clamp(dot(fpa, fba) / max(dot(fba, fba), 1e-5), 0.0, 1.0);
    tailFin = min(tailFin, length(fpa - fba * fh) - (0.0015 + 0.0105 * pow(sin(fh * PI), 0.7)) * sz);
  }

  vec2 eyePos = head + fwd * 0.020 * sz + side * 0.010 * sz;
  float eye = length(p - eyePos) - 0.0048 * sz;
  vec2 browDir = rotate(fwd, 0.55);
  float brow = sdSegT(p, eyePos - browDir * 0.010 * sz, eyePos + browDir * 0.011 * sz, 0.0026 * sz, 0.0009 * sz);

  float fill = 1.0 - smoothstep(-aa, aa, body - pad);
  fill = max(fill, 1.0 - smoothstep(-aa, aa, min(headSd, mane) - pad));
  fill = max(fill, 1.0 - smoothstep(-aa, aa, legs - pad));
  float accent = 1.0 - smoothstep(-aa, aa, horn - pad);
  accent = max(accent, 1.0 - smoothstep(-aa, aa, whisk - pad));
  accent = max(accent, 1.0 - smoothstep(-aa, aa, tailFin - pad));
  accent = max(accent, 1.0 - smoothstep(-aa, aa, brow - pad));
  accent = max(accent, (1.0 - smoothstep(-aa, aa, ridge - pad)) * 0.40);
  float eyeMask = 1.0 - smoothstep(-aa * 0.6, aa * 0.6, eye);
  return vec3(fill, accent, eyeMask);
}

// Slot 0 is always touring (min 1). Slot 1 comes and goes so the
// stage holds at most 2 dragons.
vec3 slotParam(float slot) {
  vec3 p = vec3(16.0, 0.0, 1.0);
  p = mix(p, vec3(21.0, 6.4, 0.78), step(0.5, slot));
  return p;
}

float spawnChance(float slot) {
  return mix(1.0, 0.82, step(0.5, slot));
}

void compositeDragon(inout vec3 col, vec3 stroke, vec3 fillCol, vec3 eyeCol) {
  col = mix(col, fillCol, clamp(stroke.x, 0.0, 1.0));
  col = mix(col, fillCol * 0.72, stroke.y);
  col = mix(col, eyeCol, stroke.z);
}

void paintTour(vec2 p, float t, float slot, float gen, float headU, vec3 fillCol, vec3 eyeCol, inout vec3 col) {
  if (hash11(slot * 17.3 + gen * 91.7 + 2.4) > spawnChance(slot)) {
    return;
  }
  vec2 a, b, c, d;
  float sz;
  tourCtrl(slot, gen, u_resolution.x / max(u_resolution.y, 1.0), a, b, c, d, sz);
  float seed = slot * 1.7 + gen * 0.37;
  compositeDragon(col, dragonStroke(p, t, seed, a, b, c, d, headU, sz), fillCol, eyeCol);
}

void addSlot(vec2 p, float t, float slot, vec3 fillCol, vec3 eyeCol, inout vec3 col) {
  vec3 par = slotParam(slot);
  float cycle = par.x;
  float duty = par.z;
  float raw = (t + par.y) / cycle;
  float gen = floor(raw);
  float frac = raw - gen;
  float tail = 0.40;
  if (slot < 0.5) {
    // Head crosses 0→1 in one cycle. The previous tail keeps going
    // 1→1+tail so it leaves instead of rewinding onto the same edge.
    paintTour(p, t, slot, gen, frac, fillCol, eyeCol, col);
    if (frac < tail) {
      paintTour(p, t, slot, gen - 1.0, 1.0 + frac, fillCol, eyeCol, col);
    }
    return;
  }
  float travel = (frac / max(duty, 1e-3)) * (1.0 + tail);
  if (frac < duty && travel <= 1.0 + tail) {
    paintTour(p, t, slot, gen, travel, fillCol, eyeCol, col);
  }
}

vec3 motionChase(vec2 uv, float t) {
  vec2 p = uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  p.x *= aspect;

  vec3 wash = mix(u_color3.rgb, u_color2.rgb, 0.12);
  vec3 yangCol = u_color1.rgb;
  vec3 yinRaw = u_color2.rgb;
  float washLum = dot(wash, vec3(0.2126, 0.7152, 0.0722));
  float yinLum = dot(yinRaw, vec3(0.2126, 0.7152, 0.0722));
  vec3 yinCol = abs(yinLum - washLum) > 0.14
    ? yinRaw
    : (washLum > 0.5 ? yangCol * 0.22 : mix(vec3(1.0), yangCol, 0.18));

  vec3 col = wash;
  addSlot(p, t, 0.0, yangCol, yinCol, col);
  addSlot(p, t, 1.0, yinCol, yangCol, col);
  return col;
}

void main() {
  fragColor = vec4(motionChase(vUv, u_time * 7.0), 1.0);
}
`;
}

export function buildDisplayFragmentShader(
  mode: number,
  options: { reduced?: boolean } = {},
): string {
  switch (clampFluidMotionMode(mode)) {
    case 1:
      return TAIJI_DISPLAY_SHADER;
    case 2:
      return STORM_DISPLAY_SHADER;
    case 3:
      return TORNADO_DISPLAY_SHADER;
    case 4:
      return options.reduced
        ? chaseDisplayShader(14, 2)
        : chaseDisplayShader(20, 4);
    default:
      return DRIFT_DISPLAY_SHADER;
  }
}

function hexToRgb(value: string): [number, number, number] {
  const hex = value.replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

export type FluidShaderProfile = "full" | "lite";

export type FluidShaderAttachOptions = {
  /**
   * Windows / WebView2 only. Mac keeps OS reduced-motion (static frame).
   * WebView2 can report reduce even when the user opted into fluid.
   */
  forceAnimate?: boolean;
  /**
   * Windows / WebView2 only. Skip compiling chase until it is selected.
   * Mac precompiles all five fields the way the working Metal path did.
   */
  deferChase?: boolean;
};

export interface FluidShaderHandle {
  readonly attached: boolean;
  setParams: (params: FluidParams) => void;
  stir: (x: number, y: number, vx: number, vy: number) => void;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
}

function noopHandle(): FluidShaderHandle {
  return {
    attached: false,
    setParams: () => undefined,
    stir: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
    dispose: () => undefined,
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const WEBGL2_CONTEXT_ATTEMPTS: WebGLContextAttributes[] = [
  // Same flags as the working design prototype. `desynchronized` is unused
  // here (mouse stir is a no-op) and WebView2 / ANGLE may reject it.
  {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  },
  {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  },
  {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "default",
  },
];

function getWebGL2Context(
  canvas: HTMLCanvasElement,
): WebGL2RenderingContext | null {
  for (const attrs of WEBGL2_CONTEXT_ATTEMPTS) {
    try {
      const gl = canvas.getContext("webgl2", attrs);
      if (gl) {
        return gl;
      }
    } catch {
      // WebView2 / ANGLE can throw on unsupported context flags.
    }
  }
  try {
    return canvas.getContext("webgl2");
  } catch {
    return null;
  }
}

function warnFluidShader(stage: string, detail: string | null): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") {
    return;
  }
  console.warn(`[fluidShader] ${stage} failed`, detail ?? "");
}

/**
 * Mount the fluid simulation on a canvas and run it until disposed.
 * Missing WebGL2 / compile failure returns a no-op handle.
 */
export function attachFluidShader(
  canvas: HTMLCanvasElement,
  params: FluidParams,
  profile: FluidShaderProfile = "full",
  options: FluidShaderAttachOptions = {},
): FluidShaderHandle {
  const lite = profile === "lite";
  const forceAnimate = options.forceAnimate === true;
  const deferChase = options.deferChase === true;
  const gl = getWebGL2Context(canvas);
  if (gl === null) {
    warnFluidShader("webgl2 context", "getContext returned null");
    return noopHandle();
  }

  const compile = (type: number, source: string): WebGLShader | null => {
    try {
      const shader = gl.createShader(type);
      if (shader === null) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        warnFluidShader(
          type === gl.VERTEX_SHADER ? "vertex compile" : "fragment compile",
          gl.getShaderInfoLog(shader),
        );
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    } catch (error) {
      warnFluidShader(
        type === gl.VERTEX_SHADER ? "vertex compile" : "fragment compile",
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  };

  const link = (fragment: string): WebGLProgram | null => {
    try {
      const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const frag = compile(gl.FRAGMENT_SHADER, fragment);
      if (vertex === null || frag === null) return null;
      const program = gl.createProgram();
      if (program === null) return null;
      gl.attachShader(program, vertex);
      gl.attachShader(program, frag);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        warnFluidShader("program link", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
      }
      return program;
    } catch (error) {
      warnFluidShader(
        "program link",
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  };

  const flowProgram = link(FLOW_SHADER);
  if (flowProgram === null) {
    warnFluidShader("flow program", "compile or link failed");
  }

  interface DisplayLocs {
    time: WebGLUniformLocation | null;
    pixelRatio: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
    scale: WebGLUniformLocation | null;
    rotation: WebGLUniformLocation | null;
    offset: WebGLUniformLocation | null;
    color1: WebGLUniformLocation | null;
    color2: WebGLUniformLocation | null;
    color3: WebGLUniformLocation | null;
    colorCount: WebGLUniformLocation | null;
    proportion: WebGLUniformLocation | null;
    softness: WebGLUniformLocation | null;
    shape: WebGLUniformLocation | null;
    shapeScale: WebGLUniformLocation | null;
    distortion: WebGLUniformLocation | null;
    swirl: WebGLUniformLocation | null;
    swirlIterations: WebGLUniformLocation | null;
    flowmap: WebGLUniformLocation | null;
    distortBoost: WebGLUniformLocation | null;
    noiseBoost: WebGLUniformLocation | null;
    swirlBoost: WebGLUniformLocation | null;
    strokeScale: WebGLUniformLocation | null;
  }
  interface DisplayBinding {
    program: WebGLProgram;
    locs: DisplayLocs;
  }

  const locateDisplay = (program: WebGLProgram): DisplayLocs => ({
    time: gl.getUniformLocation(program, "u_time"),
    pixelRatio: gl.getUniformLocation(program, "u_pixelRatio"),
    resolution: gl.getUniformLocation(program, "u_resolution"),
    scale: gl.getUniformLocation(program, "u_scale"),
    rotation: gl.getUniformLocation(program, "u_rotation"),
    offset: gl.getUniformLocation(program, "u_offset"),
    color1: gl.getUniformLocation(program, "u_color1"),
    color2: gl.getUniformLocation(program, "u_color2"),
    color3: gl.getUniformLocation(program, "u_color3"),
    colorCount: gl.getUniformLocation(program, "u_colorCount"),
    proportion: gl.getUniformLocation(program, "u_proportion"),
    softness: gl.getUniformLocation(program, "u_softness"),
    shape: gl.getUniformLocation(program, "u_shape"),
    shapeScale: gl.getUniformLocation(program, "u_shapeScale"),
    distortion: gl.getUniformLocation(program, "u_distortion"),
    swirl: gl.getUniformLocation(program, "u_swirl"),
    swirlIterations: gl.getUniformLocation(program, "u_swirlIterations"),
    flowmap: gl.getUniformLocation(program, "u_flowmap"),
    distortBoost: gl.getUniformLocation(program, "u_distortBoost"),
    noiseBoost: gl.getUniformLocation(program, "u_noiseBoost"),
    swirlBoost: gl.getUniformLocation(program, "u_swirlBoost"),
    strokeScale: gl.getUniformLocation(program, "u_strokeScale"),
  });

  const displayCache = new Map<string, DisplayBinding | null>();
  const compileDisplay = (
    mode: FluidMotionMode,
    reduced = false,
  ): DisplayBinding | null => {
    const key = reduced ? `${mode}-reduced` : String(mode);
    const cached = displayCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const program = link(buildDisplayFragmentShader(mode, { reduced }));
    if (program === null) {
      warnFluidShader(
        `display mode ${mode}${reduced ? " reduced" : ""}`,
        "compile or link failed",
      );
      displayCache.set(key, null);
      return null;
    }
    const binding = { program, locs: locateDisplay(program) };
    displayCache.set(key, binding);
    return binding;
  };
  const ensureDisplay = (mode: FluidMotionMode): DisplayBinding | null => {
    const primary = compileDisplay(mode);
    if (primary) {
      return primary;
    }
    return mode === 4 ? compileDisplay(4, true) : null;
  };

  // Mac compiles every field up front (chase included). WebView2 / ANGLE
  // can lose the context if chase is baked before the first present.
  const eagerModes: FluidMotionMode[] = deferChase
    ? [0, 1, 2, 3]
    : [0, 1, 2, 3, 4];
  for (const mode of eagerModes) {
    ensureDisplay(mode);
  }
  const initialDisplay = ensureDisplay(clampFluidMotionMode(params.motionMode));
  if (initialDisplay === null) {
    return noopHandle();
  }

  const flow =
    flowProgram === null
      ? null
      : {
          prev: gl.getUniformLocation(flowProgram, "u_prev"),
          mouse: gl.getUniformLocation(flowProgram, "u_mouse"),
          velocity: gl.getUniformLocation(flowProgram, "u_velocity"),
          brushRadius: gl.getUniformLocation(flowProgram, "u_brushRadius"),
          brushStrength: gl.getUniformLocation(flowProgram, "u_brushStrength"),
          decay: gl.getUniformLocation(flowProgram, "u_decay"),
        };

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const bindQuad = (program: WebGLProgram): void => {
    const position = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  };

  interface FlowTarget {
    fbo: WebGLFramebuffer;
    tex: WebGLTexture;
  }
  const makeTarget = (
    width: number,
    height: number,
    initial?: Uint8Array,
  ): FlowTarget | null => {
    const tex = gl.createTexture();
    if (tex === null) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (initial !== undefined) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        initial,
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    if (fbo === null) return null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex };
  };

  let width = 0;
  let height = 0;
  let flowWidth = 0;
  let flowHeight = 0;
  let flip = false;
  let current: FluidParams = { ...params };
  const dprCap = lite ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  const resolutionScale = lite ? 0.5 : 1;
  // Drift keeps the flow ping-pong at 30. Structured fields (chase
  // especially) have no flow pass — present at display refresh so the
  // curtain walk does not quantize into 30 fps steps.
  const fpsFor = (mode: number): number => {
    if (lite) return 12;
    return mode === 0 ? 30 : 60;
  };
  const measureCanvasSize = (): { nextWidth: number; nextHeight: number } => ({
    nextWidth: Math.max(
      1,
      Math.round(canvas.clientWidth * dprCap * resolutionScale),
    ),
    nextHeight: Math.max(
      1,
      Math.round(canvas.clientHeight * dprCap * resolutionScale),
    ),
  });
  ({ nextWidth: width, nextHeight: height } = measureCanvasSize());
  canvas.width = width;
  canvas.height = height;
  flowWidth = Math.max(1, Math.round(width / (lite ? 6 : 4)));
  flowHeight = Math.max(1, Math.round(height / (lite ? 6 : 4)));

  const initial = new Uint8Array(flowWidth * flowHeight * 4);
  for (let i = 0; i < flowWidth * flowHeight; i += 1) {
    initial[4 * i] = 0;
    initial[4 * i + 1] = 128;
    initial[4 * i + 2] = 128;
    initial[4 * i + 3] = 255;
  }
  const targetA = makeTarget(flowWidth, flowHeight, initial);
  const targetB = makeTarget(flowWidth, flowHeight, initial);
  const flowReady =
    flowProgram !== null &&
    flow !== null &&
    targetA !== null &&
    targetB !== null;

  const start = performance.now();
  let raf = 0;
  let previous = 0;
  let paused = false;
  let disposed = false;

  const syncCanvasSize = (): void => {
    const { nextWidth, nextHeight } = measureCanvasSize();
    if (nextWidth === width && nextHeight === height) {
      return;
    }
    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;
  };

  const shouldAnimate = (): boolean => forceAnimate || !prefersReducedMotion();

  const draw = (now: number): void => {
    const p = current;
    const mode = clampFluidMotionMode(p.motionMode);
    const display = ensureDisplay(mode);
    if (display === null) {
      const fallback = hexToRgb(p.color3 || "#FFFFFF");
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.clearColor(fallback[0], fallback[1], fallback[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    if (mode === 0 && flowReady && targetA && targetB && flow && flowProgram) {
      const read = flip ? targetA : targetB;
      const write = flip ? targetB : targetA;
      flip = !flip;

      gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
      gl.viewport(0, 0, flowWidth, flowHeight);
      gl.useProgram(flowProgram);
      bindQuad(flowProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, read.tex);
      gl.uniform1i(flow.prev, 0);
      gl.uniform2f(flow.mouse, 0.5, 0.5);
      gl.uniform2f(flow.velocity, 0, 0);
      gl.uniform1f(flow.brushRadius, p.mouseRadius);
      gl.uniform1f(flow.brushStrength, p.mouseStrength);
      gl.uniform1f(flow.decay, p.decay);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, write.tex);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    const locs = display.locs;
    gl.viewport(0, 0, width, height);
    gl.useProgram(display.program);
    bindQuad(display.program);
    const time = (performance.now() - start) * 0.001 * (p.speed / 100);
    gl.uniform1f(locs.time, time);
    gl.uniform1f(locs.pixelRatio, window.devicePixelRatio || 1);
    gl.uniform2f(locs.resolution, width, height);
    gl.uniform1f(locs.scale, p.scale);
    gl.uniform1f(locs.rotation, p.rotation / 90);
    gl.uniform2f(locs.offset, p.offsetX / 100, p.offsetY / 100);
    const c1 = hexToRgb(p.color1 || "#2E58A4");
    const c2 = hexToRgb(p.color2 || "#D2E2EE");
    const c3 = hexToRgb(p.color3 || "#FFFFFF");
    gl.uniform4f(locs.color1, c1[0], c1[1], c1[2], 1);
    gl.uniform4f(locs.color2, c2[0], c2[1], c2[2], 1);
    gl.uniform4f(locs.color3, c3[0], c3[1], c3[2], 1);
    gl.uniform1f(locs.colorCount, 3);
    gl.uniform1f(locs.proportion, p.proportion / 100);
    gl.uniform1f(locs.softness, p.softness / 100);
    gl.uniform1f(locs.shape, 0);
    gl.uniform1f(locs.shapeScale, p.shapeScale / 100);
    gl.uniform1f(locs.distortion, p.distortion / 100);
    gl.uniform1f(locs.swirl, p.swirl / 50);
    gl.uniform1f(
      locs.swirlIterations,
      lite ? Math.min(p.swirlIterations, 4) : p.swirlIterations,
    );
    gl.uniform1i(locs.flowmap, 0);
    gl.uniform1f(locs.distortBoost, p.distortBoost);
    gl.uniform1f(locs.noiseBoost, p.noiseBoost);
    gl.uniform1f(locs.swirlBoost, p.swirlBoost);
    gl.uniform1f(locs.strokeScale, lite ? 2.4 : 1.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const frame = (now: number): void => {
    if (disposed || paused) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
    const step = 1000 / fpsFor(clampFluidMotionMode(current.motionMode));
    if (now - previous < step) return;
    previous = now - ((now - previous) % step);
    draw(now);
  };

  const stopLoop = (): void => {
    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const startLoop = (): void => {
    if (disposed || paused || !shouldAnimate() || raf !== 0) {
      return;
    }
    previous = 0;
    raf = requestAnimationFrame(frame);
  };

  const handleHidden = (): void => {
    if (document.hidden) {
      stopLoop();
      return;
    }
    startLoop();
  };

  const handle: FluidShaderHandle = {
    attached: true,
    setParams: (next: FluidParams) => {
      current = { ...next };
      ensureDisplay(clampFluidMotionMode(next.motionMode));
      previous = 0;
      draw(performance.now());
      startLoop();
    },
    stir: () => undefined,
    pause: () => {
      paused = true;
      stopLoop();
    },
    resume: () => {
      if (disposed) {
        return;
      }
      paused = false;
      startLoop();
    },
    dispose: () => {
      disposed = true;
      paused = true;
      stopLoop();
      window.removeEventListener("resize", syncCanvasSize);
      document.removeEventListener("visibilitychange", handleHidden);
      resizeObserver?.disconnect();
    },
  };

  window.addEventListener("resize", syncCanvasSize);
  document.addEventListener("visibilitychange", handleHidden);
  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          syncCanvasSize();
        });
  resizeObserver?.observe(canvas);

  draw(performance.now());
  startLoop();
  return handle;
}
