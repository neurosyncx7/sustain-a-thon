import * as THREE from "three";

// Procedural weathered lime-plaster over sandstone, the actual finish of the Jaipur instruments.
// World-space (so no UVs needed on procedural geometry) value noise, 3 octaves:
//  - large blotches (repairs, water staining), mid mottling, fine grain
//  - grime band near the ground, sun-bleaching on upward faces
// Colour ramp stays inside the rose-terracotta family so the one data accent (blue) owns contrast.

const NOISE = /* glsl */ `
float hash31(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){
  vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm3(vec3 p){ float a=0.5, s=0.0; for(int k=0;k<4;k++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
`;

export type PlasterOpts = {
  base?: string;      // main wash colour
  shade?: string;     // darker stain colour
  bleach?: string;    // sun-bleached highlight
  grime?: number;     // 0..1 strength of ground grime band
  scale?: number;     // noise frequency (1/m)
  roughness?: number;
  doubleSided?: boolean;   // for analytic ribbons/curtains whose winding we don't control
  bump?: number;           // relief strength (0 = smooth)
};

export function makePlaster(opts: PlasterOpts = {}) {
  const {
    base = "#c58067",
    shade = "#8e5044",
    bleach = "#e2b39b",
    grime = 0.6,
    scale = 0.35,
    roughness = 0.88,
    doubleSided = false,
    bump = 0.22,
  } = opts;
  const mat = new THREE.MeshStandardMaterial({
    color: base, roughness, metalness: 0, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uShade = { value: new THREE.Color(shade) };
    shader.uniforms.uBleach = { value: new THREE.Color(bleach) };
    shader.uniforms.uGrime = { value: grime };
    shader.uniforms.uScale = { value: scale };
    shader.uniforms.uBump = { value: bump };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvWPos = (modelMatrix*vec4(transformed,1.0)).xyz; vWNrm = normalize(mat3(modelMatrix)*objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;\nuniform vec3 uShade; uniform vec3 uBleach; uniform float uGrime; uniform float uScale; uniform float uBump;\n${NOISE}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 p = vWPos*uScale;
        float big = fbm3(p*0.35);
        float mid = fbm3(p*1.7+7.1);
        // band-limit the fine grain: fade it where one texel of noise is under ~1 pixel
        float aa = 1.0 - smoothstep(0.25, 0.9, length(fwidth(p*14.0)));
        float fine = mix(0.5, vnoise(p*14.0), aa);
        vec3 c = diffuseColor.rgb;
        c = mix(c, uShade, smoothstep(0.45,0.8,big)*0.55);
        c = mix(c, uBleach, smoothstep(0.55,0.85,mid)*0.35 + max(vWNrm.y,0.0)*0.18);
        c *= 0.9 + 0.2*fine;
        float g = (1.0 - smoothstep(0.0, 1.6 + 0.8*mid, vWPos.y)) * uGrime;
        c = mix(c, uShade*0.55, g*0.7);
        diffuseColor.rgb = c;`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        // procedural relief: bump the shading normal by the gradient of a pitted, eroded height
        // field (surface-gradient bump mapping from screen-space derivatives; no UVs needed)
        {
          vec3 q = vWPos*uScale;
          float aaH = 1.0 - smoothstep(0.2, 0.8, length(fwidth(q*22.0)));
          float hgt = fbm3(q*3.1)*0.6 + vnoise(q*22.0)*0.2*aaH;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(hgt), dhy = dFdy(hgt);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx*r1 + dhy*r2);
          normal = normalize(abs(det)*normal - grad*uBump);
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (vnoise(vWPos*uScale*9.0)-0.5)*0.12, 0.0, 1.0);",
      );
  };
  mat.customProgramCacheKey = () => `plaster-${base}-${shade}-${bleach}-${grime}-${scale}-${doubleSided}-${bump}`;
  return mat;
}

// Lime-white scale markings. Emissive channel is driven by hover/active state for the
// flame-blue data accent (the only non-sky blue in the world).
export function makeMarking() {
  return new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    color: "#efe6d6",
    roughness: 0.7,
    emissive: new THREE.Color("#6fb4ff"),
    emissiveIntensity: 0,
  });
}

export const DATA_BLUE = new THREE.Color("#6fb4ff");
export const DATA_BLUE_DEEP = new THREE.Color("#2e6fd1");
