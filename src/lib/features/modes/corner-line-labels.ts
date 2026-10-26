import { t } from '#lib/i18n/locale.svelte.ts';
import type { CornerLine } from '#lib/ui/corner-lines.ts';

/** Each corner line by its Game info row's name, for its eye there and in Settings > Board. */
export function cornerLineLabel(line: CornerLine): string {
	switch (line) {
		case 'author':
			return t('modes.info.author');
		case 'version':
			return t('modes.info.version');
		case 'storyteller':
			return t('modes.info.storyteller');
		case 'players':
			return t('modes.info.players');
		case 'mode':
			return t('modes.label');
		case 'rules':
			return t('modes.info.rules');
		case 'join-code':
			return t('room.joinCode');
		case 'game-time':
			return t('history.gameLength');
		case 'watchers':
			return t('modes.info.watchers');
	}
}
