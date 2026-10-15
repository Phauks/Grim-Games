import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import type { SetupGamePort } from './game-port.ts';

/** The setup screens' view of a game opened with the grimoire's `OpenGame`. */
export function openGamePort(open: OpenGame): SetupGamePort {
	return {
		get game() {
			return open.game;
		},
		get lookup() {
			return open.characters;
		},
		dispatch: (command) => open.run(command),
		flush: () => open.save()
	};
}
