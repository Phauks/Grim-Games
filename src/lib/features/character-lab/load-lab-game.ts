import type { GameData, Script } from '#lib/core/data/index.ts';
import { labGame, type LabSetup } from '#lib/core/lab/lab-game.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { OpenGame } from '#lib/features/game/session.svelte.ts';
import { forgetGame } from '#lib/features/grimoire/forget-game.ts';

/** The lab game's script name, shown on its board. */
export const LAB_SCRIPT_NAME = 'Character Lab';

/**
 * Saves a new lab game (plan M37) through the engine's own commands, as New game and the seat
 * sheet do: the script, every seat's character, the Fabled and Loric and the Demon's bluffs.
 * The last lab game, `previous`, is deleted first, so the lab keeps only one on this device.
 */
export async function loadLabGame(
	data: GameData,
	setup: LabSetup,
	previous: GameId | undefined
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
		const traveller = data.byId.get(characterId)?.type === 'traveller';
		open.run({
			type: 'AssignCharacter',
			seatId,
			characterId,
			...(traveller ? { alignment: 'good' as const } : {})
		});
	});
	for (const characterId of built.ruleCharacters)
		open.run({ type: 'AddRuleCharacter', characterId });
	if (built.bluffs.length) open.run({ type: 'SetBluffs', set: 0, characterIds: built.bluffs });
	await open.save();
	return open;
}
