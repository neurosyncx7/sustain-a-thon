import { Effect } from "postprocessing";
import * as THREE from "three";

// Film-style grade after tone mapping: lift/gamma/gain, S-curve contrast, saturation, and a
// split-tone (shadows vs highlights tint). Parameters are keyed to time of day by PostFX.
const frag = /* glsl */ `
uniform vec3 uLift, uGamma, uGain, uShadowTint, uHighTint;
uniform float uSat, uContrast, uSplit;
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec3 c = clamp(inputColor.rgb, 0.0, 1.0);
  c = pow(max(uGain*(c + uLift*(1.0-c)), 0.0), 1.0/uGamma);
  float l = luma(c);
  c = mix(vec3(l), c, uSat);
  vec3 sc = c - 0.5; c = 0.5 + sc * uContrast / (1.0 + abs(sc)*(uContrast-1.0)*1.6);   // soft S
  float t = smoothstep(0.05, 0.85, luma(c));
  c += uSplit * mix(uShadowTint, uHighTint, t) * (0.5 - abs(t-0.5));
  outputColor = vec4(clamp(c,0.0,1.0), inputColor.a);
}`;

export class GradeEffect extends Effect {
  constructor() {
    super("GradeEffect", frag, {
      uniforms: new Map<string, THREE.Uniform>([
        ["uLift", new THREE.Uniform(new THREE.Vector3(0, 0, 0))],
        ["uGamma", new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
        ["uGain", new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
        ["uShadowTint", new THREE.Uniform(new THREE.Vector3(-0.02, 0.0, 0.05))],
        ["uHighTint", new THREE.Uniform(new THREE.Vector3(0.05, 0.02, -0.03))],
        ["uSat", new THREE.Uniform(1.05)],
        ["uContrast", new THREE.Uniform(1.12)],
        ["uSplit", new THREE.Uniform(0.6)],
      ]),
    });
  }
}
