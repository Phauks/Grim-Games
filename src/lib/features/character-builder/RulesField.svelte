<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		ruleRows,
		summaryOf,
		withRule,
		type CharacterFields,
		type RuleRow
	} from '#lib/core/rules/index.ts';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Menu from '#lib/ui/primitives/Menu.svelte';
	import RuleDialog from './RuleDialog.svelte';

	/**
	 * The character's rules, one row each with a ⋯ to change or remove it, and Add a rule (M62,
	 * Trevor picked option A, 2026-11-09). Rules the character has but the builder can't edit
	 * one by one are still rows, edited as their rules text.
	 */
	interface Props {
		fields: CharacterFields;
		onchange: (rules: Record<string, unknown> | undefined) => void;
	}

	let { fields, onchange }: Props = $props();

	const rows = $derived(ruleRows(fields));

	let open = $state(false);
	let editing = $state<{ key: string; value: unknown }>();

	function add() {
		editing = undefined;
		open = true;
	}

	function edit(row: RuleRow) {
		editing = { key: row.rule.key, value: row.value };
		open = true;
	}
</script>

<PageSection title={t('character-builder.rules')}>
	{#snippet aside()}
		<Button onclick={add} data-testid="add-rule">{t('character-builder.addRule')}</Button>
	{/snippet}
	<ul data-testid="rules">
		{#each rows as row (row.rule.key)}
			<li>
				<div class="text">
					<span class="label">{row.rule.label}</span>
					<span class="value">{summaryOf(row.value)}</span>
				</div>
				<Menu
					label={t('character-builder.ruleMenu', { rule: row.rule.label })}
					items={[
						{
							value: 'edit',
							label: t('character-builder.changeRule'),
							onSelect: () => edit(row)
						},
						{
							value: 'remove',
							label: t('character-builder.removeRule'),
							onSelect: () => onchange(withRule(fields, row.rule.key, undefined))
						}
					]}
				/>
			</li>
		{:else}
			<li class="muted">{t('common.none')}</li>
		{/each}
	</ul>
</PageSection>

<RuleDialog
	bind:open
	{fields}
	{editing}
	onSave={(key, value) => onchange(withRule(fields, key, value))}
/>

<style>
	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	li + li {
		border-top: 1px solid var(--border);
	}
	.text {
		display: grid;
		min-width: 0;
	}
	.label {
		font-weight: 600;
	}
	.value {
		color: var(--on-surface-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
