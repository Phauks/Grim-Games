<script lang="ts">
	import NoneState from '#lib/ui/primitives/NoneState.svelte';
	import type { ScriptRating } from '#lib/core/feedback/index.ts';
	import AccoladeBadge from '#lib/features/room/AccoladeBadge.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { loadScriptRating } from './script-rating.svelte.ts';

	/**
	 * A script's public rating in its details (Trevor, 2026-11-16, look B): "4.5 of 5 from 12
	 * rated", which opens a sheet with the accolades players gave it. "None" until a game has
	 * rated it, in the same row, so nothing moves when it comes.
	 */
	interface Props {
		/** The script's own name and author; '' rates nothing. */
		name: string;
		author?: string;
	}

	let { name, author }: Props = $props();

	let loaded = $state.raw<{ key: string; rating: ScriptRating | undefined }>();
	let open = $state(false);
	const key = $derived(`${name}\n${author ?? ''}`);

	$effect(() => {
		const wanted = key;
		if (!name) return;
		let current = true;
		void loadScriptRating(name, author).then((rating) => {
			if (current) loaded = { key: wanted, rating };
		});
		return () => (current = false);
	});

	const rating = $derived(name && loaded?.key === key ? loaded.rating : undefined);
	const label = $derived(
		rating?.rating === undefined
			? t('common.none')
			: t('room.feedback.average', { rating: rating.rating, count: rating.ratings })
	);
</script>

<dt>{t('scripts.details.rating')}</dt>
<dd data-testid="script-rating">
	{#if rating && rating.games > 0}
		<Button variant="quiet" aria-haspopup="dialog" onclick={() => (open = true)}>{label}</Button>
	{:else}
		{label}
	{/if}
</dd>

<BottomSheet bind:open title={t('history.scriptFeedback', { script: name || t('common.none') })}>
	<div class="rating" data-testid="script-rating-sheet">
		<p>{label}</p>
		<h3>{t('room.feedback.accolades')}</h3>
		{#if rating?.accolades.length}
			<ul class="badges">
				{#each rating.accolades as { id, count } (id)}
					<li><AccoladeBadge {id} {count} /></li>
				{/each}
			</ul>
		{:else}
			<NoneState />
		{/if}
	</div>
</BottomSheet>

<style>
	dd {
		margin: 0;
	}
	.rating {
		display: grid;
		gap: var(--space-2);
	}
	p,
	h3 {
		margin: 0;
	}
	h3 {
		font-size: 1rem;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3) var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
