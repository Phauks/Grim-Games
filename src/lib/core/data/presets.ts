/**
 * Official names that are presets of a building block (refactor review C1): a rule may name an
 * official kind ("evil-dead", "executed-loses") instead of writing out the block it stands for.
 * Each name expands to its block, worked out from the entry as written (its token, its winner),
 * and the block keeps the name as `preset`, so the builder, Reference and game log can still
 * show it. Night information (`learns`, `answers`), game ends and holds (`gameEnd`) and jinx
 * ends (`endsGame`) all use this one table.
 */

/** What one preset name expands to: a fixed block, or a block worked out from the entry. */
type Expansion<Entry, Block> = Block | ((entry: Entry) => Block);

export interface PresetTable<Name extends string, Entry, Block> {
	/** Every preset name, in the table's order. */
	readonly names: readonly Name[];
	/** Whether `name` is one of the presets. */
	has(name: string): name is Name;
	/** The block `name` stands for, worked out from `entry`, with `name` kept as its `preset`. */
	expand(name: Name, entry: Entry): Block & { preset: Name };
}

/** A table of presets, by name. */
export function presetTable<Name extends string, Entry, Block extends object>(table: {
	readonly [N in Name]: Expansion<Entry, Block>;
}): PresetTable<Name, Entry, Block> {
	const names = Object.keys(table) as Name[];
	return {
		names,
		has: (name): name is Name => Object.hasOwn(table, name),
		expand: (name, entry) => {
			const expansion = table[name] as Expansion<Entry, Block>;
			const block = typeof expansion === 'function' ? expansion(entry) : expansion;
			return { ...block, preset: name };
		}
	};
}
