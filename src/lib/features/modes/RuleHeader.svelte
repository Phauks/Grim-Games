<script lang="ts">
	import type { GameMode, SpecialRule } from '#lib/core/modes/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import { shownAbout } from './own-wording.svelte.ts';

	/**
	 * The rules behind a screen, at its top (Trevor, 2026-10-23: "when in a special rules
	 * screen ... always show the associated rule that spawned the screen"): each one's name,
	 * its description as Special rules shows it, and Inspect for the rest.
	 */
	interface Props {
		rules: readonly (GameMode | SpecialRule)[];
	}

	let { rules }: Props = $props();

	let inspecting = $state<GameMode | SpecialRule | undefined>();
	let inspectOpen = $state(false);
</script>

{#if rules.length}
	<ul role="list" class="rules" data-testid="rule-header">
		{#each rules as rule (rule.id)}
			<li>
				<div class="head">
					<strong>{rule.name}</strong>
					<IconButton
						icon="info"
						label={t('modes.inspectRule', { name: rule.name })}
						onclick={() => {
							inspecting = rule;
							inspectOpen = true;
						}}
					/>
				</div>
				<p>{shownAbout(rule) ?? t('common.none')}</p>
			</li>
		{/each}
	</ul>
{/if}
{#if inspecting}
	<ModeInspectDialog bind:open={inspectOpen} mode={inspecting} />
{/if}

<style>
	.rules {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		gap: var(--space-1);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	p {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
