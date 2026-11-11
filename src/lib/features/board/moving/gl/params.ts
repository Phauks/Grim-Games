import type { MovingParams } from '#lib/core/backgrounds/moving.ts';

/** A setting read as a number, colour or switch; parseMoving has already checked each one. */
export const num = (params: MovingParams, id: string): number => Number(params[id] ?? 0);
export const hex = (params: MovingParams, id: string): string => String(params[id] ?? '');
export const on = (params: MovingParams, id: string): boolean => params[id] === true;
