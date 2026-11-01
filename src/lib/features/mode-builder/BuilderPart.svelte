<script lang="ts">
	import {
		isLinesPart,
		newPartValue,
		ownPartFields,
		PART_NOTES,
		partFields,
		setAt,
		setPartAt,
		type GuideField,
		type GuidePart
	} from '#lib/core/modes/index.ts';
	import { fieldLabel, modeLabel } from '#lib/features/modes/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextListField from '#lib/ui/primitives/TextListField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import BuilderField from './BuilderField.svelte';
	import BuilderRow from './BuilderRow.svelte';
	import BuilderTable from './BuilderTable.svelte';
	import PartNoteDialog from './PartNoteDialog.svelte';
	import type { GuideAt } from './guide-at.ts';

	/**
	 * One part of a mode file as its own bordered table (Trevor picked layout B, 2026-11-01):
	 * a header band with the switch for whether the file changes it, its Source and Storyteller
	 * instructions and its guide link, then a row per setting. A part the file leaves out
	 * shows its settings dimmed but usable, and changing one turns the part on. A list part
	 * (night steps, nominations) holds any number of entries, each with its own kind, settings
	 * and notes.
	 */
	interface Props {
		part: GuidePart;
		value: unknown;
		/** `undefined` leaves the part out of the file (played as standard). */
		onChange: (value: unknown) => void;
		/** How many problems the checker finds in it. */
		problems: number;
		onGuide: (at: GuideAt) => void;
	}

	let { part, value, onChange, problems, onGuide }: Props = $props();

	const name = $derived(modeLabel('part', part.part));
	const path = $derived(`parts.${part.part}`);
	const section = $derived(`part:${part.part}`);
	const off = $derived(value === undefined);
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

	/** The Source or Storyteller instructions being edited: the part's, or one entry's. */
	let note = $state<{ field: GuideField; index?: number }>();
	let noteOpen = $state(false);
	function openNote(field: GuideField, index?: number) {
		note = { field, index };
		noteOpen = true;
	}
	const noteTarget = $derived(note?.index === undefined ? value : items[note.index]);
	const noteTitle = (field: GuideField, index?: number) =>
		t('modes.builder.noteFor', {
			note: fieldLabel(part.part, field.name),
			part: index === undefined ? name : t('modes.builder.item', { part: name, number: index + 1 })
		});
	function setNote(next: unknown) {
		if (!note) return;
		const { field, index } = note;
		if (index === undefined) onChange(setPartAt(part, value, [field.name], next));
		else onChange(items.map((x, n) => (n === index ? setAt(x, [field.name], next) : x)));
	}
</script>

