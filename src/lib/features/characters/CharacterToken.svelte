<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Alignment, Character } from '#lib/core/data/index.ts';
	import { describeLeaves, type LeafMarks } from '#lib/ui/token/leaves.ts';
	import TokenFace from '#lib/ui/token/TokenFace.svelte';
	import { iconUrl } from './icon-url.ts';

	interface Props {
		character: Character;
		/** Which icon to show; defaults from the character type. */
		alignment?: Alignment;
		/** Fixed size in px. */
		size?: number;
	}

	let { character, alignment, size = 56 }: Props = $props();

	const leaves = $derived<LeafMarks>({
		firstNight: character.firstNightReminder !== undefined || character.firstNight !== undefined,
		otherNight: character.otherNightReminder !== undefined || character.otherNight !== undefined,
		reminders: character.reminders.length + character.remindersGlobal.length,
		setup: character.setup
	});
	const src = $derived(iconUrl(character, alignment));
	const label = $derived(
		describeLeaves(leaves)
			? t('characters.tokenMarks', { name: character.name, marks: describeLeaves(leaves) })
			: t('characters.token', { name: character.name })
	);
</script>

<!-- The character token with its leaves (first night, other nights, reminders, setup). -->
<TokenFace {src} {label} {leaves} {size} />
