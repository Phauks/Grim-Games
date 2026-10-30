import type { Plugin } from 'vite';

/**
 * Fixes a Svelte 5.57 crash, "Cannot read properties of null (reading 'clear')", seen on
 * /join (Trevor, 2026-10-30). When an effect sets state that a block (`{#if}`, `{#each}`)
 * reads, Svelte reruns that block straight away from a module-wide set of blocks
 * (`eager_block_effects` in svelte/src/internal/client/reactivity/batch.js). If the block's
 * new content calls `flushSync` (zag does, for Ark's tabs, collapsible and presence), the
 * inner flush sets that variable to null, and the outer loop then reads it. Svelte only guards
 * the first read (sveltejs/svelte#16674); this makes the loop keep its own reference to the
 * set, as the inner flush already finished its own. Unfixed in Svelte 5.57.3 and on main as of
 * 2026-10-30. Remove when Svelte fixes it: the build fails once the code it rewrites changes.
 * Covered by src/lib/ui/nested-flush/nested-flush.svelte.test.ts.
 */
export function svelteNestedFlush(): Plugin {
	return {
		name: 'grim-games-svelte-nested-flush',
		enforce: 'pre',
		// Dev and tests serve Svelte prebundled with Ark, which skips the transform below.
		config: () => ({
			optimizeDeps: {
				rolldownOptions: { plugins: [{ name: 'grim-games-svelte-nested-flush', transform }] }
			}
		}),
		transform
	};
}

const file = /[/\\]svelte[/\\]src[/\\]internal[/\\]client[/\\]reactivity[/\\]batch\.js$/;
const start = 'if (eager_block_effects?.size > 0) {';
const end = 'eager_block_effects.clear();';

function transform(code: string, id: string) {
	if (!file.test(id.split('?')[0])) return null;
	const from = code.indexOf(start);
	const to = code.indexOf(end, from);
	if (from < 0 || to < 0)
		throw new Error(
			'svelte-nested-flush.ts: Svelte changed flush_queued_effects. Check whether it now fixes the nested flushSync crash, and remove or update this plugin.'
		);
	const loop = code
		.slice(from, to + end.length)
		.replaceAll('eager_block_effects', 'eager')
		.replace('if (eager?.size', 'var eager = eager_block_effects;\n\t\t\tif (eager?.size');
	return { code: code.slice(0, from) + loop + code.slice(to + end.length), map: null };
}
