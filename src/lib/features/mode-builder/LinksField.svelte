<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';

	/** A list of links in a mode file (sources, authors, scripts): each a title and its https link. */
	interface Props {
		links: readonly unknown[];
		onChange: (links: { title: string; url: string }[]) => void;
		disabled?: boolean;
	}

	let { links, onChange, disabled = false }: Props = $props();

	const rows = $derived(
		links.map((l) => {
			const o = typeof l === 'object' && l !== null ? (l as Record<string, unknown>) : {};
			return {
				title: typeof o.title === 'string' ? o.title : '',
				url: typeof o.url === 'string' ? o.url : ''
			};
		})
	);

	function set(i: number, change: Partial<{ title: string; url: string }>) {
		onChange(rows.map((r, n) => (n === i ? { ...r, ...change } : r)));
	}
</script>

<div class="links">
	<ol role="list">
		{#each rows as row, i (i)}
			<li>
				<TextField
					label={t('modes.builder.linkTitle')}
					{disabled}
					value={row.title}
					oninput={(title) => set(i, { title })}
				/>
				<TextField
					label={t('modes.builder.linkUrl')}
					type="url"
					{disabled}
					value={row.url}
					oninput={(url) => set(i, { url })}
				/>
				<DeleteButton
					label={t('modes.builder.removeLink', { number: i + 1 })}
					{disabled}
					onclick={() => onChange(rows.filter((_, n) => n !== i))}
				/>
			</li>
		{/each}
	</ol>
	<Button icon="add" {disabled} onclick={() => onChange([...rows, { title: '', url: '' }])}>
		{t('modes.builder.addLink')}
	</Button>
</div>

<style>
	.links {
		display: grid;
		justify-items: start;
		gap: var(--space-1);
	}
	ol {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
		align-items: end;
		gap: var(--space-1);
	}
</style>
