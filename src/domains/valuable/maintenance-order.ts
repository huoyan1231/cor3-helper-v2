export interface MaintenanceOrderEntry {
    readonly maintenanceId: number;
    readonly server: string;
    readonly ip: string;
}

/**
 * Built-in force-maintenance order. IP strings are intentionally kept verbatim
 * (some are not valid IPv4 literals); matching is exact string equality.
 */
export const MAINTENANCE_ORDER: readonly MaintenanceOrderEntry[] = [
    { maintenanceId: 1, server: 'RM7-W3L1', ip: '855.529.3.1' },
    { maintenanceId: 2, server: 'RM7-W3L3', ip: '855.529.3.3' },
    { maintenanceId: 3, server: 'D4RK 2IV0/3', ip: '853.172.0.3' },
    { maintenanceId: 4, server: 'SPRM7-N4L3', ip: '855.529.4.14' },
    { maintenanceId: 5, server: 'UPRM7-S3L2', ip: '855.529.5.33' },
    { maintenanceId: 6, server: 'URM7-M', ip: '855.529.5.1' },
    { maintenanceId: 7, server: 'URM7-W4L2', ip: '855.529.4.12' },
    { maintenanceId: 8, server: 'RM7-A2ES', ip: '855.529.8.2' },
    { maintenanceId: 9, server: 'RM7-W3L2', ip: '855.529.3.2' },
    { maintenanceId: 10, server: 'RM7-W3L4', ip: '855.529.3.4' },
    { maintenanceId: 11, server: 'B43273N', ip: '854.266.7.3' },
    { maintenanceId: 12, server: 'D4RK RM7EG', ip: '855.528.0.14' },
    { maintenanceId: 13, server: 'D4RK T43272', ip: '853.172.2.2' },
    { maintenanceId: 14, server: 'D4RK T43274', ip: '853.172.2.4' },
    { maintenanceId: 15, server: 'SRM7-M', ip: '855.529.4.10' },
    { maintenanceId: 16, server: 'SRM7-N4L2', ip: '855.529.4.8' },
    { maintenanceId: 17, server: 'URM7-H', ip: '855.529.5.0' },
    { maintenanceId: 18, server: 'URM7-S5L2', ip: '855.529.5.2' },
    { maintenanceId: 19, server: 'RM7-N2L3', ip: '855.529.4.3' },
    { maintenanceId: 20, server: 'RM7-S4L1', ip: '855.529.2.1' },
    { maintenanceId: 21, server: 'RM7-S4L3', ip: '855.529.2.3' },
    { maintenanceId: 22, server: 'RM7-S4WCP', ip: '855.529.2.0' },
    { maintenanceId: 23, server: 'RM7-ST/A-S4', ip: '855.529.2.04' },
    { maintenanceId: 24, server: 'RM7-W3NCP', ip: '855.529.3.7' },
    { maintenanceId: 25, server: 'B43272N', ip: '854.266.7.2' },
    { maintenanceId: 26, server: 'B43274N', ip: '854.266.7.4' },
    { maintenanceId: 27, server: 'D4RK 2IV2', ip: '855.528.0.2' },
    { maintenanceId: 28, server: 'D4RK RM7MI', ip: '855.528.0.12' },
    { maintenanceId: 29, server: 'EM[UNDEFINED]', ip: '855.529.4.22' },
    { maintenanceId: 30, server: 'SRM7-N3L1', ip: '855.529.4.6' },
    { maintenanceId: 31, server: 'SRM7-N3L2', ip: '855.529.4.17' },
    { maintenanceId: 32, server: 'RM7-N1L1', ip: '855.529.4.1' },
    { maintenanceId: 33, server: 'RM7-N2L2', ip: '855.529.4.2' },
    { maintenanceId: 34, server: 'RM7-S4L2', ip: '855.529.2.12' },
    { maintenanceId: 35, server: 'RM7-S4L4', ip: '855.529.2.4' },
    { maintenanceId: 36, server: 'B43271N', ip: '854.266.7.1' },
    { maintenanceId: 37, server: 'D4RK RM7CE', ip: '855.528.0.4' },
    { maintenanceId: 38, server: 'RM7-E1L2CT', ip: '855.529.1.13' },
    { maintenanceId: 39, server: 'RM7-E1SCP', ip: '855.529.1.2' },
    { maintenanceId: 40, server: 'RM7-N2ECP', ip: '855.529.4.13' },
    { maintenanceId: 41, server: 'EM[RM7-E2L2]', ip: '855.529.2.2' },
    { maintenanceId: 42, server: 'RM7-E1L3', ip: '855.529.1.3' },
    { maintenanceId: 43, server: 'RM7-E1L5', ip: '855.529.1.5' },
    { maintenanceId: 44, server: 'HOME', ip: '855.529.0.2' },
];

function orderKey(name: string, ip: string): string {
    return `${name}\u0000${ip}`;
}

const ORDER_BY_NAME_AND_IP = new Map(MAINTENANCE_ORDER.map((entry) => [
    orderKey(entry.server, entry.ip),
    entry,
]));

export function findMaintenanceOrder(
    name: string | null | undefined,
    ip: string | null | undefined,
): MaintenanceOrderEntry | null {
    if (typeof name !== 'string' || typeof ip !== 'string') return null;
    return ORDER_BY_NAME_AND_IP.get(orderKey(name, ip)) ?? null;
}
