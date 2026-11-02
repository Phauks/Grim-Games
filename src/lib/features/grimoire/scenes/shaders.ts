import type { SceneIdOf } from './scene-presets.ts';

/**
 * The shader scenes' WebGL fragment shaders (moving backgrounds, plan L113), written for this
 * app: no Shadertoy or other third-party shader code. Each gets `res` (the drawing size in
 * pixels) and `t` (seconds). ShaderScene.svelte draws them; a scene's label and still frame
 * are its preset (scene-presets.ts).
 */

const COMMON = `
precision mediump float;
uniform vec2 res; uniform float t;
float h(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
vec2 h2(vec2 p){ float a = h(p); return vec2(a, h(p + a)); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 r=mat2(.8,.6,-.6,.8); for(int i=0;i<5;i++){ v+=a*n(p); p=r*p*2.02; a*=.5; } return v; }
float fbm3(vec2 p){ float v=0., a=.5; mat2 r=mat2(.8,.6,-.6,.8); for(int i=0;i<3;i++){ v+=a*n(p); p=r*p*2.02; a*=.5; } return v; }
// A field of soft round points in a grid, one per cell, each with its own phase.
float points(vec2 p, float size, float density, out float phase){
  vec2 c = floor(p), f = fract(p) - .5;
  vec2 o = h2(c) - .5; phase = h(c + 7.1);
  float on = step(1. - density, h(c + 3.3));
  return on * smoothstep(size, 0., length(f - o*.7));
}
`;

const MAIN = (body: string) => `${COMMON}
void main(){
  vec2 uv = gl_FragCoord.xy/res; float asp = res.x/res.y;
  vec2 p = vec2(uv.x*asp, uv.y);
  float T = mod(t, 600.);
  vec3 c = vec3(0.);
${body}
  gl_FragColor = vec4(c, 1.);
}`;

