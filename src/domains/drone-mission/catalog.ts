import type { MissionStep } from './model.js';

function item(name: string, quantity: number, itemConfigId?: string) {
    return itemConfigId ? { name, quantity, itemConfigId } : { name, quantity };
}

/**
 * The 14-step drone mission catalog, transcribed from the user-provided task
 * text. Group ids are stable so progress survives catalog wording changes.
 * `itemConfigId` is intentionally left unset until the game config ids are
 * supplied; matching falls back to the display name in the meantime.
 */
export const DRONE_MISSION_STEPS: readonly MissionStep[] = [
    {
        number: 1,
        title: 'FARLINE 通用压接工具 + 债务',
        groups: [
            {
                id: 's1-tool',
                kind: 'items',
                label: 'FARLINE 通用压接工具',
                items: [item('FARLINE通用压接工具', 1)],
                skipCr: 27000,
            },
            {
                id: 's1-debt',
                kind: 'cr-only',
                label: '债务（只能上交 CR）',
                requiredCr: 30000,
            },
        ],
    },
    {
        number: 2,
        title: 'CUU 生产线 或 机库（二选一）',
        groups: [
            {
                id: 's2-choice',
                kind: 'choice',
                label: '二选一',
                options: [
                    { key: 'cuu', label: 'CUU 生产线', skipCr: 40000, waitMinutes: 240 },
                    { key: 'hangar', label: '机库', skipCr: 15000, waitMinutes: 1200 },
                ],
            },
        ],
    },
    {
        number: 3,
        title: '一项花费',
        groups: [{ id: 's3-fee', kind: 'cr-only', label: '一项花费', requiredCr: 10000 }],
    },
    {
        number: 4,
        title: '无要求',
        groups: [],
    },
    {
        number: 5,
        title: '服饰 / 能量棒 / 电缆',
        groups: [
            {
                id: 's5-headwear',
                kind: 'items',
                label: '阿比巴斯帽 + CSS 靴子',
                items: [item('阿比巴斯帽', 3), item('CSS靴子', 3)],
                skipCr: 23000,
            },
            {
                id: 's5-bars',
                kind: 'items',
                label: '白色能量棒 + 红色能量棒',
                items: [item('白色能量棒', 3), item('红色能量棒', 3)],
                skipCr: 47000,
            },
            {
                id: 's5-cable',
                kind: 'items',
                label: '高负荷电缆',
                items: [item('高负荷电缆', 2)],
                skipCr: 82000,
            },
        ],
    },
    {
        number: 6,
        title: 'Nergalium 金属板 / 纳米封装 / 饮品',
        groups: [
            {
                id: 's6-plate',
                kind: 'items',
                label: 'Nergalium-79-B 金属板',
                items: [item('Nergalium-79-B金属板', 1)],
                skipCr: 63000,
            },
            {
                id: 's6-supplies',
                kind: 'items',
                label: '纳米封装 + 水瓶 + 牛奶',
                items: [
                    item('核心技术NIC“纳米”封装', 1),
                    item('水瓶', 3),
                    item('牛奶', 3),
                ],
                skipCr: 72000,
            },
        ],
    },
    {
        number: 7,
        title: 'Californium 金属板 / 全息 / 医疗工具',
        groups: [
            {
                id: 's7-plate',
                kind: 'items',
                label: 'Californium-252 金属板',
                items: [item('Californium-252金属板', 1)],
                skipCr: 45000,
            },
            {
                id: 's7-holo',
                kind: 'items',
                label: '全息场景 + 全息电缆',
                items: [item('全息场景', 1), item('全息电缆', 1)],
                skipCr: 17000,
            },
            {
                id: 's7-tools',
                kind: 'items',
                label: '手术刀 + 手术剪刀 + 背包带子',
                items: [item('手术刀', 3), item('手术剪刀', 3), item('背包带子', 2)],
                skipCr: 94000,
            },
        ],
    },
    {
        number: 8,
        title: '电子元件 / 吸入剂 / 医疗部件',
        groups: [
            {
                id: 's8-electronics',
                kind: 'items',
                label: '电子元件',
                items: [item('电子元件', 2)],
                skipCr: 26000,
            },
            {
                id: 's8-inhalers',
                kind: 'items',
                label: 'CSSI 止痛吸入剂 + CSS 小型氧气吸入罐',
                items: [item('CSSI止痛吸入剂', 3), item('CSS小型氧气吸入罐', 3)],
                skipCr: 95000,
            },
            {
                id: 's8-medical',
                kind: 'items',
                label: 'METALIFE 医疗部件',
                items: [item('METALIFE医疗部件', 2)],
                skipCr: 61000,
            },
        ],
    },
    {
        number: 9,
        title: '全息处理器 / 烧伤套件 / 电子元件',
        groups: [
            {
                id: 's9-processor',
                kind: 'items',
                label: 'Holoscene 全息处理器 + CCS 水凝胶烧伤处理套件',
                items: [item('Holoscene全息处理器', 1), item('CCS水凝胶烧伤处理套件', 3)],
                skipCr: 51000,
            },
            {
                id: 's9-electronics',
                kind: 'items',
                label: '电子元件 + 全息处理器',
                items: [item('电子元件', 2), item('全息处理器', 1)],
                skipCr: 47000,
            },
        ],
    },
    {
        number: 10,
        title: '三项花费',
        groups: [{ id: 's10-fee', kind: 'cr-only', label: '三项花费', requiredCr: 34745 }],
    },
    {
        number: 11,
        title: '智能调节扳手 / 辅助电缆',
        groups: [
            {
                id: 's11-tools',
                kind: 'items',
                label: 'SPL 智能调节扳手 + 高负荷辅助电缆',
                items: [item('SPL"Smartwrench"智能调节扳手', 1), item('高负荷辅助电缆', 1)],
                skipCr: 44000,
            },
        ],
    },
    {
        number: 12,
        title: '一项花费',
        groups: [{ id: 's12-fee', kind: 'cr-only', label: '一项花费', requiredCr: 2860 }],
    },
    {
        number: 13,
        title: '一项花费（20 小时倒计时）',
        groups: [
            { id: 's13-fee', kind: 'cr-only', label: '一项花费', requiredCr: 1500, waitMinutes: 1200 },
        ],
    },
    {
        number: 14,
        title: '一项花费',
        groups: [{ id: 's14-fee', kind: 'cr-only', label: '一项花费', requiredCr: 5000 }],
    },
];
