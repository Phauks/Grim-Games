<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import { nightTextFor, nightTextSegments } from '#lib/core/rules/night-text.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';

	interface Props {
		text: string;
		character: Character;
		/**
		 * Which night the text is for: TPI's `:reminder:`s are then drawn as the tokens they
		 * mean (`REMINDER_PLACEHOLDERS`), and Trevor's reviewed edits replace TPI's text.
		 */
		night?: 'first' | 'other';
	}

	let { text, character, night }: Props = $props();
	const resolved = $derived(night ? nightTextFor(character, night, { text }) : undefined);
	const segments = $derived(
		nightTextSegments(
			resolved?.text ?? text,
			character,
			resolved?.placeholders ? { placeholders: resolved.placeholders } : {}
		)
	);
	// Terms are marked in the text between tokens only, once per night text.
	const explained = $derived(
		explainBlock(
			segments.map((s) => (s.kind === 'text' ? s.text : '')),
			[character.name]
		)
	);
</script>

<!-- Storyteller night text with TPI's :reminder: and *TOKEN* markup drawn as tokens. -->
<span class="night-text"
	>{#each segments as s, i (i)}{#if s.kind === 'text'}<GlossaryText
				segments={explained[i] ?? []}
			/>{:else if s.kind === 'info'}<ReminderToken
				label={s.label}
				variant="info"
				title={t('reference.infoToken')}
			/>{:else if s.kind === 'character'}<CharacterBadge
				characterId={s.id}
				inline
			/>{:else if s.kind === 'dead'}<ReminderToken
				label={t('reference.dead')}
				type={character.type}
				title={s.action === 'remove'
					? t('reference.removeDeathMarker')
					: t('reference.deathMarker')}
			/>{:else}<ReminderToken
				label={s.label}
				{character}
				done={s.prep}
				title={s.prep
					? t('reference.alreadyPlaced')
					: s.label
						? s.action === 'remove'
							? t('reference.removeToken')
							: undefined
						: t('reference.oneOf', { options: s.options.join(', ') })}
			/>{/if}{/each}</span
>

<style>
	.night-text {
		font-family: var(--font-ability);
	}
</style>
