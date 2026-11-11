/**
 * Who a `turnsPlayersInto` with `players: "neighbours"` turns: of a player's neighbours, those
 * not of the type yet. The Lord of Typhon's Minions in a draft
 * (https://wiki.bloodontheclocktower.com/Lord_of_Typhon), and a jinx's `alsoBecomes` written in
 * the same words: a summoned Lord of Typhon's other neighbour
 * (https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes). One reader, one rule (P12).
 */

/** Those of `near` (each counted once) that `already` says are not of the type yet. */
export function neighboursTurned<S>(near: readonly S[], already: (seat: S) => boolean): S[] {
	return [...new Set(near)].filter((seat) => !already(seat));
}
