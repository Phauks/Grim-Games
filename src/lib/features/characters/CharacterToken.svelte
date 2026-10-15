<script lang="ts">
	import {
		characterIcons,
		defaultAlignment,
		ICONS_PATH,
		type Alignment,
		type Character
	} from '#lib/core/data/index.ts';
	import { describeLeaves, type LeafMarks } from '#lib/ui/token/leaves.ts';
	import TokenFace from '#lib/ui/token/TokenFace.svelte';

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
	const src = $derived.by(() => {
		const icons = characterIcons(character);
		if (!icons) return typeof character.image === 'string' ? character.image : character.image?.[0];
		const team = alignment ?? defaultAlignment(character.type);
		const file =
			(team === 'evil' ? icons.evil : team === 'good' ? icons.good : undefined) ??
			icons.unaligned ??
			icons.good;
		return file && `${ICONS_PATH}/${file}`;
	});
	const label = $derived(
		[`${character.name} token`, describeLeaves(leaves)].filter(Boolean).join(': ')
	);
</script>

<!-- The character token with its leaves (first night, other nights, reminders, setup). -->
<TokenFace {src} {label} {leaves} {size} />
