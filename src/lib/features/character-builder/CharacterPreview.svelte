<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		previewCharacter,
		type CharacterFields,
		type CharacterProblem
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import ReminderTokenRow from '#lib/features/grimoire/ReminderTokenRow.svelte';

	/**
	 * The character as it will look, then what still stops it being saved, on the Character
	 * builder's page and in the builder opened over another page. `children` sits between them
	 * (the page's Save and Add to Script builder).
	 */
	interface Props {
		fields: CharacterFields;
		problems: readonly CharacterProblem[];
		children?: Snippet;
	}

	let { fields, problems, children }: Props = $props();

	const preview = $derived(previewCharacter(fields));
</script>

<section class="preview" aria-label={t('character-builder.preview')} data-testid="preview">
	<div class="token"><CharacterToken character={preview} /></div>
	<CharacterBadge characterId={preview.id} character={preview} />
	<p class="ability">{preview.ability || t('common.none')}</p>
	<!-- Always there, a token high, so typing a reminder never moves the preview; the tokens
	     themselves, as on the board (Trevor, 2026-10-30). -->
	<p class="reminders">
		<ReminderTokenRow inline>
			{#each [...preview.reminders, ...preview.remindersGlobal] as label, i (i)}
				<BoardReminder {label} character={preview} />
			{:else}{t('common.none')}{/each}
		</ReminderTokenRow>
	</p>
</section>
{@render children?.()}
<!-- Reserved room: problems come and go as the form is filled, so nothing moves. -->
<ul class="problems" role="status" aria-label={t('character-builder.problems')}>
	{#each problems as problem (problem.kind)}
		<li data-warn={problem.kind !== 'id-official' ? '' : undefined}>
			{t(`character-builder.problem.${problem.kind}`)}
		</li>
	{/each}
</ul>

<style>
	.preview {
		display: grid;
		justify-items: start;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	.token {
		justify-self: center;
	}
	.ability,
	.reminders {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.problems {
		display: grid;
		gap: var(--space-1);
		min-height: 3lh;
		margin: 0;
		padding-inline-start: 1.2em;
		font-size: 0.9rem;
	}
	.problems [data-warn] {
		color: var(--evil-text);
	}
</style>
