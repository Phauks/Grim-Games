import { BufferAttribute, BufferGeometry } from 'three';

/**
 * Points for a scene's sparks, embers or stars: each gets random seeds (`size` numbers from
 * 0 to 1) that its shader turns into a place, a speed and a look, so moving them costs the
 * phone's processor nothing.
 */
export function seededPoints(count: number, size: 3 | 4): BufferGeometry {
	const geometry = new BufferGeometry();
	const seeds = new Float32Array(count * size);
	for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
	geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
	geometry.setAttribute('seed', new BufferAttribute(seeds, size));
	return geometry;
}
