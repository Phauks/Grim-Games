/**
 * Players may give the same name (Trevor, 2026-10-27: "shouldn't refuse"). Until one of them
 * changes it, the Storyteller sees the later ones numbered in join order (John, John 2), so
 * every name list, and every seat a phone sits in by name, tells them apart.
 */
import type { RoomMember, RoomState } from './room.ts';

const key = (name: string) => name.replace(/\s+/g, ' ').trim().toLocaleLowerCase();

/**
 * The numbered name of each member whose name another member already has, by member id, in
 * join order with seated players first. Only the phones at this game count: seated, connected
 * now (`present`), or connected during it.
 */
export function numberedNames(
	room: RoomState,
	present?: ReadonlySet<string>
): Record<string, string> {
	const atGame = room.members.filter(
		(m) =>
			m.name !== undefined &&
			(m.seatId !== undefined || !present || present.has(m.memberId) || m.game === room.gameId)
	);
	// A seated player keeps their name: a phone coming back later never renames their seat.
	atGame.sort((a, b) => Number(a.seatId === undefined) - Number(b.seatId === undefined));
	const used = new Set(atGame.map((m) => key(m.name!)));
	const seen = new Set<string>();
	const out: Record<string, string> = {};
	for (const m of atGame) {
		const name = m.name!;
		if (!seen.has(key(name))) {
			seen.add(key(name));
			continue;
		}
		let n = 2;
		while (used.has(key(`${name} ${n}`))) n++;
		const label = `${name} ${n}`;
		used.add(key(label));
		out[m.memberId] = label;
	}
	return out;
}

/** The members as the Storyteller sees them: shared names numbered. */
export function withNumberedNames(room: RoomState, present?: ReadonlySet<string>): RoomMember[] {
	const numbered = numberedNames(room, present);
	return room.members.map((m) => (numbered[m.memberId] ? { ...m, name: numbered[m.memberId] } : m));
}
