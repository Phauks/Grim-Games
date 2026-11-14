import {
	parseStorytellerSounds,
	type StorytellerSoundsAnswer
} from '#lib/core/sound/soundboard.ts';
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';

/**
 * Whether this phone plays the Storyteller's sounds (Trevor, 2026-11-14: players "can opt in
 * or out of this feature ... it could be seen as somewhat invasive"). A player is asked on
 * joining a room (his pick, B) and the answer stays on the device for every later game; the
 * switch in Settings > Sound changes it. Until they answer, the phone plays nothing the
 * Storyteller sends. Back to town is a call, not one of these sounds, and always rings.
 */
const KEY = 'grim-games:storyteller-sounds:v1';

class StorytellerSounds {
	answer = $state<StorytellerSoundsAnswer | undefined>(parseStorytellerSounds(readStoredText(KEY)));
	/** The join question is showing. */
	asking = $state(false);
	#answered: (() => void) | undefined;

	get on(): boolean {
		return this.answer === 'on';
	}

	/** Keeps the player's answer for this and every later game. */
	set(answer: StorytellerSoundsAnswer): void {
		this.answer = answer;
		writeStoredText(KEY, answer);
		this.#answered?.();
	}

	/** Asks, unless the player has already answered; `answered` runs on their answer. */
	ask(answered: () => void): void {
		this.#answered = answered;
		if (!this.answer) this.asking = true;
	}

	/** Leaving the room: a question still showing goes, and is asked again next time. */
	forget(): void {
		this.#answered = undefined;
		this.asking = false;
	}
}

export const storytellerSounds = new StorytellerSounds();
