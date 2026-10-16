<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { ScriptLoadResult, ScriptProblemSeverity } from '#lib/core/data/index.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open?: boolean;
		result: ScriptLoadResult | undefined;
		onconfirm: () => void;
	}

	let { open = $bindable(false), result, onconfirm }: Props = $props();

	const GROUPS = [
		{ severity: 'error', title: 'scripts.check.notLoaded' },
		{ severity: 'warning', title: 'scripts.check.changed' },
		{ severity: 'info', title: 'scripts.check.notes' }
	] as const satisfies readonly { severity: ScriptProblemSeverity; title: string }[];

	const script = $derived(result?.script);
	const description = $derived(
		script
			? t('scripts.check.summary', { name: script.name, count: script.characters.length })
			: t('scripts.check.nothing')
	);
</script>

<!-- Shown only when loading found something to fix or skip (08-script-loading.md §5.3). -->
<Dialog bind:open title={t('scripts.check.title')} {description}>
	{#if result}
		<div class="problems" data-testid="script-problems">
			{#each GROUPS as group (group.severity)}
				{@const items = result.problems.filter((p) => p.severity === group.severity)}
				{#if items.length > 0}
					<section data-severity={group.severity}>
						<h3>{t(group.title)}</h3>
						<ul>
							{#each items as problem, i (i)}
								<li><span class="where">{problem.where}</span> {problem.message}</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/each}
		</div>
	{/if}
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (open = false)}
			>{script ? t('common.cancel') : t('scripts.check.back')}</Button
		>
		{#if script}
			<Button
				variant="accent"
				onclick={() => {
					open = false;
					onconfirm();
				}}>{t('scripts.check.loadAnyway')}</Button
			>
		{/if}
	{/snippet}
</Dialog>

<style>
	.problems {
		display: grid;
		gap: var(--space-3);
		margin: var(--space-3) 0;
	}
	h3 {
		margin: 0 0 var(--space-1);
		font-size: 1rem;
	}
	[data-severity='error'] h3 {
		color: var(--evil);
	}
	ul {
		margin: 0;
		padding-left: var(--space-4);
	}
	li {
		overflow-wrap: anywhere;
	}
	.where {
		font-weight: 600;
	}
</style>
