import type { Component } from 'svelte';
import AuroraScene from './AuroraScene.svelte';
import BeachScene from './BeachScene.svelte';
import FirefliesScene from './FirefliesScene.svelte';
import FogScene from './FogScene.svelte';
import SunsetScene from './SunsetScene.svelte';
import VoidScene from './VoidScene.svelte';
import type { SceneIdOf } from './scene-presets.ts';

/**
 * The CSS scenes (moving backgrounds, plan L113), by preset id. SceneLayer.svelte draws one
 * inside its frame; a scene's label and still frame are its preset (scene-presets.ts).
 */
export const CSS_SCENES = {
	beach: BeachScene,
	aurora: AuroraScene,
	sunset: SunsetScene,
	void: VoidScene,
	fog: FogScene,
	fireflies: FirefliesScene
} as const satisfies Record<SceneIdOf<'css'>, Component>;

export type CssSceneId = keyof typeof CSS_SCENES;
