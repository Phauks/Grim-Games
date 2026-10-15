<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import type { ReferenceDifference } from '#lib/core/rules/reference.ts';
	import { prepTextSegments } from '#lib/core/rules/setup-reminders.ts';
	import { officialNames } from '#lib/features/characters/game-data.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import NightText from './NightText.svelte';
	import PrepText from './PrepText.svelte';

	interface Props {
		character: Character;
		differences: readonly ReferenceDifference[];
	}

	let { character, differences }: Props = $props();
	let open = $state(false);
</script>

<!-- Marks text of ours that departs from TPI's; the comparison opens in a dialog. -->
<button
	type="button"
	class="differs"
	aria-haspopup="dialog"
	data-testid="differs-from-source"
	onclick={() => (open = true)}><Icon name="info" /><span>Differs from source</span></button
>

<Dialog bind:open title="{character.name}: differs from source">
	<div class="list">
		{#each differences as d (d.part + d.ours)}
			<section class="difference" data-part={d.part}>
				<h3>{d.title}</h3>
				<p class="why">{d.reason}</p>
				<p class="label">{d.part === 'prep' ? 'TPI’s ability text' : 'TPI’s text'}</p>
				<p class="text" data-testid="differs-source">
					{#if d.part === 'prep'}{d.source}{:else}<NightText
							{character}
							night={d.part === 'firstNight' ? 'first' : 'other'}
							show="source"
							marker={false}
						/>{/if}
				</p>
				<p class="label">Ours</p>
				<p class="text" data-testid="differs-ours">
					{#if d.part === 'prep'}<PrepText
							segments={prepTextSegments(d.ours, officialNames())}
							{character}
						/>{:else}<NightText
							{character}
							night={d.part === 'firstNight' ? 'first' : 'other'}
							show="ours"
							marker={false}
						/>{/if}
				</p>
			</section>
		{/each}
	</div>
</Dialog>

<style>
	.differs {
		display: inline-flex;
		align-items: center;
		gap: 0.25em;
		min-height: var(--tap-target);
		margin-block: calc((var(--tap-target) - 1.4em) / -2);
		padding: 0 var(--space-1);
		border: 0;
		background: transparent;
		color: var(--accent);
		font: inherit;
		font-size: 0.72rem;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		white-space: nowrap;
		vertical-align: middle;
		cursor: pointer;
		--icon-size: 1.1em;
	}
	.differs span {
		text-decoration: underline dotted;
		text-underline-offset: 0.2em;
	}
	.list {
		display: grid;
		gap: var(--space-4);
	}
	.difference {
		display: grid;
		gap: var(--space-1);
	}
	h3 {
		margin: 0;
		font-size: 1rem;
	}
	.why {
		margin: 0 0 var(--space-2);
		color: var(--on-surface-muted);
	}
	.label {
		margin: 0;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
	}
	.text {
		margin: 0 0 var(--space-2);
		line-height: 1.6;
	}
</style>
