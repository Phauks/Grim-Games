<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import type { ReferenceDifference } from '#lib/core/rules/reference.ts';
	import { nightTextFor, nightTextSegments } from '#lib/core/rules/night-text.ts';
	import { prepTokens } from '#lib/core/rules/setup-reminders.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { officialNames } from '#lib/features/characters/game-data.svelte.ts';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import DiffersButton from './DiffersButton.svelte';

	interface Props {
		/** The step's text; defaults to TPI's for `night`. A Storyteller's edit shows as it is. */
		text?: string;
		character: Character;
		/** Which night, so TPI's markup is mapped and our fuller text can be used. */
		night?: 'first' | 'other';
		/**
		 * `auto` follows the "Full night instructions" help; `source` is always TPI's text,
		 * `ours` always ours (for the comparison in the "Differs from source" dialog).
		 */
		show?: 'auto' | 'source' | 'ours';
		/** Draws the "Differs from source" marker when we have our own text for this night. */
		marker?: boolean;
		/**
		 * Whether a token pre-game prep places is in the grimoire (first night only). Without
		 * it, prep tokens are only marked as prep.
		 */
		placed?: (label: string) => boolean;
	}

	let { text, character, night, show = 'auto', marker = true, placed }: Props = $props();

	const full = $derived(
		show === 'ours' || (show === 'auto' && preferences.current.assistance.fullNightText)
	);
	const resolved = $derived(
		night
			? nightTextFor(character, night, {
					full,
					...(show === 'source' || text === undefined ? {} : { text })
				})
			: text !== undefined
				? { text, showingOurs: false }
				: undefined
	);
	const segments = $derived(
		resolved
			? nightTextSegments(resolved.text, character, {
					names: officialNames(),
					...('placeholders' in resolved && resolved.placeholders
						? { placeholders: resolved.placeholders }
						: {}),
					...(night === 'first' && character.edition !== undefined
						? { prepTokens: prepTokens(character.id) }
						: {})
				})
			: []
	);
	const difference = $derived.by((): ReferenceDifference | undefined => {
		if (!night || !resolved || !('ours' in resolved) || !resolved.ours || !resolved.source)
			return undefined;
		return {
			part: night === 'first' ? 'firstNight' : 'otherNight',
			title: night === 'first' ? 'First night' : 'Other nights',
			source: resolved.source,
			ours: resolved.ours.text,
			reason: resolved.ours.reason
		};
	});
	const prepState = (label: string): 'done' | 'todo' | 'prep' =>
		placed ? (placed(label) ? 'done' : 'todo') : 'prep';
</script>

<!-- Storyteller night text with tokens, the death marker and character names as badges. -->
<span class="night-text" data-ours={resolved?.showingOurs || undefined}
	>{#each segments as s, i (i)}{#if s.kind === 'text'}{s.text}{:else if s.kind === 'character'}<CharacterBadge
				characterId={s.id}
			/>{:else if s.kind === 'info'}<ReminderToken
				label={s.label}
				variant="info"
				title="Info token"
			/>{:else if s.kind === 'dead'}<ReminderToken
				variant="dead"
				type={character.type}
				{...s.action ? { action: s.action } : {}}
				title="Dead: the death marker"
			/>{:else}<ReminderToken
				{...s.label !== undefined ? { label: s.label } : {}}
				type={character.type}
				characterId={character.id}
				{...s.action ? { action: s.action } : {}}
				{...s.prep && s.label ? { prep: prepState(s.label) } : {}}
				{...s.label ? {} : { title: `One of: ${s.options.join(', ')}` }}
			/>{/if}{/each}{#if marker && difference}
		<DiffersButton {character} differences={[difference]} />{/if}</span
>

<style>
	.night-text :global(.badge) {
		margin-block: calc(var(--space-1) * -1);
	}
</style>
