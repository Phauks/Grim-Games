/**
 * The jinx values M46 replaced with general shapes (`jinx-rules.ts`), for a game saved before
 * them: a script's own jinx `rules` and a custom character's `rules.jinxes` are stored with the
 * game, so a newer build turns the old values into the new ones (saved game version 30,
 * `engine/persistence.ts`). A script loaded as text has no old values to turn: the format has
 * one way to say each thing, and an old value is a load warning there.
 */

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** `effect` as an object, from `true`, a bare main value or an object. */
function asObject(effect: unknown, main?: string): Json {
	if (isObject(effect)) return effect;
	if (main !== undefined && (typeof effect === 'string' || typeof effect === 'number'))
		return { [main]: effect };
	return {};
}

/** The keeps of an effect: its `who` and `when`. */
function keep(effect: unknown): Json {
	const obj = asObject(effect);
	return {
		...(obj.who !== undefined ? { who: obj.who } : {}),
		...(obj.when !== undefined ? { when: obj.when } : {})
	};
}

/** One jinx's rules with every replaced value in its M46 shape; anything else as it was. */
export function upgradeJinxRules(rules: unknown): unknown {
	if (!isObject(rules)) return rules;
	const out: Json = {};
	const set = (key: string, value: Json) => {
		if (!(key in out)) out[key] = value;
	};
	for (const [key, value] of Object.entries(rules)) {
		switch (key) {
			case 'abnormalCounts': {
				const obj = asObject(value, 'because');
				const old = obj.because ?? obj.counts;
				const counts =
					old === 'own-ability' ? 'self-caused' : old === 'demon-choice' ? 'unlike-demon' : old;
				out.abnormalCounts = { counts, ...keep(value) };
				break;
			}
			case 'endsGame': {
				const obj = asObject(value, 'kind');
				const kind = obj.kind;
				if (kind === 'partner-chooses') out.endsGame = { ...obj, kind: 'night-instead' };
				else if (kind === 'partner-stops') out.endsGame = { ...obj, kind: 'ability-stopped' };
				else if (kind === 'partner-end')
					out.endsGame = { ...obj, kind: 'gained-end', end: 'dead-without-demon' };
				else out.endsGame = value;
				break;
			}
			case 'storytellerVote':
				set('storytellerChooses', { what: 'own-execution', ...keep(value) });
				break;
			case 'storytellerHas': {
				const obj = asObject(value, 'once');
				out.storytellerHas = obj.once === 'removed' ? { ...obj, once: 'changed' } : value;
				break;
			}
			case 'storytellerChooses': {
				const obj = asObject(value, 'what');
				out.storytellerChooses =
					obj.what === 'carrier' ? { ...obj, what: 'player', via: 'carrierIsDemon' } : value;
				break;
			}
			case 'wakesOneByOne':
				out.wakes = { how: 'one-by-one', ...keep(value) };
				break;
			case 'earlierToken':
				out.changesCharacter = { ...asObject(value, 'token') };
				break;
			case 'givenInstead': {
				const obj = asObject(value, 'instead');
				const shape: Record<string, Json> = {
					'a-player-becomes': { instead: 'becomes' },
					'demon-neighbour-becomes': { instead: 'becomes', where: 'demon-good-neighbour' },
					outsiders: { instead: 'becomes', type: 'outsider', upTo: 2 }
				};
				const to = typeof obj.instead === 'string' ? shape[obj.instead] : undefined;
				out.givenInstead = to ? { ...to, ...keep(value) } : value;
				break;
			}
			case 'notShownGiven':
				set('notShown', { what: 'given-ability', ...keep(value) });
				break;
			case 'noBluffs':
				set('notShown', { what: 'bluffs', ...keep(value) });
				break;
			case 'hidesPartnerSeat':
				set('notShown', { what: 'partner-seat', ...keep(value) });
				break;
			case 'neighbourBecomes':
				set('alsoBecomes', { ...asObject(value, 'type'), players: 'neighbours' });
				break;
			case 'noKill': {
				const obj = asObject(value, 'on');
				out.noKill =
					obj.on === 'executed-partner'
						? {
								killer: 'demon',
								...(obj.who !== undefined ? { who: obj.who } : {}),
								when: [
									'nominated-partner',
									'partner-executed',
									'partner-dead',
									...(Array.isArray(obj.when) ? obj.when : [])
								]
							}
						: value;
				break;
			}
			case 'demonLearnsGood': {
				// The subject's partner's players learn: the other side of the pair.
				const obj = asObject(value);
				const who = obj.who === 'partner' ? undefined : 'partner';
				set('learns', {
					what: 'good-players',
					...(who ? { who } : {}),
					// The old reader asked for a player of the subject (the Magician) in play.
					when: [
						who ? 'self-in-play' : 'partner-in-play',
						...(Array.isArray(obj.when) ? obj.when : [])
					]
				});
				break;
			}
			case 'uncountedVote':
				out.voter = { countsOnlyWith: true, ...keep(value) };
				break;
			case 'survivesCarrierExecuted':
				out.survives = { on: 'carrier-executed', ...keep(value) };
				break;
			case 'keepsAfterPartner':
				out.keepsAbility = { afterDeath: true, ...keep(value) };
				break;
			default:
				out[key] = value;
		}
	}
	return out;
}

/** A `jinxes` block (`{partner: rules}`) with each entry upgraded. */
export function upgradeJinxBlock(block: unknown): unknown {
	if (!isObject(block)) return block;
	return Object.fromEntries(Object.entries(block).map(([k, v]) => [k, upgradeJinxRules(v)]));
}

/** A saved script (`Script`) with every jinx rule it holds upgraded. */
export function upgradeScriptJinxes(script: unknown): unknown {
	if (!isObject(script)) return script;
	const jinxes = Array.isArray(script.jinxes)
		? script.jinxes.map((j) =>
				isObject(j) && j.rules !== undefined ? { ...j, rules: upgradeJinxRules(j.rules) } : j
			)
		: script.jinxes;
	const entries = Array.isArray(script.entries)
		? script.entries.map((e) => {
				if (!isObject(e) || !isObject(e.character) || !isObject(e.character.rules)) return e;
				const rules = e.character.rules;
				if (rules.jinxes === undefined) return e;
				return {
					...e,
					character: { ...e.character, rules: { ...rules, jinxes: upgradeJinxBlock(rules.jinxes) } }
				};
			})
		: script.entries;
	return {
		...script,
		...(script.entries !== undefined ? { entries } : {}),
		...(script.jinxes !== undefined ? { jinxes } : {})
	};
}
