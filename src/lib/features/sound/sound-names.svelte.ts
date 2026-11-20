import {
	boardSound,
	GAME_SOUNDS,
	isMadeSound,
	type SoundMoment
} from '#lib/core/sound/soundboard.ts';
import { t } from '#lib/i18n/locale.svelte.ts';

/** A sound's name as the drop-downs show it: a made sound's in the app's words, a recording's own. */
export function soundName(id: string): string {
	if (id === 'none') return t('settings.soundNone');
	if (isMadeSound(id)) return t(`day.timerSound.${id}`);
	return boardSound(id)?.name ?? id;
}

/** Every sound as drop-down options, with None first where a moment can be silent. */
export function soundOptions(withNone: boolean): { value: string; label: string }[] {
	return [...(withNone ? ['none'] : []), ...GAME_SOUNDS].map((value) => ({
		value,
		label: soundName(value)
	}));
}

/** A moment's name, as its row is labelled. */
export function momentName(moment: SoundMoment): string {
	return t(`settings.moment.${moment}`);
}
