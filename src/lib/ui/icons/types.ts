import type { Component } from 'svelte';
import type { SvelteHTMLElements } from 'svelte/elements';

export type IconComponent = Component<SvelteHTMLElements['svg']>;

/** Iconify id (with weight, e.g. `ph:skull-fill`) -> compiled icon component. */
export type IconMap = Record<string, IconComponent>;
