/**
 * Guards stored data: every Durable Object holds accounts, reports, rooms or script copies,
 * and wrangler deletes a class's storage when a migration lists it in `deleted_classes` or
 * when a deploy drops a class that earlier migrations created. So the config may only grow.
 *
 * KEPT lists what beta carries. Adding a Durable Object means adding it here as well; nothing
 * here is ever removed or renamed without Trevor's say-so, because that wipes its data.
 */
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const KEPT = {
	bindings: {
		ROOMS: 'Room',
		SHARED_SCRIPTS: 'SharedScript',
		ACCOUNT_USERS: 'AccountUser',
		ACCOUNT_EMAILS: 'AccountEmail',
		ACCOUNT_NAMES: 'AccountName',
		REPORTS: 'ReportBox',
		SCRIPT_MIRROR: 'ScriptMirror'
	} as Record<string, string>,
	migrationTags: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']
};

type Binding = { name: string; class_name: string };
type Migration = { tag: string; [step: string]: unknown };
type Config = {
	durable_objects?: { bindings?: Binding[] };
	migrations?: Migration[];
	previews?: { durable_objects?: { bindings?: Binding[] } };
};

const text = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const { config, error } = ts.parseConfigFileTextToJson('wrangler.jsonc', text);
const wrangler = config as Config;

const bindingMap = (bindings: Binding[] = []) =>
	Object.fromEntries(bindings.map((b) => [b.name, b.class_name]));

describe('wrangler.jsonc keeps every Durable Object and its data', () => {
	it('parses', () => {
		expect(error).toBeUndefined();
	});

	it('production keeps every binding on its class', () => {
		expect(bindingMap(wrangler.durable_objects?.bindings)).toMatchObject(KEPT.bindings);
	});

	it('previews keep every binding on its class', () => {
		expect(bindingMap(wrangler.previews?.durable_objects?.bindings)).toMatchObject(KEPT.bindings);
	});

	it('keeps every migration tag, in order, and only adds after them', () => {
		const tags = (wrangler.migrations ?? []).map((m) => m.tag);
		expect(tags.slice(0, KEPT.migrationTags.length)).toEqual(KEPT.migrationTags);
	});

	it('never deletes a class', () => {
		const deleting = (wrangler.migrations ?? []).filter((m) => 'deleted_classes' in m);
		expect(deleting.map((m) => m.tag)).toEqual([]);
	});

	it('every bound class is created by a migration', () => {
		const created = new Set(
			(wrangler.migrations ?? []).flatMap((m) => [
				...((m.new_sqlite_classes as string[] | undefined) ?? []),
				...((m.new_classes as string[] | undefined) ?? [])
			])
		);
		for (const name of Object.values(KEPT.bindings)) expect(created, name).toContain(name);
	});

	it('KEPT lists every Durable Object the config binds', () => {
		expect(Object.keys(bindingMap(wrangler.durable_objects?.bindings)).sort()).toEqual(
			Object.keys(KEPT.bindings).sort()
		);
	});
});
