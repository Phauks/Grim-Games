import { pairKey } from './parse.ts';
import type { CharacterId, Jinx } from './types.ts';

/** Jinxes indexed for lookup by pair and by character. */
export interface JinxIndex {
	readonly all: readonly Jinx[];
	readonly byPair: ReadonlyMap<string, Jinx>;
	readonly byCharacter: ReadonlyMap<CharacterId, readonly Jinx[]>;
}

export function indexJinxes(jinxes: readonly Jinx[]): JinxIndex {
	const byPair = new Map<string, Jinx>();
	const byCharacter = new Map<CharacterId, Jinx[]>();
	for (const jinx of jinxes) {
		const [a, b] = jinx.characters;
		byPair.set(pairKey(a, b), jinx);
		for (const id of [a, b]) {
			const list = byCharacter.get(id);
			if (list) list.push(jinx);
			else byCharacter.set(id, [jinx]);
		}
	}
	return { all: jinxes, byPair, byCharacter };
}

/** The jinx between two characters, in either order, if there is one. */
export function findJinx(index: JinxIndex, a: CharacterId, b: CharacterId): Jinx | undefined {
	return index.byPair.get(pairKey(a, b));
}

/** Every jinx that involves `id`. */
export function jinxesFor(index: JinxIndex, id: CharacterId): readonly Jinx[] {
	return index.byCharacter.get(id) ?? [];
}

/** The jinxes that apply when all of `ids` are on a script, in data order. */
export function jinxesAmong(index: JinxIndex, ids: Iterable<CharacterId>): Jinx[] {
	const set = new Set(ids);
	return index.all.filter(({ characters: [a, b] }) => set.has(a) && set.has(b));
}
