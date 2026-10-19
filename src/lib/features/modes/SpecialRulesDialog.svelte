<script lang="ts">
	import {
		combineRules,
		type GameMode,
		type RuleConflict,
		type SpecialRule
	} from '#lib/core/modes/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { allRules, customRules, findRule } from './custom-rules.svelte.ts';
	import { modeLabel } from './labels.ts';
	import ModeInspectDialog from './ModeInspectDialog.svelte';

	/**
	 * New game's special rules (Trevor, 2026-10-18: rules stack on a game mode, modes don't
	 * mix): one switch per rule, on in the order chosen. Two that set the same part
	 * differently are listed as conflicts; they warn, never stop the game starting.
	 * Design: /mnt/project-files/world-cup-rules/format-design.md.
	 */
	interface Props {
		open: boolean;
		mode: GameMode;
		/** The chosen rules' ids, in the order chosen. */
		ruleIds: readonly string[];
		onChange: (ids: string[]) => void;
		/** Add mode, which also takes a rule file. */
		onadd: () => void;
	}

	let { open = $bindable(), mode, ruleIds, onChange, onadd }: Props = $props();

	const rules = $derived(allRules());
	const chosen = $derived(ruleIds.flatMap((id) => findRule(id) ?? []));
	const conflicts = $derived(combineRules(mode, chosen).conflicts);
	let inspecting = $state<SpecialRule | undefined>();
	let inspectOpen = $state(false);
	let deleting = $state<SpecialRule | undefined>();
	let deleteOpen = $state(false);

	const nameOf = (id: string) => (id === mode.id ? mode.name : (findRule(id)?.name ?? id));
	function conflictText(c: RuleConflict): string {
		const [first, second] = c.ids.map(nameOf);
		return c.part
			? t('modes.conflict', { first, second, part: modeLabel('part', c.part) })
			: t('modes.conflictListed', { first, second });
	}

	function toggle(id: string, on: boolean) {
		onChange(on ? [...ruleIds.filter((x) => x !== id), id] : ruleIds.filter((x) => x !== id));
	}
</script>

<Dialog bind:open title={t('modes.specialRulesTitle')} size="full">
	{#snippet headActions()}
		<IconButton icon="add" label={t('modes.add.button')} onclick={onadd} />
	{/snippet}
	<div class="rules">
		<ul role="list" data-testid="special-rules">
			{#each rules as rule (rule.id)}
				{@const custom = customRules.list.some((r) => r.id === rule.id)}
				<li>
					<Toggle
						label={rule.name}
						checked={ruleIds.includes(rule.id)}
						onChange={(on) => toggle(rule.id, on)}
					/>
					<IconButton
						icon="info"
						label={t('modes.inspectRule', { name: rule.name })}
						onclick={() => {
							inspecting = rule;
							inspectOpen = true;
						}}
					/>
					<!-- Always there, so nothing moves; only a rule added on this device can go. -->
					<DeleteButton
						label={t('modes.deleteRule', { name: rule.name })}
						disabled={!custom}
						onclick={() => {
							deleting = rule;
							deleteOpen = true;
						}}
					/>
				</li>
			{/each}
		</ul>
		<section aria-labelledby="rule-conflicts-title">
			<h3 id="rule-conflicts-title">{t('modes.conflicts')}</h3>
			{#if conflicts.length}
				<ul role="list" class="conflicts" data-testid="rule-conflicts">
					{#each conflicts as c (`${c.ids.join(' ')} ${c.part ?? ''}`)}
						<li>{conflictText(c)}</li>
					{/each}
				</ul>
			{:else}
				<p class="muted" data-testid="rule-conflicts">{t('common.none')}</p>
			{/if}
		</section>
	</div>
</Dialog>

{#if inspecting}
	<ModeInspectDialog bind:open={inspectOpen} mode={inspecting} />
{/if}
<ConfirmDialog
	bind:open={deleteOpen}
	title={t('modes.deleteRuleConfirm', { name: deleting?.name ?? '' })}
	danger
	onConfirm={() => {
		if (!deleting) return;
		customRules.remove(deleting.id);
		onChange(ruleIds.filter((x) => x !== deleting?.id));
	}}
/>

<style>
	.rules {
		display: grid;
		align-content: start;
		gap: var(--space-4);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* The switch takes the row; Inspect and Delete their own size beside it. */
	li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	li > :global(:first-child) {
		flex: 1;
		min-width: 0;
	}
	h3 {
		margin: 0 0 var(--space-1);
		font-size: 1.05rem;
	}
	.conflicts li {
		display: list-item;
		margin-left: var(--space-4);
		list-style: disc;
		color: var(--evil);
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
