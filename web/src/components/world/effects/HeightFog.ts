import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";

// Screen-space exponential height fog, integrated analytically along every view ray and
// modulated by drifting 3D noise sampled at a few points on the ray, so mist pools in the
// courtyard, thins with height, wraps around masonry with no slice seams, and still drifts.
// density(y) = d0 * exp(-k * y). Integral along a ray from eye (y0) to point (y1):
//   d0 * L * exp(-k*y0) * (1 - exp(-k*dy)) / (k*dy)

const frag = /* glsl */ `
uniform mat4 uProjInv; uniform mat4 uViewInv; uniform vec3 uCam;
uniform float uDensity, uFalloff, uTime, uNoise, uMaxDist;
uniform vec3 uColor, uSunDir, uSunColor;

float h13(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }
float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<3;i++){ s+=a*n3(p); p*=2.07; a*=.5;} return s; }

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor){
  vec4 clip = vec4(uv*2.0-1.0, depth*2.0-1.0, 1.0);
  vec4 vpos = uProjInv * clip; vpos /= vpos.w;
  vec3 wpos = (uViewInv * vpos).xyz;
  vec3 ray = wpos - uCam;
  float L = length(ray);
  bool sky = depth >= 0.99999;
  if (sky) { L = uMaxDist; ray = normalize(ray) * L; wpos = uCam + ray; }
  L = min(L, uMaxDist);
  vec3 rd = ray / max(length(ray), 1e-4);
  float y0 = uCam.y, dy = rd.y * L;
  float k = uFalloff;
  float integ = abs(k*dy) < 1e-4 ? exp(-k*y0) : exp(-k*y0) * (1.0 - exp(-k*dy)) / (k*dy);
  float od = uDensity * L * integ;
  // noise: three taps along the first 120 m of the ray, where the mist is visible
  float nz = 0.0; float tl = min(L, 120.0);
  for (int i = 1; i <= 3; i++){
    vec3 p = uCam + rd * tl * (float(i)/3.0);
    nz += fbm(p*0.045 + vec3(uTime*0.03, -uTime*0.004, uTime*0.02));
  }
  nz /= 3.0;
  od *= mix(1.0, 0.35 + 1.5*nz, uNoise);
  float T = exp(-od);
  // forward scattering toward the sun brightens the fog (the "glow" of hazy afternoons)
  float mu = max(dot(rd, uSunDir), 0.0);
  vec3 fogCol = uColor + uSunColor * pow(mu, 8.0) * 0.6;
  if (sky) T = mix(1.0, T, 0.55);   // sky already carries its own horizon haze
  outputColor = vec4(mix(fogCol, inputColor.rgb, T), inputColor.a);
}`;

export class HeightFogEffect extends Effect {
  constructor() {
    super("HeightFogEffect", frag, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ["uProjInv", new THREE.Uniform(new THREE.Matrix4())],
        ["uViewInv", new THREE.Uniform(new THREE.Matrix4())],
        ["uCam", new THREE.Uniform(new THREE.Vector3())],
        ["uDensity", new THREE.Uniform(0.02)],
        ["uFalloff", new THREE.Uniform(0.35)],
        ["uTime", new THREE.Uniform(0)],
        ["uNoise", new THREE.Uniform(0.8)],
        ["uMaxDist", new THREE.Uniform(900)],
        ["uColor", new THREE.Uniform(new THREE.Color("#8a8fa3"))],
        ["uSunDir", new THREE.Uniform(new THREE.Vector3(0, 1, 0))],
        ["uSunColor", new THREE.Uniform(new THREE.Color("#ffd2a0"))],
      ]),
    });
  }
}
