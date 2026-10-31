<script lang="ts">
	import {
		isLinesPart,
		newPartValue,
		partFields,
		setAt,
		type GuidePart
	} from '#lib/core/modes/index.ts';
	import { modeLabel } from '#lib/features/modes/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextListField from '#lib/ui/primitives/TextListField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import BuilderField from './BuilderField.svelte';

	/**
	 * One part of a mode file, as the format guide describes it: a switch for whether the file
	 * changes it, its kind, and each field of that kind. A part the file leaves out shows its
	 * fields disabled, so turning it on moves nothing. A list part (night steps, nominations)
	 * holds any number of entries, each with its own kind and fields.
	 */
	interface Props {
		part: GuidePart;
		value: unknown;
		/** `undefined` leaves the part out of the file (played as standard). */
		onChange: (value: unknown) => void;
	}

	let { part, value, onChange }: Props = $props();

	const name = $derived(modeLabel('part', part.part));
	const items = $derived(Array.isArray(value) ? value : []);
	const kindOptions = $derived(
		part.kinds.map((k) => ({
			value: k.kind,
			label: modeLabel('kind', k.kind),
			description: k.about
		}))
	);

	const objectOf = (v: unknown): Record<string, unknown> =>
		typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
	const kindOf = (v: unknown) => {
		const kind = objectOf(v).kind;
		return typeof kind === 'string' ? kind : part.kinds[0]?.kind;
	};
	/** A new kind keeps what every kind has (cite, instructions, the part's own fields). */
	function withKind(v: unknown, kind: string) {
		const keep = new Set(partFields(part, undefined).map((f) => f.name));
		const kept = Object.fromEntries(Object.entries(objectOf(v)).filter(([k]) => keep.has(k)));
		return { kind, ...kept };
	}
</script>

{#snippet entry(v: unknown, change: (next: unknown) => void, disabled: boolean)}
	{#if part.kinds.length}
		<div class="kind">
			<Select
				label={t('modes.builder.kind')}
				{disabled}
				value={kindOf(v)}
				options={kindOptions}
				onChange={(kind) => change(withKind(v, kind))}
			/>
			<p class="about">{part.kinds.find((k) => k.kind === kindOf(v))?.about}</p>
		</div>
	{/if}
	{#each partFields(part, kindOf(v)) as field (field.name)}
		<BuilderField
			{field}
			parent={part.part}
			value={objectOf(v)[field.name]}
			{disabled}
			onChange={(next) => change(setAt(v, [field.name], next))}
		/>
	{/each}
{/snippet}

<div class="part" data-part={part.part}>
	{#if !part.list}
		<Collapsible title={name} level={3} startClosed>
			{#snippet aside()}
				<Toggle
					label={t('modes.builder.partOn', { part: name })}
					hideLabel
					checked={value !== undefined}
					onChange={(on) => onChange(on ? newPartValue(part) : undefined)}
				/>
			{/snippet}
			<p class="about">{part.about}</p>
			{@render entry(value, onChange, value === undefined)}
		</Collapsible>
	{:else}
		<Collapsible title={name} level={3} startClosed count={items.length} countOpen>
			<p class="about">{part.about}</p>
			{#if isLinesPart(part)}
				<TextListField
					label={name}
					values={items.map((v) => (typeof v === 'string' ? v : ''))}
					onChange={(lines) => onChange(lines.length ? lines : undefined)}
					rowLabel={(n) => t('modes.builder.line', { number: n })}
					removeLabel={(n) => t('modes.builder.removeLine', { number: n })}
					addLabel={t('modes.builder.addLine')}
				/>
			{:else}
				<ol role="list" class="items">
					{#each items as item, i (i)}
						<li>
							<div class="item-head">
								<h4>{t('modes.builder.item', { part: name, number: i + 1 })}</h4>
								<DeleteButton
									label={t('modes.builder.removeItem', { part: name, number: i + 1 })}
									onclick={() => {
										const next = items.filter((_, n) => n !== i);
										onChange(next.length ? next : undefined);
									}}
								/>
							</div>
							{@render entry(
								item,
								(next) => onChange(items.map((x, n) => (n === i ? next : x))),
								false
							)}
						</li>
					{/each}
				</ol>
				<Button icon="add" onclick={() => onChange([...items, newPartValue(part)])}>
					{t('modes.builder.addItem', { part: name })}
				</Button>
			{/if}
		</Collapsible>
	{/if}
</div>

<style>
	.part :global(.field + .field) {
		border-top: 1px solid var(--border);
	}
	.about {
		margin: 0 0 var(--space-2);
		color: var(--on-surface-muted);
		font-size: 0.9em;
	}
	.kind {
		display: grid;
		gap: var(--space-1);
	}
	.items {
		display: grid;
		gap: var(--space-3);
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}
	/* Rows with a line between them, not cards (Trevor). */
	.items > li + li {
		padding-top: var(--space-2);
		border-top: 1px solid var(--border);
	}
	.item-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	h4 {
		margin: 0;
		font-size: 1rem;
	}
</style>
