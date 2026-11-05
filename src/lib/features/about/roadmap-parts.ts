/** Which merged PRs finish which roadmap parts. Part of the roadmap (roadmap.ts). */

/** Parts whose PR titles didn't name them: the PR that finished each. */
export const PART_PRS: Readonly<Record<string, number>> = {
	L7: 323,
	L19: 323,
	L20: 323,
	G4: 365,
	R7: 318,
	R2: 320,
	L8: 321,
	L18a: 321,
	L12: 337,
	L21: 344,
	L13: 355,
	L1: 314,
	L6: 312,
	L14: 326,
	L23: 329,
	L25: 345,
	P1: 357,
	L37: 368,
	S4: 311,
	S2: 313,
	S6: 317,
	S1: 320,
	S7: 351,
	R4: 330,
	// The Hatter's same-type change (PR 891) was folded into the Engineer's PR, whose title names only L78.
	L77: 892
};

/** Plan IDs in a run, such as J1 to J8. */
export const range = (prefix: string, from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);
