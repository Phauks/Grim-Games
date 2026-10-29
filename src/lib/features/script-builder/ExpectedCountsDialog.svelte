<!--
	What the script should have of each seated type, set for this script (ScriptBuilderPage,
	Trevor 2026-10-26): a guide for the counts, never a limit.
-->
<script lang="ts">
	import { MAX_EXPECTED_COUNT, expectedScriptCounts } from '#lib/core/rules/index.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Stepper from '#lib/ui/primitives/Stepper.svelte';
	import { scriptBuilderDraft as draft } from './draft.svelte.ts';

	type Expected = ReturnType<typeof expectedScriptCounts>;

	interface Props {
		open: boolean;
		expected: Expected;
		types: readonly (keyof Expected)[];
		/** The script has its own counts, which Reset clears. */
		custom: boolean;
	}

	let { open = $bindable(), expected, types, custom }: Props = $props();
</script>

<Dialog bind:open title={t('script-builder.expected')}>
	{#snippet headActions()}<IconButton
			icon="reset"
			label={t('script-builder.expectedReset')}
			disabled={!custom}
			onclick={() => draft.resetExpected()}
		/>{/snippet}
	<div class="expected-steppers">
		{#each types as type (type)}
			<span class="label" data-type={type}>{TYPE_PLURALS[type]}</span>
			<Stepper
				value={expected[type]}
				label={TYPE_PLURALS[type]}
				lessLabel={t('script-builder.expectedLess', { type: TYPE_PLURALS[type] })}
				moreLabel={t('script-builder.expectedMore', { type: TYPE_PLURALS[type] })}
				min={0}
				max={MAX_EXPECTED_COUNT}
				typeable
				testid="expected-set-{type}"
				onchange={(n) => draft.setExpected(type, n)}
			/>
		{/each}
	</div>
</Dialog>

<style>
	.expected-steppers {
		display: grid;
		grid-template-columns: auto auto;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
	}
</style>
