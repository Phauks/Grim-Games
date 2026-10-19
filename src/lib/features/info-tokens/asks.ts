import { t } from '#lib/i18n/locale.svelte.ts';
import type { InfoTokenAsks } from '#lib/core/data/info-tokens.ts';
import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

/** One thing a card asks for, as an icon on its tile with the words as its name. */
export interface AskBadge {
	icon: IconSlot;
	label: string;
	/** Shown beside the icon: how many characters, as a range ("1–3") when more than one. */
	count?: string;
}

/**
 * What a card asks for, in the order it is asked when shown: what to fill in, then the
 * characters (Trevor, 2026-10-18: say before the tap what a card will ask for).
 */
export function askBadges(asks: InfoTokenAsks | undefined): AskBadge[] {
	const badges: AskBadge[] = [];
	const value = asks?.value;
	if (value?.kind === 'text') badges.push({ icon: 'asksText', label: t('info-tokens.asks.text') });
	if (value?.kind === 'number') {
		const { min, max } = value;
		badges.push({
			icon: 'asksNumber',
			label:
				min !== undefined && max !== undefined
					? t('info-tokens.asks.numberRange', { min, max })
					: min !== undefined
						? t('info-tokens.asks.numberFrom', { min })
						: max !== undefined
							? t('info-tokens.asks.numberTo', { max })
							: t('info-tokens.asks.number')
		});
	}
	if (value?.kind === 'choices')
		badges.push({
			icon: 'asksChoices',
			label: t('info-tokens.asks.choices', { options: value.options.join(', ') })
		});
	if (asks?.characters) {
		// Exact, or a range: at least one, up to the most it allows (Trevor, 2026-10-18:
		// "This player is" is 1–3).
		const from = asks.exactly ? asks.characters : (asks.fewest ?? 1);
		badges.push({
			icon: 'asksCharacters',
			label:
				from < asks.characters
					? t('info-tokens.asks.charactersRange', { from, count: asks.characters })
					: t('info-tokens.asks.charactersExactly', { count: asks.characters }),
			count: from < asks.characters ? `${from}–${asks.characters}` : String(asks.characters)
		});
	}
	return badges;
}
