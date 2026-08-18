/**
 * First-run fluid backdrop.
 *
 * Adapted from `@deepseek-ai/dsh-client-ui-aqua` / DSH-Transparent-UI-Plugin
 * (`src/client/fluid-shader.ts`), MIT License, Copyright (c) 2026 John Wu.
 * https://github.com/WYH66666666/DSH-Transparent-UI-Plugin
 *
 * WebGL2 two-pass fluid: quarter-res flow field + full-res domain-warped
 * noise. Reduced-motion paints one static frame. WebGL2 failure is a silent
 * CSS fallback — this must never block first-run setup.
 */

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

const DISPLAY_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1, u_color2, u_color3;
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
uniform float u_motionMode;
out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) { return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv; }
float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }
float noise(vec2 st) {
  vec2 i = floor(st); vec2 f = fract(st);
  float a = random(i), b = random(i + vec2(1,0)), c = random(i + vec2(0,1)), d = random(i + vec2(1,1));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

vec3 blend_multi(float mixer, float softness) {
  float edge = 1.0 - softness;
  vec3 col = u_color1.rgb;
  if (u_colorCount > 1.5) { col = mix(col, u_color2.rgb, smoothstep(0.0 + 0.35*edge, 0.7 - 0.35*edge, mixer)); }
  if (u_colorCount > 2.5) { col = mix(col, u_color3.rgb, smoothstep(0.3 + 0.35*edge, 1.0 - 0.35*edge, mixer)); }
  return col;
}

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

vec3 motionStorm(vec2 uv, float t) {
  vec2 p = uv;
  p.x += t * 0.06;
  float clouds = noise(p * vec2(2.2, 1.4) + t * 0.12);
  clouds = mix(clouds, noise(p * 5.0 - t * 0.2), 0.35);
  float rain = 0.0;
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

// Head wanders. Body is a long S-curve trailing the heading — never
// resample the wander backward (that folds into a blob).
vec2 dragonHead(float t, float seed, float aspect) {
  return vec2(
    0.50 * aspect
      + 0.26 * sin(t * 0.13 + seed)
      + 0.12 * sin(t * 0.27 + seed * 1.7)
      + 0.06 * cos(t * 0.43 + seed * 0.6),
    0.50
      + 0.22 * cos(t * 0.11 + seed * 1.2)
      + 0.12 * sin(t * 0.23 + seed * 0.5)
      + 0.05 * cos(t * 0.39 + seed * 1.9)
  );
}

vec2 dragonFwd(float t, float seed) {
  float hx = 0.26 * 0.13 * cos(t * 0.13 + seed)
    + 0.12 * 0.27 * cos(t * 0.27 + seed * 1.7)
    - 0.06 * 0.43 * sin(t * 0.43 + seed * 0.6);
  float hy = -0.22 * 0.11 * sin(t * 0.11 + seed * 1.2)
    + 0.12 * 0.23 * cos(t * 0.23 + seed * 0.5)
    - 0.05 * 0.39 * sin(t * 0.39 + seed * 1.9);
  float extra = 0.55 * sin(t * 0.19 + seed * 2.1);
  float c = cos(extra);
  float s = sin(extra);
  vec2 turned = vec2(hx * c - hy * s, hx * s + hy * c);
  return normalize(turned + vec2(1e-4, 0.0));
}

vec2 dragonSpine(float t, float seed, float aspect, float along) {
  vec2 head = dragonHead(t, seed, aspect);
  vec2 fwd = dragonFwd(t, seed);
  vec2 side = vec2(-fwd.y, fwd.x);
  float wave = sin(along * 12.6 - t * 2.6 + seed) * (0.078 * (0.25 + along));
  wave += sin(along * 22.0 - t * 3.4 + seed * 1.6) * (0.020 * along);
  float curl = along * along * 0.10 * sin(t * 0.7 + seed);
  return head - fwd * (along * 0.70) + side * (wave + curl);
}

// x = body+head+legs+claws, y = horns/whiskers/ridge/brow/tail-fin, z = eye
// Anatomy follows the ink-painting Chinese dragon: antler horns, mane,
// backward-flowing whiskers, four clawed legs and a flame tail fin.
vec3 dragonStroke(vec2 p, float t, float seed, float aspect) {
  // Resolution-aware AA: one world unit spans the canvas height, so a
  // fixed edge width goes blurry on the half-res lite profile.
  float aa = 1.5 / max(u_resolution.y, 1.0);

  vec2 prev = dragonSpine(t, seed, aspect, 0.0);
  float body = 1e5;
  float ridge = 1e5;
  for (int i = 1; i <= 26; i++) {
    float along = float(i) / 26.0;
    vec2 next = dragonSpine(t, seed, aspect, along);
    float thick = mix(0.024, 0.0040, pow(along, 0.8));
    thick *= 1.0 + 0.10 * sin(along * 40.0 + seed);
    body = min(body, sdSegment(p, prev, next) - thick);
    // Dorsal ridge: centered spine line with a sawtooth silhouette so it
    // reads as 脊刺 rather than a plain stripe.
    float saw = abs(fract(along * 15.0 - t * 0.15) * 2.0 - 1.0);
    ridge = min(ridge, sdSegment(p, prev, next) - thick * (0.10 + 0.30 * saw) * (1.0 - along * 0.55));
    prev = next;
  }

  vec2 head = dragonSpine(t, seed, aspect, 0.0);
  vec2 fwd = dragonFwd(t, seed);
  vec2 side = vec2(-fwd.y, fwd.x);

  // Skull + elongated snout + nose tip + slightly open lower jaw.
  float headSd = sdSegT(p, head - fwd * 0.030, head + fwd * 0.020, 0.019, 0.0145);
  headSd = min(headSd, sdSegT(p, head + fwd * 0.020, head + fwd * 0.050, 0.0145, 0.0090));
  headSd = min(headSd, length(p - (head + fwd * 0.055)) - 0.0105);
  vec2 jawDir = rotate(fwd, 0.40);
  headSd = min(headSd, sdSegT(p, head + fwd * 0.006, head + fwd * 0.006 + jawDir * 0.036, 0.0075, 0.0025));

  // Flame mane behind the skull, tips fluttering.
  float mane = 1e5;
  for (int k = -2; k <= 2; k++) {
    float kf = float(k);
    vec2 m0 = head - fwd * 0.006 + side * kf * 0.013;
    vec2 m1 = m0 - fwd * (0.024 + abs(kf) * 0.005) + side * kf * 0.018;
    vec2 m2 = m1 - fwd * 0.013 + side * kf * 0.012 + fwd * 0.007 * sin(t * 2.2 + kf * 1.3 + seed);
    mane = min(mane, sdSegT(p, m0, m1, 0.0060, 0.0034));
    mane = min(mane, sdSegT(p, m1, m2, 0.0034, 0.0007));
  }

  // Antler horns: a main beam curving back-outward with two tines each.
  float horn = 1e5;
  for (int hi = 0; hi < 2; hi++) {
    float hs = hi == 0 ? 1.0 : -1.0;
    vec2 hb = head - fwd * 0.014 + side * hs * 0.012;
    vec2 hm = hb - fwd * 0.034 + side * hs * 0.020;
    vec2 ht = hb - fwd * 0.060 + side * hs * 0.046;
    horn = min(horn, sdSegT(p, hb, hm, 0.0050, 0.0034));
    horn = min(horn, sdSegT(p, hm, ht, 0.0034, 0.0011));
    vec2 t1 = hb - fwd * 0.014 + side * hs * 0.036;
    vec2 t2 = hm - fwd * 0.016 + side * hs * 0.036;
    horn = min(horn, sdSegT(p, mix(hb, hm, 0.45), t1, 0.0026, 0.0008));
    horn = min(horn, sdSegT(p, mix(hm, ht, 0.40), t2, 0.0022, 0.0007));
  }

  // Whiskers spring from the snout and stream backward past the head in
  // a flowing sine wave — stiff bent wires read as insect antennae.
  float whisk = 1e5;
  for (int wi = 0; wi < 2; wi++) {
    float ws = wi == 0 ? 1.0 : -1.0;
    vec2 wPrev = head + fwd * 0.048 + side * ws * 0.009;
    for (int si = 1; si <= 4; si++) {
      float fs = float(si) / 4.0;
      float sway = sin(fs * 5.5 - t * 1.8 + seed + ws) * 0.009 * fs;
      vec2 wp = head + fwd * (0.048 - fs * 0.115)
        + side * ws * (0.009 + 0.040 * sin(fs * 2.2) + sway);
      whisk = min(whisk, sdSegT(p, wPrev, wp, mix(0.0018, 0.0005, fs - 0.25), mix(0.0018, 0.0005, fs)));
      wPrev = wp;
    }
  }

  // Four legs: thigh -> knee -> ankle, then a paw of three sharp claws
  // fanning forward. A gentle per-leg phase keeps them paddling.
  float legs = 1e5;
  for (int li = 0; li < 4; li++) {
    float la = 0.15 + float(li) * 0.16;
    float sgn = (li == 0 || li == 2) ? 1.0 : -1.0;
    float paddle = sin(t * 1.9 + float(li) * 1.7 + seed) * 0.10;
    vec2 root = dragonSpine(t, seed, aspect, la);
    vec2 p0 = dragonSpine(t, seed, aspect, max(la - 0.04, 0.0));
    vec2 p1 = dragonSpine(t, seed, aspect, min(la + 0.04, 1.0));
    vec2 alongDir = normalize(p1 - p0 + vec2(1e-4, 0.0));
    vec2 outDir = rotate(vec2(-alongDir.y, alongDir.x) * sgn, paddle);
    vec2 knee = root + outDir * 0.026 + alongDir * 0.012;
    vec2 ankle = knee + outDir * 0.017 - alongDir * 0.022;
    legs = min(legs, sdSegT(p, root, knee, 0.0100, 0.0062));
    legs = min(legs, sdSegT(p, knee, ankle, 0.0062, 0.0040));
    for (int ci = 0; ci < 3; ci++) {
      float ca = (float(ci) - 1.0) * 0.55;
      vec2 cdir = rotate(-alongDir, ca);
      vec2 tip = ankle + cdir * (0.015 - abs(ca) * 0.004);
      legs = min(legs, sdSegT(p, ankle, tip, 0.0034, 0.0007));
    }
  }

  // Flame tail fin: three narrow leaf lobes fanning past the tapered
  // tail tip — a fishtail/flame tuft, not a balloon. The whole fin sways.
  vec2 tailTip = dragonSpine(t, seed, aspect, 1.0);
  vec2 tailPre = dragonSpine(t, seed, aspect, 0.94);
  vec2 tailDir = rotate(
    normalize(tailTip - tailPre + vec2(1e-5, 0.0)),
    0.15 * sin(t * 2.0 + seed)
  );
  float tailFin = 1e5;
  for (int fi = 0; fi < 3; fi++) {
    float fa = (float(fi) - 1.0) * 0.42;
    vec2 fd = rotate(tailDir, fa);
    vec2 fe = tailTip + fd * (0.050 - abs(fa) * 0.010);
    vec2 fpa = p - tailTip;
    vec2 fba = fe - tailTip;
    float fh = clamp(dot(fpa, fba) / max(dot(fba, fba), 1e-5), 0.0, 1.0);
    tailFin = min(tailFin, length(fpa - fba * fh) - (0.0015 + 0.0105 * pow(sin(fh * PI), 0.7)));
  }

  vec2 eyePos = head + fwd * 0.020 + side * 0.010;
  float eye = length(p - eyePos) - 0.0048;
  vec2 browDir = rotate(fwd, 0.55);
  float brow = sdSegT(p, eyePos - browDir * 0.010, eyePos + browDir * 0.011, 0.0026, 0.0009);

  float fill = 1.0 - smoothstep(-aa, aa, body);
  fill = max(fill, 1.0 - smoothstep(-aa, aa, min(headSd, mane)));
  fill = max(fill, 1.0 - smoothstep(-aa, aa, legs));
  float accent = 1.0 - smoothstep(-aa, aa, horn);
  accent = max(accent, 1.0 - smoothstep(-aa, aa, whisk));
  accent = max(accent, 1.0 - smoothstep(-aa, aa, tailFin));
  accent = max(accent, 1.0 - smoothstep(-aa, aa, brow));
  accent = max(accent, (1.0 - smoothstep(-aa, aa, ridge)) * 0.40);
  float eyeMask = 1.0 - smoothstep(-aa * 0.6, aa * 0.6, eye);
  return vec3(fill, accent, eyeMask);
}

vec3 motionChase(vec2 uv, float t) {
  vec2 p = uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  p.x *= aspect;

  vec3 yang = dragonStroke(p, t, 0.35, aspect);
  vec3 yin = dragonStroke(p, t * 0.87 + 5.2, 3.9, aspect);

  vec3 wash = mix(u_color3.rgb, u_color2.rgb, 0.12);
  vec3 yangCol = u_color1.rgb;
  vec3 yinRaw = u_color2.rgb;
  float washLum = dot(wash, vec3(0.2126, 0.7152, 0.0722));
  float yinLum = dot(yinRaw, vec3(0.2126, 0.7152, 0.0722));
  vec3 yinCol = abs(yinLum - washLum) > 0.14
    ? yinRaw
    : (washLum > 0.5 ? yangCol * 0.22 : mix(vec3(1.0), yangCol, 0.18));

  vec3 col = wash;
  col = mix(col, yangCol, clamp(yang.x, 0.0, 1.0));
  col = mix(col, yinCol, clamp(yin.x, 0.0, 1.0));
  col = mix(col, yangCol * 0.72, yang.y);
  col = mix(col, yinCol * 0.72, yin.y);
  col = mix(col, yinCol, yang.z);
  col = mix(col, yangCol, yin.z);
  return col;
}

void main() {
  if (u_motionMode > 0.5) {
    float structuredTime = u_time * 7.0;
    vec3 structured;
    if (u_motionMode < 1.5) structured = motionTaiji(vUv, structuredTime);
    else if (u_motionMode < 2.5) structured = motionStorm(vUv, structuredTime);
    else if (u_motionMode < 3.5) structured = motionTornado(vUv, structuredTime);
    else structured = motionChase(vUv, structuredTime);
    fragColor = vec4(structured, 1.0);
    return;
  }

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

function hexToRgb(value: string): [number, number, number] {
  const hex = value.replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

export type FluidShaderProfile = "full" | "lite";

export interface FluidShaderHandle {
  setParams: (params: FluidParams) => void;
  stir: (x: number, y: number, vx: number, vy: number) => void;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
}

function noopHandle(): FluidShaderHandle {
  return {
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

/**
 * Mount the fluid simulation on a canvas and run it until disposed.
 * Missing WebGL2 / compile failure returns a no-op handle.
 */
export function attachFluidShader(
  canvas: HTMLCanvasElement,
  params: FluidParams,
  profile: FluidShaderProfile = "full",
): FluidShaderHandle {
  const lite = profile === "lite";
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    desynchronized: true,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  });
  if (gl === null) {
    return noopHandle();
  }

  const compile = (type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (shader === null) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const link = (fragment: string): WebGLProgram | null => {
    const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const frag = compile(gl.FRAGMENT_SHADER, fragment);
    if (vertex === null || frag === null) return null;
    const program = gl.createProgram();
    if (program === null) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    return program;
  };

  const flowProgram = link(FLOW_SHADER);
  const displayProgram = link(DISPLAY_SHADER);
  if (flowProgram === null || displayProgram === null) {
    return noopHandle();
  }

  const flow = {
    prev: gl.getUniformLocation(flowProgram, "u_prev"),
    mouse: gl.getUniformLocation(flowProgram, "u_mouse"),
    velocity: gl.getUniformLocation(flowProgram, "u_velocity"),
    brushRadius: gl.getUniformLocation(flowProgram, "u_brushRadius"),
    brushStrength: gl.getUniformLocation(flowProgram, "u_brushStrength"),
    decay: gl.getUniformLocation(flowProgram, "u_decay"),
  };
  const display = {
    time: gl.getUniformLocation(displayProgram, "u_time"),
    pixelRatio: gl.getUniformLocation(displayProgram, "u_pixelRatio"),
    resolution: gl.getUniformLocation(displayProgram, "u_resolution"),
    scale: gl.getUniformLocation(displayProgram, "u_scale"),
    rotation: gl.getUniformLocation(displayProgram, "u_rotation"),
    offset: gl.getUniformLocation(displayProgram, "u_offset"),
    color1: gl.getUniformLocation(displayProgram, "u_color1"),
    color2: gl.getUniformLocation(displayProgram, "u_color2"),
    color3: gl.getUniformLocation(displayProgram, "u_color3"),
    colorCount: gl.getUniformLocation(displayProgram, "u_colorCount"),
    proportion: gl.getUniformLocation(displayProgram, "u_proportion"),
    softness: gl.getUniformLocation(displayProgram, "u_softness"),
    shape: gl.getUniformLocation(displayProgram, "u_shape"),
    shapeScale: gl.getUniformLocation(displayProgram, "u_shapeScale"),
    distortion: gl.getUniformLocation(displayProgram, "u_distortion"),
    swirl: gl.getUniformLocation(displayProgram, "u_swirl"),
    swirlIterations: gl.getUniformLocation(displayProgram, "u_swirlIterations"),
    flowmap: gl.getUniformLocation(displayProgram, "u_flowmap"),
    distortBoost: gl.getUniformLocation(displayProgram, "u_distortBoost"),
    noiseBoost: gl.getUniformLocation(displayProgram, "u_noiseBoost"),
    swirlBoost: gl.getUniformLocation(displayProgram, "u_swirlBoost"),
    motionMode: gl.getUniformLocation(displayProgram, "u_motionMode"),
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
  const fps = lite ? 12 : 30;
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
  if (targetA === null || targetB === null) {
    return noopHandle();
  }

  const start = performance.now();
  let raf = 0;
  let previous = 0;
  let paused = false;
  let disposed = false;
  const step = 1000 / fps;

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

  const frame = (now: number): void => {
    if (disposed || paused) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
    if (now - previous < step) return;
    previous = now - ((now - previous) % step);

    const p = current;

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

    gl.viewport(0, 0, width, height);
    gl.useProgram(displayProgram);
    bindQuad(displayProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, write.tex);
    gl.uniform1i(display.flowmap, 0);
    const time = (performance.now() - start) * 0.001 * (p.speed / 100);
    gl.uniform1f(display.time, time);
    gl.uniform1f(display.pixelRatio, window.devicePixelRatio || 1);
    gl.uniform2f(display.resolution, width, height);
    gl.uniform1f(display.scale, p.scale);
    gl.uniform1f(display.rotation, p.rotation / 90);
    gl.uniform2f(display.offset, p.offsetX / 100, p.offsetY / 100);
    const c1 = hexToRgb(p.color1 || "#2E58A4");
    const c2 = hexToRgb(p.color2 || "#D2E2EE");
    const c3 = hexToRgb(p.color3 || "#FFFFFF");
    gl.uniform4f(display.color1, c1[0], c1[1], c1[2], 1);
    gl.uniform4f(display.color2, c2[0], c2[1], c2[2], 1);
    gl.uniform4f(display.color3, c3[0], c3[1], c3[2], 1);
    gl.uniform1f(display.colorCount, 3);
    gl.uniform1f(display.proportion, p.proportion / 100);
    gl.uniform1f(display.softness, p.softness / 100);
    gl.uniform1f(display.shape, 0);
    gl.uniform1f(display.shapeScale, p.shapeScale / 100);
    gl.uniform1f(display.distortion, p.distortion / 100);
    gl.uniform1f(display.swirl, p.swirl / 50);
    gl.uniform1f(
      display.swirlIterations,
      lite ? Math.min(p.swirlIterations, 4) : p.swirlIterations,
    );
    gl.uniform1f(display.distortBoost, p.distortBoost);
    gl.uniform1f(display.noiseBoost, p.noiseBoost);
    gl.uniform1f(display.swirlBoost, p.swirlBoost);
    gl.uniform1f(display.motionMode, p.motionMode ?? 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const stopLoop = (): void => {
    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const startLoop = (): void => {
    if (disposed || paused || prefersReducedMotion() || raf !== 0) {
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
    setParams: (next: FluidParams) => {
      current = { ...next };
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

  if (prefersReducedMotion()) {
    frame(performance.now());
    stopLoop();
    return handle;
  }

  startLoop();
  return handle;
}