export const SHADERS = {
	hellfire: MAIN(`
  vec2 q = vec2(p.x*2.6, uv.y*2. - T*.9);
  float warp = fbm(q*1.3 + vec2(0., T*.4));
  float f = fbm(q + warp*1.2);
  float flame = clamp(f*1.75 - uv.y*1.5, 0., 1.);
  c = vec3(.04,.005,.01) + vec3(.22,.02,.02)*(1.-uv.y);
  c += vec3(.9,.18,.03)*smoothstep(.0,.5,flame) + vec3(1.,.55,.1)*smoothstep(.35,.8,flame) + vec3(1.,.9,.6)*smoothstep(.7,1.,flame);
  float ph; vec2 ep = vec2(p.x*14. + sin(T*.7 + uv.y*6.)*.4, uv.y*14. - T*1.6);
  float e = points(ep, .09, .18, ph);
  c += vec3(1.,.55,.15)*e*(.4 + .6*sin(T*3. + ph*30.))*(1.2-uv.y);
`),
	lava: MAIN(`
  vec2 q = p*3.;
  vec2 w = vec2(fbm(q + T*.05), fbm(q + vec2(5.2,1.3) - T*.04));
  float f = fbm(q + w*2.5 + T*.03);
  float crack = 1. - abs(f*2. - 1.);
  crack = pow(crack, 12.);
  c = mix(vec3(.05,.02,.02), vec3(.18,.06,.04), f);
  c += vec3(1.,.3,.03)*crack*1.1 + vec3(1.,.75,.3)*pow(crack,4.)*.8;
  c *= .85 + .15*sin(T*1.5 + f*12.);
`),
	underwater: MAIN(`
  c = mix(vec3(.0,.06,.14), vec3(.03,.32,.45), uv.y);
  vec2 q = p*5.;
  float k = 0.;
  for(int i=0;i<3;i++){ float fi=float(i); vec2 o = vec2(sin(T*.3+fi), cos(T*.25+fi*2.))*1.5;
    k += abs(sin(q.x*1.3 + fbm3(q + o)*4. + T*.6) * sin(q.y*1.1 + fbm3(q - o)*4. - T*.5)); q *= 1.4; }
  c += vec3(.4,.9,1.)*pow(max(0., 1. - k*.45), 4.)*(.25 + .5*uv.y);
  float ray = fbm3(vec2(p.x*4. + uv.y*1.5 + T*.08, T*.1));
  c += vec3(.5,.9,1.)*smoothstep(.55,.8,ray)*uv.y*.35;
  float ph; float b = points(vec2(p.x*9. + sin(T + uv.y*10.)*.15, uv.y*9. - T*.9), .12, .08, ph);
  c += vec3(.7,.95,1.)*b*.6;
`),
	stars: MAIN(`
  c = mix(vec3(.06,.05,.12), vec3(.01,.01,.04), uv.y);
  float band = exp(-pow((uv.y - .35 - p.x*.45)*3.5, 2.));
  float mw = fbm(p*4. + 3.) * band;
  c += vec3(.35,.3,.55)*mw*.7 + vec3(.2,.25,.4)*smoothstep(.4,.8,fbm(p*9.))*band*.4;
  float ph;
  for(int i=0;i<3;i++){ float s = 40. + float(i)*35.;
    float st = points(p*s, .11, .35, ph);
    c += vec3(.9,.92,1.)*st*(.5 + .5*sin(T*(1.5+ph*3.) + ph*40.)); }
  float k = floor(T/6.); float ft = fract(T/6.);
  vec2 a = vec2(h(vec2(k,1.))*asp, .6 + .35*h(vec2(k,2.)));
  vec2 d = normalize(vec2(-1., -.45));
  vec2 head = a + d*ft*.9; vec2 r = p - head;
  float along = dot(r, -d), across = abs(dot(r, vec2(-d.y, d.x)));
  float trail = step(0., along)*smoothstep(.25,0.,along)*smoothstep(.004,0.,across);
  c += vec3(1.,.95,.85)*trail*step(ft,.35)*1.5;
`),
	storm: MAIN(`
  float cl = fbm(vec2(p.x*2. + T*.08, uv.y*3. + T*.02));
  c = mix(vec3(.06,.07,.1), vec3(.3,.32,.38), cl*(.4+uv.y*.8));
  float k = floor(T/5.); float ft = fract(T/5.)*5.;
  float flash = (exp(-ft*12.) + .6*exp(-max(ft-.18,0.)*14.)*step(.18,ft))*step(.35, h(vec2(k,9.)));
  c += vec3(.6,.65,.8)*flash*(.4 + cl);
  vec2 rp = vec2(p.x*60. + uv.y*12., uv.y*3. + T*3.5);
  vec2 cell = floor(rp); float drop = step(.8, h(cell));
  float line = smoothstep(.12,.0,abs(fract(rp.x)-.5))*smoothstep(.0,.4,fract(rp.y))*smoothstep(1.,.6,fract(rp.y));
  c += vec3(.6,.65,.75)*drop*line*.5;
`),
	snow: MAIN(`
  c = mix(vec3(.14,.18,.3), vec3(.03,.04,.1), uv.y);
  float hill = .18 + .05*sin(p.x*3.) + .03*sin(p.x*7.+1.);
  c = mix(c, vec3(.75,.8,.9)*(.6+.4*uv.y), step(uv.y, hill));
  float ph;
  for(int i=0;i<3;i++){ float fi = float(i); float s = 9. + fi*7.;
    vec2 q = vec2(p.x*s + sin(T*.6 + uv.y*4. + fi)*.6, uv.y*s + T*(1.2 + fi*.5));
    c += vec3(.95)*points(q, .12 - fi*.02, .5, ph)*(.9 - fi*.2); }
`)
} as const satisfies Record<SceneIdOf<'shader'>, string>;

export type ShaderSceneId = keyof typeof SHADERS;
