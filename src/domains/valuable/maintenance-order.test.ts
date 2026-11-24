import { describe, expect, it } from 'vitest';
import { findMaintenanceOrder, MAINTENANCE_ORDER } from './maintenance-order.js';

describe('MAINTENANCE_ORDER', () => {
    it('contains the full 44-entry catalog in ascending order', () => {
        expect(MAINTENANCE_ORDER).toHaveLength(44);
        expect(MAINTENANCE_ORDER.map((entry) => entry.maintenanceId)).toEqual(
            Array.from({ length: 44 }, (_, index) => index + 1),
        );
    });

    it('preserves unusual IP strings verbatim', () => {
        expect(MAINTENANCE_ORDER.find((entry) => entry.maintenanceId === 23)).toEqual({
            maintenanceId: 23,
            server: 'RM7-ST/A-S4',
            ip: '855.529.2.04',
        });
        expect(MAINTENANCE_ORDER.find((entry) => entry.maintenanceId === 44)).toEqual({
            maintenanceId: 44,
            server: 'HOME',
            ip: '855.529.0.2',
        });
    });

    it('matches only exact name and IP pairs', () => {
        expect(findMaintenanceOrder('RM7-W3L1', '855.529.3.1')?.maintenanceId).toBe(1);
        expect(findMaintenanceOrder('RM7-W3L1', '855.529.3.2')).toBeNull();
        expect(findMaintenanceOrder('rm7-w3l1', '855.529.3.1')).toBeNull();
        expect(findMaintenanceOrder('RM7-W3L1 ', '855.529.3.1')).toBeNull();
        expect(findMaintenanceOrder(null, '855.529.3.1')).toBeNull();
        expect(findMaintenanceOrder('RM7-W3L1', null)).toBeNull();
    });
});
