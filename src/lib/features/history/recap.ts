/**
 * Builds a finished game's recap (`GameRecap`) from its log: the History lines in plain
 * words, the players at the start and end, and the Storyteller's notes (each seat's note,
 * then the day log's notes). The words are History's own (`historyItems`).
 */
/* eslint-disable grim/names-as-badges -- a saved text file, where names can only be words */
import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
import { applyEvent, type LogEntry } from '#lib/core/engine/index.ts';
import {
	alignmentOf,
	isTraveller,
	trueCharacter,
	type CharacterLookup,
	type Game,
	type SeatId
} from '#lib/core/model/index.ts';
import type { EndReason } from '#lib/core/rules/index.ts';
import type { GameRecap, RecapCharacter } from './recap-html.ts';
import { causeLabel } from '#lib/features/grimoire/board.ts';
import { endReasonLabel } from '#lib/features/grimoire/end-reason-label.ts';
import { historyItems, type HistoryPart } from '#lib/features/grimoire/history.ts';

export interface RecapSource {
	game: Game;
	entries: readonly LogEntry[];
	/** The log entries in play (the saved cursor), so undone ones stay out. */
	cursor: number;
	characters: CharacterLookup;
	winner?: Alignment;
	reason?: EndReason;
}

const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function seatName(game: Game, seatId: SeatId | undefined): string {
	if (!seatId) return 'A seat';
	const n = game.seating.indexOf(seatId) + 1;
	return game.seats[seatId]?.playerName ?? (n > 0 ? `Seat ${n}` : 'A seat');
}

/** One History line as plain words: a seat as "Ana (Imp)", a reminder in quotes. */
export function partsText(parts: readonly HistoryPart[], characters: CharacterLookup): string {
	const name = (id: CharacterId) => characters.get(id)?.name ?? id;
	return parts
		.map((p) => {
			switch (p.kind) {
				case 'text':
					return p.text;
				case 'seat':
					return p.characterId ? `${p.name} (${name(p.characterId)})` : p.name;
				case 'character':
					return name(p.characterId);
				default:
					return `“${p.label}” (${name(p.characterId)})`;
			}
		})
		.join('');
}

function characterAt(game: Game, seatId: SeatId, characters: CharacterLookup) {
	const id = trueCharacter(game, seatId, characters);
	if (!id) return undefined;
	const out: RecapCharacter = { name: characters.get(id)?.name ?? id };
	const alignment = alignmentOf(game, seatId);
	if (alignment) out.alignment = alignment;
	return out;
}

/** The game after the first `cursor` log entries: an ended game as it was when ended. */
export function gameAt(entries: readonly LogEntry[], cursor: number): Game | undefined {
	let game: Game | undefined;
	for (const entry of entries.slice(0, cursor))
		for (const e of entry.events) game = applyEvent(game, e);
	return game;
}

const RESULT = { good: 'Good won', evil: 'Evil won' } as const;

export function buildRecap(source: RecapSource): GameRecap {
	const { game, characters } = source;
	const items = historyItems(source.entries, source.cursor, characters)
		.filter((item) => !item.undone)
		.reverse();
	const firstAt = source.entries[0]?.at ?? game.createdAt;

	// Who each seat was at the first Dawn: the game just before the first "New day".
	let start: Game | undefined;
	{
		let g: Game | undefined;
		for (const entry of source.entries.slice(0, source.cursor)) {
			if (entry.events.some((e) => e.type === 'DayStarted') && g && !start) start = g;
			for (const e of entry.events) g = applyEvent(g, e);
		}
	}

	const notes: GameRecap['notes'] = [];
	// Each game note under its title, as the Notes sheet lists them (Trevor, 2026-10-23).
	for (const note of game.notes ?? []) {
		if (note.text.trim()) notes.push({ about: note.title.trim() || 'Game', text: note.text });
	}
	for (const seatId of game.seating) {
		const note = game.seats[seatId].note?.trim();
		if (note) notes.push({ about: seatName(game, seatId), text: note });
	}
	[...game.pastDays, game.today].forEach((log, day) => {
		for (const entry of log.entries) {
			if (entry.kind !== 'note' || !entry.text.trim()) continue;
			const character = characters.get(entry.characterId)?.name ?? entry.characterId;
			const who = entry.seatId ? `${seatName(game, entry.seatId)} (${character})` : character;
			notes.push({ about: `${day === 0 ? 'Night 1' : `Day ${day}`}, ${who}`, text: entry.text });
		}
	});

	const howEnded = source.reason && endReasonLabel(source.reason, characters);

	return {
		title: game.script.meta?.name || 'Game',
		...(game.script.meta?.author ? { author: game.script.meta.author } : {}),
		...(game.storytellerName ? { storyteller: game.storytellerName } : {}),
		played: date.format(firstAt),
		result: source.winner ? RESULT[source.winner] : 'Winner not recorded',
		...(source.winner && howEnded ? { howEnded } : {}),
		days: game.pastDays.length,
		seats: game.seating.map((seatId, i) => {
			const seat = game.seats[seatId];
			const end = characterAt(game, seatId, characters);
			const begin = start ? characterAt(start, seatId, characters) : undefined;
			return {
				seatId,
				number: i + 1,
				name: seatName(game, seatId),
				...(end ? { end } : {}),
				...(begin ? { start: begin } : {}),
				dead: seat.dead,
				...(seat.dead && seat.deathCause
					? {
							death: causeLabel(seat.deathCause, characters, isTraveller(game, seatId, characters))
						}
					: {})
			};
		}),
		log: items.map((item) => ({
			time: time.format(item.at),
			text: partsText(item.parts, characters)
		})),
		notes
	};
}
