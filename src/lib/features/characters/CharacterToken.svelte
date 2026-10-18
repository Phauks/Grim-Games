<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Alignment, Character } from '#lib/core/data/index.ts';
	import { describeLeaves, type LeafMarks } from '#lib/ui/token/leaves.ts';
	import TokenFace from '#lib/ui/token/TokenFace.svelte';
	import { iconUrl } from './icon-url.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';

	/**
	 * Below this size a token is an icon in a list, with its name printed beside it, so the
	 * name on the token is left off whatever the setting.
	 */
	const NAME_MIN_SIZE = 56;

	interface Props {
		character: Character;
		/** Which icon to show; defaults from the character type. */
		alignment?: Alignment;
		/** Fixed size in px. */
		size?: number;
		/**
		 * Writes the character's name on the token. Follows the user's setting by default, so
		 * the board, Show to player and the seat sheet all match (Trevor, 2026-10-18); the
		 * settings preview passes its unsaved value.
		 */
		showName?: boolean;
		/** Night order numbers for the side leaves' badges (Settings > Board and tokens). */
		nightNumbers?: { first?: number; other?: number };
	}

	let { character, alignment, size = 56, showName, nightNumbers }: Props = $props();

	const named = $derived(
		showName ?? (preferences.current.tokenAppearance.boardNames && size >= NAME_MIN_SIZE)
	);

	const leaves = $derived<LeafMarks>({
		firstNight: character.firstNightReminder !== undefined || character.firstNight !== undefined,
		otherNight: character.otherNightReminder !== undefined || character.otherNight !== undefined,
		reminders: character.reminders.length + character.remindersGlobal.length
	});
	const src = $derived(iconUrl(character, alignment));
	/* eslint-disable grim/names-as-badges -- the token's accessible name */
	const marks = $derived(
		[
			describeLeaves(leaves),
			leaves.firstNight && nightNumbers?.first !== undefined
				? t('characters.marks.firstNumber', { number: nightNumbers.first })
				: '',
			leaves.otherNight && nightNumbers?.other !== undefined
				? t('characters.marks.otherNumber', { number: nightNumbers.other })
				: ''
		]
			.filter(Boolean)
			.join(', ')
	);
	const label = $derived(
		marks
			? t('characters.tokenMarks', { name: character.name, marks })
			: t('characters.token', { name: character.name })
	);
	/* eslint-enable grim/names-as-badges */
</script>

<!-- The character token with its leaves (first night, other nights, reminders, setup). -->
<!-- eslint-disable grim/names-as-badges -- the name printed on its own token (Settings > Tokens) -->
<TokenFace {src} {label} {leaves} {size} {nightNumbers} name={named ? character.name : undefined} />
<!-- eslint-enable grim/names-as-badges -->
