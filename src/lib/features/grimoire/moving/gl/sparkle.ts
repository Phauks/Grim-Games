// One look for every sparkle (vortex motes, embers, stars): a tight bright core, a soft
// halo, and for the brightest ones ("glint" near 1) four faint spikes, like light caught in
// a lens. Point sprites using it are drawn about three times the core's size so the halo
// has room, and are never smaller than a few pixels, so they don't shimmer as they move.
export const SPARKLE = /* glsl */ `
float sparkle(vec2 pc, float glint){
  vec2 q = pc - .5;
  float d = length(q)*2.;
  if (d > 1.) return 0.;
  float edge = 1. - d;
  float core = exp(-d*d*22.);
  float halo = exp(-d*d*5.)*.3*edge;
  float spikes = glint*(exp(-abs(q.x)*70.) + exp(-abs(q.y)*70.))*edge*edge*edge*.6;
  return core + halo + spikes;
}`;
