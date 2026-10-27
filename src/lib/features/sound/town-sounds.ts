import type { TownSoundCommand } from '#lib/core/sync/room-sound.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import { soundboard } from './soundboard.svelte.ts';
import { audio, unlockOnFirstTap } from './sound.ts';

/**
 * The Public Town tablet's side of Play on (plan U10): plays what the Storyteller's
 * soundboard sends. A browser plays nothing until the page is tapped, so the first sound
 * that arrives before a tap asks for one, once.
 */
let asked = false;

export function listenForTownSounds(): (command: TownSoundCommand) => void {
	unlockOnFirstTap();
	return (command) => {
		if (command.command === 'play' && audio()?.state === 'suspended' && !asked) {
			asked = true;
			toast(t('settings.soundOutputTownHeard'));
		}
		soundboard.fromStoryteller(command);
	};
}
