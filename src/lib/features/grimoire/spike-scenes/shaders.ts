/**
 * SPIKE (animated backgrounds, not for merge): original fragment shaders, one per scene,
 * written for this app (no Shadertoy or other third-party shader code). Each gets `res`
 * (drawing size in pixels) and `t` (seconds).
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
	hellfire: {
		label: 'Hellfire',
		frag: MAIN(`
  vec2 q = vec2(p.x*2.6, uv.y*2. - T*.9);
  float warp = fbm(q*1.3 + vec2(0., T*.4));
  float f = fbm(q + warp*1.2);
  float flame = clamp(f*1.75 - uv.y*1.5, 0., 1.);
  c = vec3(.04,.005,.01) + vec3(.22,.02,.02)*(1.-uv.y);
  c += vec3(.9,.18,.03)*smoothstep(.0,.5,flame) + vec3(1.,.55,.1)*smoothstep(.35,.8,flame) + vec3(1.,.9,.6)*smoothstep(.7,1.,flame);
  float ph; vec2 ep = vec2(p.x*14. + sin(T*.7 + uv.y*6.)*.4, uv.y*14. - T*1.6);
  float e = points(ep, .09, .18, ph);
  c += vec3(1.,.55,.15)*e*(.4 + .6*sin(T*3. + ph*30.))*(1.2-uv.y);
`)
	},
	lava: {
		label: 'Lava flow',
		frag: MAIN(`
  vec2 q = p*3.;
  vec2 w = vec2(fbm(q + T*.05), fbm(q + vec2(5.2,1.3) - T*.04));
  float f = fbm(q + w*2.5 + T*.03);
  float crack = 1. - abs(f*2. - 1.);
  crack = pow(crack, 12.);
  c = mix(vec3(.05,.02,.02), vec3(.18,.06,.04), f);
  c += vec3(1.,.3,.03)*crack*1.1 + vec3(1.,.75,.3)*pow(crack,4.)*.8;
  c *= .85 + .15*sin(T*1.5 + f*12.);
`)
	},
	beach: {
		label: 'Tropical beach',
		frag: MAIN(`
  float hz = .58;
  vec3 sky = mix(vec3(1.,.78,.5), vec3(.2,.48,.78), smoothstep(hz, 1., uv.y));
  float sd = length((uv - vec2(.66, .7))*vec2(asp,1.));
  sky += vec3(1.,.9,.6)*(smoothstep(.035,.03,sd) + .3*exp(-sd*12.));
  sky += vec3(1.)*.08*smoothstep(.55,.7,fbm3(vec2(p.x*3. + T*.02, uv.y*8.)))*step(hz+.1, uv.y);
  float depth = (hz - uv.y)/hz;
  vec2 w = vec2(p.x*5., uv.y*55./(1.+depth*2.));
  float rip = fbm3(w + vec2(T*.5, 0.)) * fbm3(w*1.4 - vec2(T*.35, 0.));
  vec3 sea = mix(vec3(.2,.6,.65), vec3(.08,.3,.55), smoothstep(.0,.6,1.-depth));
  sea += smoothstep(.3,.42,rip)*.45;
  sea += vec3(1.,.9,.7)*smoothstep(.36,.45,rip)*exp(-abs(p.x - .66*asp)*6.)*.9;
  float shore = .3 + .02*sin(p.x*9. + T*.8) + .035*sin(T*.5);
  float foam = smoothstep(.03, .0, uv.y - shore) * step(shore - .02, uv.y);
  foam *= .6 + .4*n(vec2(p.x*30., T));
  vec3 sand = mix(vec3(.72,.58,.4), vec3(.92,.82,.62), uv.y/.3);
  sand *= .92 + .08*n(p*80.);
  c = uv.y > hz ? sky : (uv.y > shore ? sea : sand);
  c = mix(c, vec3(1.), foam*.85);
`)
	},
	underwater: {
		label: 'Underwater',
		frag: MAIN(`
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
`)
	},
	stars: {
		label: 'Starry night',
		frag: MAIN(`
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
`)
	},
	aurora: {
		label: 'Aurora',
		frag: MAIN(`
  c = mix(vec3(.02,.05,.08), vec3(.0,.01,.03), uv.y);
  float ph; c += vec3(.8)*points(p*70., .1, .3, ph)*(.5+.5*sin(T*2.+ph*50.))*uv.y;
  for(int i=0;i<3;i++){ float fi = float(i);
    float y = .55 + fi*.09 + .12*fbm3(vec2(p.x*1.5 + fi*3. + T*.06, T*.05 + fi));
    float d = uv.y - y;
    float curtain = smoothstep(.0,.02,d+.02)*exp(-max(d,0.)*(6.+fi*2.));
    float streak = .5 + .5*fbm3(vec2(p.x*25. + fi*7. - T*.3, 0.));
    vec3 col = mix(vec3(.1,1.,.5), vec3(.6,.2,1.), smoothstep(.0,.25,d) + fi*.2);
    c += col*curtain*streak*(.55 - fi*.12); }
  c *= .9 + .1*sin(T*.5);
  c = mix(c, vec3(.0,.02,.02), smoothstep(.16,.1,uv.y + .03*n(vec2(p.x*6.,1.))));
`)
	},
	storm: {
		label: 'Thunderstorm',
		frag: MAIN(`
  float cl = fbm(vec2(p.x*2. + T*.08, uv.y*3. + T*.02));
  c = mix(vec3(.06,.07,.1), vec3(.3,.32,.38), cl*(.4+uv.y*.8));
  float k = floor(T/5.); float ft = fract(T/5.)*5.;
  float flash = (exp(-ft*12.) + .6*exp(-max(ft-.18,0.)*14.)*step(.18,ft))*step(.35, h(vec2(k,9.)));
  c += vec3(.6,.65,.8)*flash*(.4 + cl);
  vec2 rp = vec2(p.x*60. + uv.y*12., uv.y*3. + T*3.5);
  vec2 cell = floor(rp); float drop = step(.8, h(cell));
  float line = smoothstep(.12,.0,abs(fract(rp.x)-.5))*smoothstep(.0,.4,fract(rp.y))*smoothstep(1.,.6,fract(rp.y));
  c += vec3(.6,.65,.75)*drop*line*.5;
`)
	},
	fog: {
		label: 'Graveyard fog',
		frag: MAIN(`
  c = mix(vec3(.04,.06,.06), vec3(.1,.14,.16), uv.y);
  float md = length((uv - vec2(.3,.8))*vec2(asp,1.));
  c += vec3(.85,.88,.8)*smoothstep(.04,.037,md) + vec3(.3,.35,.35)*exp(-md*8.)*.6;
  float gx = fract(p.x*3.), gi = floor(p.x*3.);
  float hgt = .16 + .06*h(vec2(gi,4.));
  float stone = step(abs(gx-.5), .14)*step(uv.y, hgt)*step(.06, uv.y);
  stone = max(stone, step(length(vec2((gx-.5)*1., (uv.y-hgt)*1.6)), .14)*step(.06,uv.y));
  c = mix(c, vec3(.02,.03,.03), stone*step(.4, h(vec2(gi,2.))));
  for(int i=0;i<3;i++){ float fi = float(i);
    float f = fbm(vec2(p.x*(1.5+fi) + T*(.05+fi*.03), uv.y*4. + fi*5.));
    float layer = smoothstep(.45+fi*.08, .1+fi*.08, uv.y)*smoothstep(.3,.75,f);
    c = mix(c, vec3(.55,.62,.62), layer*.45); }
`)
	},
	snow: {
		label: 'Snowfall',
		frag: MAIN(`
  c = mix(vec3(.14,.18,.3), vec3(.03,.04,.1), uv.y);
  float hill = .18 + .05*sin(p.x*3.) + .03*sin(p.x*7.+1.);
  c = mix(c, vec3(.75,.8,.9)*(.6+.4*uv.y), step(uv.y, hill));
  float ph;
  for(int i=0;i<3;i++){ float fi = float(i); float s = 9. + fi*7.;
    vec2 q = vec2(p.x*s + sin(T*.6 + uv.y*4. + fi)*.6, uv.y*s + T*(1.2 + fi*.5));
    c += vec3(.95)*points(q, .12 - fi*.02, .5, ph)*(.9 - fi*.2); }
`)
	},
	sunset: {
		label: 'Sunset clouds',
		frag: MAIN(`
  c = mix(vec3(1.,.55,.25), vec3(.3,.15,.4), smoothstep(.2,.95,uv.y));
  c = mix(c, vec3(.12,.06,.2), smoothstep(.8,1.,uv.y));
  float sd = length((uv - vec2(.5,.25))*vec2(asp,1.));
  c += vec3(1.,.8,.4)*(smoothstep(.05,.045,sd) + .45*exp(-sd*6.));
  for(int i=0;i<2;i++){ float fi = float(i);
    float f = fbm(vec2(p.x*(1.2+fi) + T*(.02+fi*.015), uv.y*(5.+fi*3.) + fi*4.));
    float cl = smoothstep(.5,.75,f)*smoothstep(.2,.5,uv.y);
    vec3 edge = mix(vec3(1.,.6,.4), vec3(.35,.18,.35), smoothstep(.55,.8,f));
    c = mix(c, edge, cl*.8); }
  c = mix(c, vec3(.08,.04,.08), smoothstep(.13,.1,uv.y + .02*fbm3(vec2(p.x*8.,0.))));
`)
	},
	fireflies: {
		label: 'Firefly wood',
		frag: MAIN(`
  c = mix(vec3(.02,.05,.03), vec3(.05,.1,.08), uv.y);
  float tx = p.x*4.;
  float trunk = smoothstep(.12,.08,abs(fract(tx)-.5 + .1*fbm3(vec2(uv.y*3., floor(tx)))));
  trunk *= step(.5, h(vec2(floor(tx),1.)));
  c = mix(c, vec3(.01,.02,.015), trunk*.85);
  c = mix(c, vec3(.03,.06,.04), smoothstep(.2,.0,uv.y)*.8);
  float ph;
  for(int i=0;i<2;i++){ float fi = float(i); float s = 6. + fi*4.;
    vec2 q = p*s + vec2(sin(T*.4 + fi), cos(T*.33 + fi))*.8;
    q += vec2(fbm3(q*.3 + T*.1), fbm3(q*.3 - T*.1))*1.2;
    float f = points(q, .2, .45, ph);
    float blink = smoothstep(.3,1., sin(T*(1.+ph*2.) + ph*30.));
    c += vec3(.75,1.,.35)*f*blink*1.6 + vec3(.3,.5,.1)*smoothstep(.5,0.,length(fract(q)-.5))*blink*.25*step(.55,h(floor(q)+3.3)); }
`)
	},
	void: {
		label: 'Arcane void',
		frag: MAIN(`
  vec2 d = p - vec2(.5*asp, .5);
  float r = length(d), a = atan(d.y, d.x);
  vec2 q = vec2(a*1.5 + r*6. - T*.25, r*3. - T*.3);
  float f = fbm(vec2(cos(q.x), sin(q.x))*1.5 + q.y);
  c = vec3(.03,.0,.06);
  c += vec3(.45,.12,.8)*smoothstep(.45,.8,f)*smoothstep(1.,.15,r);
  c += vec3(.2,.7,1.)*pow(smoothstep(.6,.9,f),3.)*smoothstep(.9,.2,r)*.8;
  c += vec3(.6,.3,1.)*exp(-r*7.)*.5;
  float ph; c += vec3(.8,.7,1.)*points(p*50. + vec2(T*.2,0.), .1, .15, ph)*(.5+.5*sin(T*2.+ph*40.));
`)
	}
} as const;

export type ShaderSceneId = keyof typeof SHADERS;
