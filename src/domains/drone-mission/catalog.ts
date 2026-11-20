import type { MissionItemRequirement, MissionStep } from './model.js';

function item(name: string, quantity: number, itemConfigId?: string, aliases?: readonly string[]): MissionItemRequirement {
    return { name, quantity, ...(itemConfigId ? { itemConfigId } : {}), ...(aliases ? { aliases } : {}) };
}

/** Alternate spelling seen in the game's own `get.page` frame. */
const HOLO_CABLE_ALIASES = ['Holoscene Holographic cable'];
const HOLO_PROCESSOR_ALIASES = ['Holoscene Holographic processor'];

/**
 * The drone-build quest catalog. Names come from the authoritative task
 * document (English, matching against the warehouse by name); the 15-step
 * skeleton, titles and notes come from the game's `list.history` frame. Item
 * `itemConfigId`s confirmed by live `get.page` frames are kept for exact
 * matching, with name/alias matching as fallback. Group ids and subtaskKey
 * links are stable so progress survives wording changes.
 */
export const DRONE_MISSION_STEPS: readonly MissionStep[] = [
    {
        number: 1,
        title: 'FARLINE Universal Crimper',
        note: '找工具、弄到文档、把他的债摆平；这三样不办完克里斯不会动手。',
        subtaskKeys: ['1A', '1B', '1C'],
        groups: [
            {
                id: 's1-tool', kind: 'items', label: 'FARLINE Universal Crimper',
                items: [item('FARLINE Universal Crimper', 1)], skipCr: 27000, subtaskKey: '1A',
            },
            {
                id: 's1-debt', kind: 'cr-only', label: "Chris's Debt",
                requiredCr: 30000, subtaskKey: '1C',
            },
        ],
    },
    {
        number: 2,
        title: 'Workshop Selection',
        note: '两个车间二选一：CUU 生产线快但贵，机库便宜但费力。',
        subtaskKeys: ['2A'],
        groups: [
            {
                id: 's2-choice', kind: 'choice', label: 'Workshop Selection', subtaskKey: '2A',
                options: [
                    { key: 'cuu', label: 'CUU — 40,000 CR', skipCr: 40000, waitMinutes: 240 },
                    { key: 'hangar', label: 'Hangar — 15,000 CR', skipCr: 15000, waitMinutes: 1200 },
                ],
            },
        ],
    },
    {
        number: 3,
        title: 'Seed Funding',
        note: '克里斯要钱买耗材，这笔钱躲不掉。',
        subtaskKeys: ['3A'],
        groups: [{ id: 's3-fee', kind: 'cr-only', label: 'Seed Funding', requiredCr: 10000, subtaskKey: '3A' }],
    },
    {
        number: 4,
        title: 'Forged Drone License',
        note: '连接 RM7-A2ES，下载 TRN_OPERATOR_L3.JJQV，解密后重新上传以完成执照阶段。',
        subtaskKeys: ['4A'],
        groups: [],
    },
    {
        number: 5,
        title: 'Worker Clothing',
        note: '无人机的关键部件与线缆，还要帮卡普林斯的工人一把。',
        subtaskKeys: ['5A', '5B', '5C'],
        groups: [
            {
                id: 's5-headwear', kind: 'items', label: 'Beanie & Utility boots',
                items: [item('Old Abibas beanie', 3), item('CCS "Kaloshi" Utility boots', 3)],
                skipCr: 23000, subtaskKey: '5A',
            },
            {
                id: 's5-bars', kind: 'items', label: 'Energy bars',
                items: [item('Soylent green bar', 3), item('Kosmonavt Energy Bar', 3)],
                skipCr: 47000, subtaskKey: '5B',
            },
            {
                id: 's5-cable', kind: 'items', label: 'High-load auxiliary cable',
                items: [item('High-load auxiliary cable', 2)], skipCr: 82000, subtaskKey: '5C',
            },
        ],
    },
    {
        number: 6,
        title: 'Superconductor',
        note: '发电部件：涅尔加金、纳米封装、水，还有牛奶。',
        subtaskKeys: ['6A', '6B', '6C'],
        groups: [
            {
                id: 's6-plate', kind: 'items', label: 'Nergalium-79-B slab',
                items: [item('Nergalium-79-B slab', 1)], skipCr: 63000, subtaskKey: '6A',
            },
            {
                id: 's6-supplies', kind: 'items', label: 'Nano package & Water & Milk',
                items: [
                    item('Core tech NIC "Nano" package', 1), item('Water vial', 3), item('Artificial milk', 3),
                ],
                skipCr: 72000, subtaskKey: '6B',
            },
        ],
    },
    {
        number: 7,
        title: 'Shielding Element',
        note: '火星样本密封容器的屏蔽层：锎板、数据线缆与紧固件工具。',
        subtaskKeys: ['7A', '7B', '7C'],
        groups: [
            {
                id: 's7-plate', kind: 'items', label: 'Californium-252 slab',
                items: [item('Californium-252 slab', 1, '019d719f-84f4-71e8-a58e-983a7207e73e')],
                skipCr: 45000, subtaskKey: '7A',
            },
            {
                id: 's7-cable', kind: 'items', label: 'Holocene Holographic cable',
                items: [item('Holocene Holographic cable', 1, '019d719f-84f4-7114-bd53-7867ad546099', HOLO_CABLE_ALIASES)],
                skipCr: 17000, subtaskKey: '7B',
            },
            {
                id: 's7-tools', kind: 'items', label: 'Scissors & Scalpel & straps',
                items: [
                    item('Scissors (CCS Field Surgeon Kit Mk2)', 3, '019d719f-84f4-7d88-a0ea-ab3d4bbe9451'),
                    item('Scalpel (CCS Field Surgeon Kit Mk2)', 3, '019d719f-84f4-7580-9dbc-f130c318394e'),
                    item('NPO "Platforma" universal straps with backpack connector slot', 2, '019d719f-84f4-7adb-82ba-8ea327b77723'),
                ],
                skipCr: 94000, subtaskKey: '7C',
            },
        ],
    },
    {
        number: 8,
        title: 'Electronics',
        note: '导航矩阵：电子元件与医疗物资作为报酬。',
        subtaskKeys: ['8A', '8B', '8C'],
        groups: [
            {
                id: 's8-circuit', kind: 'items', label: 'Circuit components',
                items: [item('Circuit components', 2)], skipCr: 26000, subtaskKey: '8A',
            },
            {
                id: 's8-inhalers', kind: 'items', label: 'Painkiller & oxygen inhalers',
                items: [item('CCS Painkiller inhaler', 3), item('CCS small oxygen inhaler tank', 3)],
                skipCr: 95000, subtaskKey: '8B',
            },
            {
                id: 's8-medical', kind: 'items', label: 'METALIFE medical components',
                items: [item('METALIFE medical components', 2)], skipCr: 61000, subtaskKey: '8C',
            },
        ],
    },
    {
        number: 9,
        title: 'Optical Sensors',
        note: '无人机的眼睛：全息处理器光学传感器与控制板卡。',
        subtaskKeys: ['9A', '9B'],
        groups: [
            {
                id: 's9-processor', kind: 'items', label: 'Holographic processor & Burn kit',
                items: [
                    item('Holocene Holographic processor', 1, undefined, HOLO_PROCESSOR_ALIASES),
                    item('CCS Hydrogel Burn kit', 3),
                ],
                skipCr: 51000, subtaskKey: '9A',
            },
            {
                id: 's9-circuit', kind: 'items', label: 'Circuit components & processor',
                items: [
                    item('Circuit components', 2),
                    item('Holocene Holographic processor', 1, undefined, HOLO_PROCESSOR_ALIASES),
                ],
                skipCr: 47000, subtaskKey: '9B',
            },
        ],
    },
    {
        number: 10,
        title: 'Hostile Infringement Protection Firmware',
        note: '固件阶段：完成小游戏或付费、IFF 访问码、小游戏与费用。',
        subtaskKeys: ['10A', '10B', '10C'],
        groups: [
            {
                id: 's10-minigame', kind: 'choice', label: 'Minigame or CR', subtaskKey: '10A',
                options: [
                    { key: 'minigame', label: 'Complete Minigame', skipCr: 0 },
                    { key: 'pay', label: '16,300 CR', skipCr: 16300 },
                ],
            },
            { id: 's10-iff', kind: 'cr-only', label: 'IFF Codes', requiredCr: 11800, subtaskKey: '10B' },
            { id: 's10-finalize', kind: 'cr-only', label: 'Complete Minigame & 7,450 CR', requiredCr: 7450, subtaskKey: '10C' },
        ],
    },
    {
        number: 11,
        title: 'Assembly and Calibration',
        note: '执行机械臂：校准需要不少时间。',
        subtaskKeys: ['11A', '11B'],
        groups: [
            {
                id: 's11-tools', kind: 'items', label: 'Smartwrench & auxiliary cable',
                items: [
                    item('SPI "Smartwrench" Powered adjustable wrench', 1),
                    item('High-load auxiliary cable', 1),
                ],
                skipCr: 44000, subtaskKey: '11A',
            },
        ],
    },
    {
        number: 12,
        title: 'Assembly Slot',
        note: '支付组装位费用，克里斯即可开始整机组装。',
        subtaskKeys: ['12A'],
        groups: [{ id: 's12-fee', kind: 'cr-only', label: 'Assembly Slot', requiredCr: 2860, subtaskKey: '12A' }],
    },
    {
        number: 13,
        title: 'Cargo Test',
        note: '首次试飞：货运测试费用。',
        subtaskKeys: ['13A', '13B', '13C'],
        groups: [{ id: 's13-fee', kind: 'cr-only', label: 'Cargo Test', requiredCr: 1500, subtaskKey: '13A' }],
    },
    {
        number: 14,
        title: 'System Integration',
        note: '导航模块和货运模块协议冲突，需要适配器与固件补丁。',
        subtaskKeys: ['14A'],
        groups: [{ id: 's14-fee', kind: 'cr-only', label: 'System Integration', requiredCr: 5000, subtaskKey: '14A' }],
    },
    {
        number: 15,
        title: 'Transfer',
        note: '系统注册与转运费用。',
        subtaskKeys: ['15A'],
        groups: [{ id: 's15-fee', kind: 'cr-only', label: 'Transfer', requiredCr: 4325, subtaskKey: '15A' }],
    },
];
