import { describe, expect, it } from 'vitest';
import { parseTabCommand, tabCommandSchemas, type TabCommandType } from './tab-commands.js';

describe('parseTabCommand drone-build commands', () => {
    it('accepts the drone-build snapshot commands with empty payloads', () => {
        expect(parseTabCommand('V2_DRONE_BUILD_VIEW', {})).toEqual({});
        expect(parseTabCommand('V2_DRONE_BUILD_REFRESH', {})).toEqual({});
    });

    it('rejects unknown commands', () => {
        expect(parseTabCommand('V2_DRONE_BUILD_UNKNOWN', {})).toBeNull();
    });

    it('registers every tab command type that the content script dispatches', () => {
        // These are the `type === 'V2_...'` branches in contexts/content/index.ts
        // that a background message can arrive as. Each must have a schema,
        // otherwise parseTabCommand() rejects it before the branch runs.
        const dispatched: string[] = [
            'V2_GAME_READINESS',
            'V2_AUTH_EXECUTE',
            'V2_AUTH_STATUS',
            'V2_EXPEDITION_ACTION',
            'V2_DRONE_ACTION',
            'V2_SPECIALISTS_GET',
            'V2_SPECIALISTS_PURCHASE',
            'V2_SET_AUTO_SOLVERS',
            'V2_WS_LOGS',
            'V2_DRONE_BUILD_VIEW',
            'V2_DRONE_BUILD_REFRESH',
            'V2_CLEAR_WS_LOGS',
            'V2_WS_SEND',
            'V2_DAILY_HACK',
            'V2_DAILY_HACK_CANCEL',
            'V2_DAILY_OPS_GET',
            'V2_DAILY_REWARDS_GET',
            'V2_MAIL_GET',
            'V2_MAIL_CLAIM_ALL',
            'V2_MAIL_CLAIM_ITEM',
            'V2_STASH_GET',
            'V2_STASH_SELL',
            'V2_STASH_MOVE',
            'V2_GET_MAP',
            'V2_CONNECT_IP',
            'V2_SET_ENDPOINT',
            'V2_LOGIN_STATUS',
            'V2_HACK_START',
            'V2_LOGIN_WITH_ACCESS',
            'V2_SOLVE_MINIGAME',
            'V2_CANCEL_MINIGAME',
            'V2_VALUABLE_ACTION',
            'V2_JOB_ACTION',
            'V2_JOB_TAKE',
            'V2_JOB_COMPLETE',
            'V2_JOB_DISMISS',
            'V2_MINIGAME_LOCK',
            'V2_LOADOUT_GET',
            'V2_EQUIP_HARDWARE',
            'V2_EQUIP_SOFTWARE',
            'V2_UNEQUIP_SOFTWARE',
            'V2_MARKET_OPTIONS',
            'V2_FETCH_MARKET',
            'V2_REQUEST_MARKET_JOBS',
        ];
        for (const type of dispatched) {
            expect(tabCommandSchemas[type as TabCommandType], `missing schema for ${type}`).toBeDefined();
        }
    });
});
