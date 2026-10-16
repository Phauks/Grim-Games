<script lang="ts">
	import { STANDARD_INFO_TOKENS, type InfoToken } from '#lib/core/data/info-tokens.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { plainText } from './bold.ts';
	import { MAX_CUSTOM_TEXT } from './custom-tokens.ts';
	import { customInfoTokens } from './custom-tokens.svelte.ts';
	import InfoTokenText from './InfoTokenText.svelte';

	interface Props {
		/** A card was tapped. */
		onchoose: (token: InfoToken) => void;
		/** Only cards whose text contains this (any case). */
		query?: string;
		/** Heading level of the Standard and Custom sections. */
		level?: 2 | 3;
	}

	let { onchoose, query = '', level = 2 }: Props = $props();

	const needle = $derived(query.trim().toLowerCase());
	const matches = (token: InfoToken) =>
		needle === '' || plainText(token.text).toLowerCase().includes(needle);
	const standard = $derived(STANDARD_INFO_TOKENS.filter(matches));

	/**
	 * Deleted cards stay in their row as "Deleted" with Undo until the list closes, so
	 * deleting moves nothing and can be taken back (Trevor, 2026-10-16).
	 */
	let deleted = $state<{ token: InfoToken; index: number }[]>([]);
	const custom = $derived.by(() => {
		const rows: { token: InfoToken; deleted: boolean }[] = customInfoTokens.list.map((token) => ({
			token,
			deleted: false
		}));
		for (const d of [...deleted].sort((a, b) => a.index - b.index)) {
			rows.splice(Math.min(d.index, rows.length), 0, { token: d.token, deleted: true });
		}
		return rows.filter((row) => matches(row.token));
	});

	let editOpen = $state(false);
	let editing = $state<{ id?: string; text: string }>({ text: '' });
	let confirmOpen = $state(false);
	let confirming = $state<InfoToken>();

	function edit(token?: InfoToken) {
		editing = { id: token?.id, text: token?.text ?? '' };
		editOpen = true;
	}

	function askDelete(token: InfoToken) {
		confirming = token;
		confirmOpen = true;
	}

	function remove(token: InfoToken) {
		const index = customInfoTokens.list.findIndex((t) => t.id === token.id);
		if (index < 0) return;
		customInfoTokens.remove(token.id);
		deleted = [...deleted, { token, index }];
	}

	function undo(token: InfoToken) {
		const entry = deleted.find((d) => d.token.id === token.id);
		if (!entry) return;
		deleted = deleted.filter((d) => d !== entry);
		customInfoTokens.restore(entry.token, entry.index);
	}
</script>

<div class="sections">
	<Collapsible title="Standard" storageKey="info-tokens-standard" {level}>
		<ul class="cards">
			{#each standard as token (token.id)}
				<li>
					<button type="button" class="card" onclick={() => onchoose(token)}>
						{token.text}
					</button>
				</li>
			{:else}
				<li class="none">None</li>
			{/each}
		</ul>
	</Collapsible>

	<Collapsible title="Custom" storageKey="info-tokens-custom" {level}>
		{#snippet aside()}
			<Button icon="add" variant="quiet" onclick={() => edit()}>Add info token</Button>
		{/snippet}
		<ul class="cards">
			{#each custom as row (row.token.id)}
				{@const name = plainText(row.token.text)}
				<li class="custom">
					{#if row.deleted}
						<span class="card deleted">Deleted: {name}</span>
						<Button variant="quiet" icon="undo" onclick={() => undo(row.token)}>Undo</Button>
					{:else}
						<button type="button" class="card" onclick={() => onchoose(row.token)}>
							<InfoTokenText text={row.token.text} />
						</button>
						<span class="actions">
							<IconButton icon="rename" label="Edit {name}" onclick={() => edit(row.token)} />
							<IconButton
								icon="remove"
								label="Delete {name}"
								onclick={() => askDelete(row.token)}
							/>
						</span>
					{/if}
				</li>
			{:else}
				<li class="none">None</li>
			{/each}
		</ul>
	</Collapsible>
</div>

<Dialog bind:open={editOpen} title={editing.id ? 'Edit info token' : 'Add info token'}>
	<label class="field">
		<span>Text</span>
		<textarea
			bind:value={editing.text}
			maxlength={MAX_CUSTOM_TEXT}
			rows="3"
			aria-describedby="bold-hint"></textarea>
	</label>
	<p id="bold-hint" class="hint">Put **two stars** round words to make them bold.</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (editOpen = false)}>Cancel</Button>
		<Button
			variant="accent"
			disabled={!editing.text.trim()}
			onclick={() => {
				customInfoTokens.save(editing.text, editing.id);
				editOpen = false;
			}}>Save</Button
		>
	{/snippet}
</Dialog>

<Dialog bind:open={confirmOpen} title="Delete info token?" role="alertdialog">
	<p class="confirm-text">
		{#if confirming}<InfoTokenText text={confirming.text} />{/if}
	</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (confirmOpen = false)}>Cancel</Button>
		<Button
			variant="accent"
			onclick={() => {
				if (confirming) remove(confirming);
				confirmOpen = false;
			}}>Delete</Button
		>
	{/snippet}
</Dialog>

<style>
	/* Follows the colours of whatever holds it: the page or a parchment sheet. */
	.sections {
		display: grid;
		gap: var(--space-3);
		--collapsible-heading: currentColor;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(12 * var(--u))), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.custom {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.actions {
		display: flex;
		flex: none;
	}
	.actions :global(.icon-button) {
		color: inherit;
	}
	.card {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		width: 100%;
		min-height: calc(3.5 * var(--u));
		padding: var(--space-2) var(--space-3);
		border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
		border-radius: var(--card-radius);
		background: none;
		color: inherit;
		font-family: var(--font-heading);
		font-size: 1.05rem;
		text-align: left;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	button.card:hover {
		background: color-mix(in srgb, currentColor 8%, transparent);
	}
	.card.deleted {
		border-style: dashed;
		opacity: 0.7;
		cursor: default;
	}
	.none {
		opacity: 0.7;
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	textarea {
		width: 100%;
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: inherit;
		font: inherit;
		resize: vertical;
	}
	.hint {
		margin: var(--space-1) 0 0;
		font-size: 0.85rem;
		opacity: 0.8;
	}
	.confirm-text {
		margin: 0;
		font-family: var(--font-heading);
	}
</style>
