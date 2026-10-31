<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ScriptLogo from './ScriptLogo.svelte';

	/**
	 * A script's name, the one look wherever a script is named (Trevor, 2026-10-31: "How many
	 * different ways do we iterate a script name? It probably should just be one component"):
	 * its logo, when it has one, then the name. Two sizes:
	 *
	 * - `title`: a screen's or a sheet's title line (/play, the board's Script sheet, the Town
	 *   screen, a script's details, Share, Character selection). The logo is left out when there
	 *   is none, or its link fails.
	 * - `row`: a list row or a choice (Search, Saved games, Your games, Join, the script vote).
	 *   The logo's place is kept even without one, so the names line up; `sub` is a line under
	 *   the name, with the logo beside both.
	 *
	 * `lead` is the title's logo alone, for a Page or Dialog whose own title already holds the
	 * name (passed to their `lead`). A logo on its own, filling a box (the board's middle, the
	 * grim cover, a QR code's middle) or on paper is a different thing: BoardLogo, CoverScreen,
	 * ScriptQrCenter, ScriptPrintSheet.
	 */
	interface Props {
		/** The script's name; '' or undefined shows `empty`. */
		name: string | undefined;
		/** The script's logo (`scriptLogo`, or one synced with the room). */
		logo?: string;
		size?: 'title' | 'row' | 'lead';
		/** Shown with no name; "None" unless said. */
		empty?: string;
		/** The element around it; a title is an h3 unless said, a row a span. */
		as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
		/** Inline after the name, e.g. a mode's name. */
		children?: Snippet;
		/** A row's line under the name. */
		sub?: Snippet;
		testid?: string;
		class?: string;
	}

	let {
		name,
		logo,
		size = 'row',
		empty,
		as,
		children,
		sub,
		testid,
		class: className = ''
	}: Props = $props();

	let failed = $state(false);
	$effect(() => {
		void logo;
		failed = false;
	});
	const shown = $derived(!!logo && !failed);
	const text = $derived(name?.trim() ? name : (empty ?? t('common.none')));
	const fail = () => (failed = true);
</script>

{#if size === 'lead'}
	{#if shown}<ScriptLogo src={logo} class="script-name-lead" onfail={fail} />{/if}
{:else}
	<svelte:element
		this={as ?? (size === 'title' ? 'h3' : 'span')}
		class="script-name {size} {className}"
		class:with-sub={!!sub}
		data-testid={testid}
	>
		<!-- A row keeps the logo's box (ScriptLogo stays empty without one); a title drops it. -->
		{#if size === 'row'}<ScriptLogo
				src={logo}
				class="script-name-logo"
			/>{:else if shown}<ScriptLogo src={logo} class="script-name-logo" onfail={fail} />{/if}<span
			class="text"
			><span class="name">{text}{@render children?.()}</span>{#if sub}<span class="sub"
					>{@render sub()}</span
				>{/if}</span
		>
	</svelte:element>
{/if}

<style>
	.script-name {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		margin: 0;
	}
	.text {
		display: grid;
		min-width: 0;
	}
	.name {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	/* Page's h1, which /play's title is, whatever element it is. */
	.title {
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		color: var(--heading);
		letter-spacing: 0.04em;
		line-height: 1.2;
		font-size: var(--page-title-size);
		hyphens: auto;
	}
	.title :global(.script-name-logo),
	:global(.script-logo.script-name-lead) {
		width: 1.8em;
		height: 1.8em;
	}
	.row :global(.script-name-logo) {
		width: 1.75em;
		height: 1.75em;
	}
	/* Beside the name and the line under it. */
	.row.with-sub :global(.script-name-logo) {
		width: 2.5em;
		height: 2.5em;
	}
	/* One line, cut short; bold text rather than the headings font, which is wider and cut a
	   phone's Search names short (Trevor, 2026-10-19). */
	.row .name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		color: var(--heading);
	}
	.sub {
		display: grid;
		min-width: 0;
		font-size: 0.9em;
		color: var(--on-surface-muted);
	}
</style>