<!-- Source and Storyteller instructions: lit when set. -->
{#snippet notes(v: unknown, index?: number)}
	{#each PART_NOTES as field (field.name)}
		{@const set = objectOf(v)[field.name] !== undefined}
		<span data-path="{path}{index === undefined ? '' : `[${index}]`}.{field.name}">
			<IconButton
				icon={field.name === 'cite' ? 'wiki' : 'script'}
				label={noteTitle(field, index)}
				outlined={set}
				data-note={field.name}
				data-set={set ? '' : undefined}
				onclick={() => openNote(field, index)}
			/>
		</span>
	{/each}
{/snippet}

{#snippet kindRow(v: unknown, at: string, change: (next: unknown) => void)}
	{#if part.kinds.length}
		<BuilderRow
			label={t('modes.builder.kind')}
			name="kind"
			path="{at}.kind"
			field="kind"
			onGuide={() => onGuide({ section })}
		>
			<Select
				label="{t('modes.builder.kind')}: {name}"
				hideLabel
				value={kindOf(v)}
				options={kindOptions}
				onChange={(kind) => change(withKind(v, kind))}
			/>
		</BuilderRow>
	{/if}
{/snippet}

{#snippet fieldRows(v: unknown, at: string, change: (field: string, next: unknown) => void)}
	{#each ownPartFields(part, kindOf(v)) as field (field.name)}
		<BuilderField
			{field}
			parent={part.part}
			path="{at}.{field.name}"
			value={objectOf(v)[field.name]}
			onChange={(next) => change(field.name, next)}
			onGuide={() => onGuide({ section, field: field.name })}
		/>
	{/each}
{/snippet}

<BuilderTable {path} {off} part={part.part}>
	{#snippet head()}
		<div class="head">
			{#if !part.list}
				<Toggle
					label={t('modes.builder.partOn', { part: name })}
					hideLabel
					checked={!off}
					onChange={(on) => onChange(on ? newPartValue(part) : undefined)}
				/>
			{/if}
			<span class="name">
				<span>{name}</span>
				<code>{part.part}</code>
			</span>
			{#if part.list}
				<CountBadge count={items.length} />
			{/if}
			{#if problems > 0}
				<CountBadge count={problems} warn />
			{/if}
			<span class="end">
				{#if !part.list}{@render notes(value)}{/if}
				<IconButton
					icon="glossary"
					label={t('modes.builder.guideFor', { setting: name })}
					onclick={() => onGuide({ section })}
				/>
			</span>
		</div>
	{/snippet}

	{#if !part.list}
		{@render kindRow(value, path, (next) => onChange(next))}
		{@render fieldRows(value, path, (field, next) =>
			onChange(setPartAt(part, value, [field], next))
		)}
	{:else if isLinesPart(part)}
		<tr class="wide">
			<td colspan="3">
				<TextListField
					label={name}
					values={items.map((v) => (typeof v === 'string' ? v : ''))}
					onChange={(lines) => onChange(lines.length ? lines : undefined)}
					rowLabel={(n) => t('modes.builder.line', { number: n })}
					removeLabel={(n) => t('modes.builder.removeLine', { number: n })}
					addLabel={t('modes.builder.addLine')}
				/>
			</td>
		</tr>
	{:else}
		{#each items as item, i (i)}
			{@const at = `${path}[${i}]`}
			{@const change = (next: unknown) => onChange(items.map((x, n) => (n === i ? next : x)))}
			<tr class="item" data-path={at}>
				<th colspan="3" scope="rowgroup">
					<div class="head">
						<span class="name">{t('modes.builder.item', { part: name, number: i + 1 })}</span>
						<span class="end">
							{@render notes(item, i)}
							<DeleteButton
								label={t('modes.builder.removeItem', { part: name, number: i + 1 })}
								onclick={() => {
									const next = items.filter((_, n) => n !== i);
									onChange(next.length ? next : undefined);
								}}
							/>
						</span>
					</div>
				</th>
			</tr>
			{@render kindRow(item, at, change)}
			{@render fieldRows(item, at, (field, next) => change(setAt(item, [field], next)))}
		{/each}
		<tr class="wide">
			<td colspan="3">
				<Button icon="add" onclick={() => onChange([...items, newPartValue(part)])}>
					{t('modes.builder.addItem', { part: name })}
				</Button>
			</td>
		</tr>
	{/if}
</BuilderTable>

{#if note}
	{@const field = note.field}
	{@const index = note.index}
	<PartNoteDialog
		bind:open={noteOpen}
		title={noteTitle(field, index)}
		{field}
		parent={part.part}
		path="{path}{index === undefined ? '' : `[${index}]`}.{field.name}"
		value={objectOf(noteTarget)[field.name]}
		onChange={setNote}
		onGuide={() => onGuide({ section, field: field.name })}
	/>
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.name {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1);
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	code {
		color: var(--on-surface-muted);
		font-size: 0.8em;
		font-weight: 400;
	}
	.end {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin-inline-start: auto;
	}
	.wide td,
	.item th {
		padding: var(--space-1) var(--space-2);
		text-align: start;
	}
	.item th {
		background: var(--surface-hover);
		font-weight: 600;
	}
</style>
