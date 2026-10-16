<script lang="ts">
	import { resolve } from '$app/paths';
	import { remindersHref, SETUP_STEPS, type SetupStep } from './setup-steps.ts';

	interface Props {
		gameId: string;
		current: SetupStep;
		/** Whether the Draw step can be opened yet (a bag has been built). */
		hasBag: boolean;
	}

	let { gameId, current, hasBag }: Props = $props();

	const index = $derived(SETUP_STEPS.findIndex((s) => s.step === current));

	function href(step: SetupStep): string {
		if (step === 'characters') return resolve('/grimoire/[gameId]/setup', { gameId });
		if (step === 'draw') return resolve('/grimoire/[gameId]/draw', { gameId });
		return remindersHref(gameId);
	}
</script>

<!--
	Where the Storyteller is in setup: Characters, Draw, Setup reminders. Earlier steps and the
	next one are links; the Draw step stays disabled until a bag exists. Fixed size, no reflow.
-->
<nav class="steps" aria-label="Setup steps">
	<ol>
		{#each SETUP_STEPS as s, i (s.step)}
			{@const reachable = s.step !== current && (s.step !== 'draw' || hasBag)}
			<li data-done={i < index ? '' : undefined}>
				{#if reachable}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href() resolves it -->
					<a href={href(s.step)}
						><span class="n" aria-hidden="true">{i + 1}</span><span class="label">{s.label}</span
						></a
					>
				{:else}
					<span
						class="here"
						aria-current={s.step === current ? 'step' : undefined}
						aria-disabled={s.step === current ? undefined : 'true'}
						><span class="n" aria-hidden="true">{i + 1}</span><span class="label">{s.label}</span
						></span
					>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	ol {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a,
	.here {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: 0 var(--space-1);
		border-radius: var(--radius-md);
		color: var(--on-surface-muted);
		box-shadow: inset 0 -2px 0 var(--border);
		text-align: center;
		text-decoration: none;
		font-size: 0.85rem;
		line-height: 1.15;
	}
	a {
		color: var(--on-surface);
		touch-action: manipulation;
	}
	@media (hover: hover) {
		a:hover {
			background: var(--surface-selected);
		}
	}
	.here[aria-current='step'] {
		color: var(--heading);
		font-weight: 700;
		box-shadow: inset 0 -3px 0 var(--focus);
	}
	.here[aria-disabled='true'] {
		opacity: 0.5;
	}
	li[data-done] a {
		box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--focus) 50%, transparent);
	}
	.n {
		display: grid;
		place-items: center;
		flex: none;
		width: 1.6em;
		height: 1.6em;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px currentColor;
		font-variant-numeric: tabular-nums;
	}
	.label {
		min-width: 0;
		overflow-wrap: anywhere;
	}
</style>
