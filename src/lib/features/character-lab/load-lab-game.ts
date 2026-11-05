import { defaultAlignment, type GameData, type Script } from '#lib/core/data/index.ts';
import { labGame, type LabSetup } from '#lib/core/lab/lab-game.ts';
import { placeLabSetup } from '#lib/core/lab/lab-setup.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { replacementReminder } from '#lib/core/rules/bag-characters.ts';
import { OpenGame } from '#lib/features/game/session.svelte.ts';
import { gameStarts, nightViews } from '#lib/features/grimoire/device-notes.ts';
import { forgetGame } from '#lib/features/grimoire/forget-game.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';

/** The lab game's script name, shown on its board. */
export const LAB_SCRIPT_NAME = 'Character Lab';

/**
 * Saves a new lab game (plan M37) through the engine's own commands, as New game, the draw and
 * the setup tokens do, and starts it (Trevor, 2026-11-04: "load game and start game should be
 * the same"): the script, every seat's character (a Drunk or Marionette seat holds the token
 * its player thinks they are, with its "Is The ..." reminder), the Fabled and Loric, the
 * Demon's bluffs and the setup reminders. Then the first night begins as Start game begins it,
 * so the game opens on the first night, or on day `startDay` when it is 1 or more (Trevor,
 * 2026-11-05: "what day of the game to start on"), each night between ended as End night ends
 * it. The last lab game, `previous`, is deleted first, so the lab keeps only one on this
 * device.
 */
export async function loadLabGame(
	data: GameData,
	setup: LabSetup,
	previous: GameId | undefined,
	startDay = 0
): Promise<OpenGame> {
	if (previous) await forgetGame(previous);
	const built = labGame(data, setup);
	const script: Script = {
		meta: { name: LAB_SCRIPT_NAME },
		entries: built.script.map((id) => ({ kind: 'official', id }))
	};
	const open = await OpenGame.create(data, script, built.seats.length);
	open.game.seating.forEach((seatId, i) => {
		const characterId = built.seats[i];
		const character = data.byId.get(characterId);
		const shows = built.standIns.find((s) => s.seat === i)?.shows;
		const replaced = shows !== undefined && character ? replacementReminder(character) : undefined;
		const alignment =
			character?.type === 'traveller'
				? 'good'
				: replaced && character
					? defaultAlignment(character.type)
					: undefined;
		open.run({
			type: 'AssignCharacter',
			seatId,
			characterId: replaced ? shows! : characterId,
			...(alignment ? { alignment } : {})
		});
		if (replaced) open.run({ type: 'AddReminder', seatId, reminder: replaced });
	});
	for (const characterId of built.ruleCharacters)
		open.run({ type: 'AddRuleCharacter', characterId });
	if (built.bluffs.length) open.run({ type: 'SetBluffs', set: 0, characterIds: built.bluffs });
	if (setup.setupTokens !== false)
		placeLabSetup(open.game, open.characters, ({ seatId, reminder }) => {
			open.run({ type: 'AddReminder', seatId, reminder });
			return open.game;
		});
	for (let day = 1; day <= startDay; day++) {
		if (day > 1) open.run({ type: 'Dusk' });
		open.run({ type: 'NewDay' });
	}
	await open.save();
	// Start game: when it started, and tonight's walk-through from its first step.
	const gameId = open.game.gameId;
	gameStarts.start(gameId);
	if (startDay === 0 && preferences.current.assistance.nightWalkthrough)
		nightViews.write(gameId, { done: [], day: 0, walk: { night: 'first', index: 0 } });
	return open;
}
