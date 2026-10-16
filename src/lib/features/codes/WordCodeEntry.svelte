<script lang="ts">
	import { CODE_WORDS, isCodeWord, splitWords } from '#lib/core/codes/word-code.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	/**
	 * Entering a word code (`poisoned-drunk-imp-bell`) by tapping word chips, typing, or
	 * pasting. Typing filters the chips; a whole word followed by a space, or a pasted code,
	 * fills the slots. Shared by script codes and, later, room join codes.
	 */
	interface Props {
		/** How many words the code has. */
		count: number;
		/** The complete code (`a-b-c-d`), or '' until every slot is filled. */
		value?: string;
		disabled?: boolean;
		/** Called when the last word is filled in, e.g. to load straight away. */
		oncomplete?: (code: string) => void;
	}

	let { count, value = $bindable(''), disabled = false, oncomplete }: Props = $props();

	let chosen = $state<string[]>([]);
	let typed = $state('');

	const full = $derived(chosen.length >= count);
	const fragment = $derived(typed.trim().toLowerCase());
	const shown = $derived(fragment ? CODE_WORDS.filter((w) => w.startsWith(fragment)) : CODE_WORDS);

	function add(words: string[]) {
		const next = [...chosen, ...words].slice(0, count);
		chosen = next;
		value = next.length === count ? next.join('-') : '';
		if (value) oncomplete?.(value);
	}

	function pick(word: string) {
		if (full) return;
		typed = '';
		add([word]);
	}

	function undo() {
		chosen = chosen.slice(0, -1);
		value = '';
	}

	/**
	 * Finished words go into the slots: those before a separator, and a last word that no
	 * other word starts with. An unknown word stays in the box to be corrected.
	 */
	function oninput() {
		const words = splitWords(typed);
		let rest = /[^a-z]$/i.test(typed) ? '' : (words.pop() ?? '');
		if (isCodeWord(rest) && CODE_WORDS.filter((w) => w.startsWith(rest)).length === 1) {
			words.push(rest);
			rest = '';
		}
		if (words.length === 0 || !words.every(isCodeWord)) return;
		typed = rest;
		add(words);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Backspace' && typed === '' && chosen.length > 0) {
			event.preventDefault();
			undo();
		} else if (event.key === 'Enter' && fragment) {
			event.preventDefault();
			const exact = isCodeWord(fragment) ? fragment : shown.length === 1 ? shown[0] : undefined;
			if (exact) pick(exact);
		}
	}
</script>

<div class="entry">
	<div class="slots" role="group" aria-label="Code words">
		<ol style:--count={count} style:--half={Math.ceil(count / 2)}>
			{#each { length: count }, i (i)}
				<li class:filled={chosen[i] !== undefined} data-testid="code-slot">
					{chosen[i] ?? i + 1}
				</li>
			{/each}
		</ol>
		<IconButton
			icon="undo"
			label="Remove the last word"
			onclick={undo}
			disabled={disabled || chosen.length === 0}
		/>
	</div>

	<label class="field">
		<span>Type or tap the words</span>
		<input
			type="text"
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
			enterkeyhint="next"
			bind:value={typed}
			{oninput}
			{onkeydown}
			disabled={disabled || full}
		/>
	</label>

	<!-- Fixed height: filtering scrolls inside it, so the dialog never changes size. -->
	<ul class="chips" aria-label="Code words to tap">
		{#each shown as word (word)}
			<li>
				<button type="button" class="chip" disabled={disabled || full} onclick={() => pick(word)}
					>{word}</button
				>
			</li>
		{/each}
	</ul>
</div>

<style>
	.entry {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0;
		flex: 1;
	}
	.slots {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	ol {
		flex: 1;
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		/* Two rows on a phone, one row on wider screens: never a lone slot on its own line. */
		grid-template-columns: repeat(var(--half), 1fr);
		gap: var(--space-1);
	}
	@media (min-width: 36rem) {
		ol {
			grid-template-columns: repeat(var(--count), 1fr);
		}
	}
	ol li {
		min-height: var(--tap-target);
		display: grid;
		place-items: center;
		padding: 0 var(--space-1);
		border: 2px dashed var(--border-strong, currentColor);
		border-radius: var(--radius-md);
		color: var(--on-surface-muted);
		overflow-wrap: anywhere;
		text-align: center;
	}
	ol li.filled {
		border-style: solid;
		border-color: var(--accent);
		color: inherit;
		font-weight: 600;
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.field input {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: max(1rem, 16px);
	}
	.chips {
		flex: 1;
		min-height: calc(5 * var(--tap-target));
		max-height: 45dvh;
		overflow-y: auto;
		overscroll-behavior: contain;
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		align-content: start;
		gap: var(--space-1);
	}
	.chip {
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		overflow-wrap: anywhere;
	}
	.chip:hover:not(:disabled) {
		background: var(--surface-selected);
	}
	.chip:disabled {
		opacity: 0.5;
	}
</style>
