<script lang="ts">
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Self from './ModeValue.svelte';
	import { CHARACTER_FIELDS, SEQUENCE_FIELDS, modeLabel } from './labels.ts';

	/**
	 * One value of a mode file, shown as it is: characters as badges, links as links, kinds
	 * and values by their labels, objects as nested lists. Unknown fields still show, under
	 * their own names, so any mode someone writes can be inspected.
	 */
	interface Props {
		field: string;
		value: unknown;
	}

	let { field, value }: Props = $props();

	const isLink = (v: unknown): v is { title: string; url: string } =>
		typeof v === 'object' &&
		v !== null &&
		typeof (v as { url?: unknown }).url === 'string' &&
		typeof (v as { title?: unknown }).title === 'string';
	const isRecord = (v: unknown): v is Record<string, unknown> =>
		typeof v === 'object' && v !== null && !Array.isArray(v);
	const safeUrl = (url: string) => (/^https:\/\//.test(url) ? url : undefined);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external https source links -->
{#if field === 'cite' && typeof value === 'string'}
	<a href={safeUrl(value)} target="_blank" rel="noopener noreferrer">{t('modes.rules')}</a>
{:else if CHARACTER_FIELDS.has(field) && Array.isArray(value)}
	{#if value.length === 0}
		{t('common.none')}
	{:else}
		<span class="badges">
			{#each value as id (id)}<CharacterBadge characterId={String(id)} inline />{/each}
		</span>
	{/if}
{:else if Array.isArray(value) && value.every((v) => typeof v === 'number')}
	{value.join(SEQUENCE_FIELDS.has(field) ? ' → ' : ', ')}
{:else if Array.isArray(value) && value.every((v) => typeof v === 'string')}
	{value.map((v) => modeLabel('value', v)).join(', ')}
{:else if isLink(value)}
	<a href={safeUrl(value.url)} target="_blank" rel="noopener noreferrer">{value.title}</a>
{:else if Array.isArray(value)}
	{#if value.length === 0}
		{t('common.none')}
	{:else}
		<!-- Several entries of one field: numbered, each set apart. -->
		<ol class="items" class:single={value.length === 1} role="list">
			{#each value as item, i (i)}<li><Self {field} value={item} /></li>{/each}
		</ol>
	{/if}
{:else if isRecord(value)}
	{#if field === 'onlyFor' || ('characterId' in value && 'type' in value)}
		<CharacterBadge characterId={String(value.characterId)} inline />
		{modeLabel('value', String(value.type))}
	{:else}
		<dl>
			{#each Object.entries(value) as [key, inner] (key)}
				<!-- One row per field, so a label and its value read together. -->
				<div class="row">
					<dt>{modeLabel('field', key)}</dt>
					<dd>
						{#if key === 'kind' && typeof inner === 'string'}
							{modeLabel('kind', inner)}
						{:else}
							<Self field={key} value={inner} />
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
	{/if}
{:else if typeof value === 'boolean'}
	{value ? t('modes.yes') : t('modes.no')}
{:else if typeof value === 'string'}
	{modeLabel('value', value)}
{:else}
	{String(value)}
{/if}

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
	dl {
		display: grid;
		margin: 0;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
		gap: var(--space-3);
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--border);
	}
	.row:last-child {
		border-bottom: 0;
	}
	/* A field inside a field: indented under its label's value with a rule. */
	dd :global(dl) {
		padding-inline-start: var(--space-2);
		border-inline-start: 2px solid var(--border);
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		min-width: 0;
	}
	ol {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.items {
		counter-reset: item;
	}
	.items > li {
		counter-increment: item;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-2);
	}
	.items > li + li {
		padding-top: var(--space-1);
		border-top: 1px dashed var(--border);
	}
	.items.single > li {
		grid-template-columns: minmax(0, 1fr);
	}
	.items.single > li::before {
		content: none;
	}
	.items > li::before {
		content: counter(item) '.';
		color: var(--on-surface-muted);
		font-variant-numeric: tabular-nums;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
</style>
