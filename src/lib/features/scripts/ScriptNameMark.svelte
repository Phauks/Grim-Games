<script lang="ts">
	import type { Attachment } from 'svelte/attachments';

	/**
	 * A script's name styled like a logo, for a script with no logo wherever its logo would
	 * stand on its own (Trevor, 2026-10-27: "default writing the name of the script ... with
	 * appropriate font"; 2026-10-28: "in all locations it would show up"): the board's middle
	 * (BoardLogo) and the grim cover. In the headings font, filling the box the caller gives
	 * its parent, smaller for a long name. Beside a name already written out (a title line, a
	 * list row), the logo's slot stays empty instead, so the name is never shown twice.
	 */
	interface Props {
		name: string;
	}

	let { name }: Props = $props();

	/**
	 * Sizes the name to fill its box (Trevor, 2026-10-27: a long name gets smaller rather than
	 * cut): the largest share of its full size at which every line fits the box's width, each
	 * word whole, and all the lines its height. Measured again when the box changes size and
	 * once the fonts have loaded.
	 */
	function fitName(words: string): Attachment<HTMLElement> {
		void words;
		return (node) => {
			const box = node.parentElement;
			if (!box) return;
			const fits = (share: number) => {
				node.style.setProperty('--fit', String(share));
				return node.scrollWidth <= box.clientWidth && node.offsetHeight <= box.clientHeight;
			};
			const fit = () => {
				if (box.clientWidth === 0 || fits(1)) return;
				let low = 0.1;
				let high = 1;
				for (let step = 0; step < 8; step++) {
					const mid = (low + high) / 2;
					if (fits(mid)) low = mid;
					else high = mid;
				}
				fits(low);
			};
			fit();
			const resized = new ResizeObserver(fit);
			resized.observe(box);
			void document.fonts?.ready.then(fit);
			return () => resized.disconnect();
		};
	}
</script>

<span class="name-mark"><span class="text" {@attach fitName(name)}>{name}</span></span>

<style>
	/* Sized by its box: a quarter of its height for a short name, smaller for a long one. */
	.name-mark {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		overflow: hidden;
		container-type: size;
	}
	.text {
		max-width: 100%;
		color: var(--heading);
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: calc(var(--fit, 1) * min(25cqh, 18cqw));
		line-height: 1.1;
		letter-spacing: 0.04em;
		text-align: center;
		text-wrap: balance;
		text-shadow: 0 0 0.15em var(--surface);
	}
</style>
