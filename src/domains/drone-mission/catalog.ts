import type { MissionStep } from './model.js';

function item(name: string, quantity: number, itemConfigId?: string) {
    return itemConfigId ? { name, quantity, itemConfigId } : { name, quantity };
}

/**
 * The drone-build quest catalog. The 15-step skeleton (numbers, English titles
 * and Chinese notes) comes from the game's `drone-build/list.history` frame;
 * item requirements and CR costs are transcribed from the user-provided task
 * text and kept stable so progress survives wording changes.
 *
 * `itemConfigId` values are filled in where the live `get.page` frame has
 * confirmed them (currently step 7). Unfilled items fall back to name matching.
 */
export const DRONE_MISSION_STEPS: readonly MissionStep[] = [
    {
        number: 1,
        title: 'FARLINE Universal Crimper',
        note: '克里斯给了我三件事：找工具、弄到文档、把他的债摆平。这三样不办完，他是不会动手的。',
        subtaskKeys: ['1A', '1B', '1C'],
        groups: [
            {
                id: 's1-tool', kind: 'items', label: 'FARLINE 通用压接工具',
                items: [item('FARLINE通用压接工具', 1)], skipCr: 27000, subtaskKey: '1A',
            },
            {
                id: 's1-debt', kind: 'cr-only', label: '债务（只能上交 CR）',
                requiredCr: 30000, subtaskKey: '1C',
            },
        ],
    },
    {
        number: 2,
        title: 'Workshop Selection',
        note: '两个车间可选：第一个几乎现成、快但贵；第二个是废弃机库、便宜但费力。',
        subtaskKeys: ['2A'],
        groups: [
            {
                id: 's2-choice', kind: 'choice', label: '二选一', subtaskKey: '2A',
                options: [
                    { key: 'cuu', label: 'CUU 生产线（快）', skipCr: 40000, waitMinutes: 240 },
                    { key: 'hangar', label: '机库（便宜）', skipCr: 15000, waitMinutes: 1200 },
                ],
            },
        ],
    },
    {
        number: 3,
        title: 'Seed Funding',
        note: '克里斯要钱买耗材。这笔钱躲不掉，就当是投资。',
        subtaskKeys: ['3A'],
        groups: [{ id: 's3-fee', kind: 'cr-only', label: '启动资金', requiredCr: 10000, subtaskKey: '3A' }],
    },
    {
        number: 4,
        title: 'Forged Drone License',
        note: '提交伪造的无人机执照申请，等待系统处理。',
        subtaskKeys: ['4A'],
        groups: [],
    },
    {
        number: 5,
        title: 'Worker Clothing',
        note: '无人机的关键部件：复合板材和桨叶，还要特定线缆，以及帮卡普林斯的工人一把。',
        subtaskKeys: ['5A', '5B', '5C'],
        groups: [
            {
                id: 's5-headwear', kind: 'items', label: '阿比巴斯帽 + CSS 靴子',
                items: [item('阿比巴斯帽', 3), item('CSS靴子', 3)], skipCr: 23000, subtaskKey: '5A',
            },
            {
                id: 's5-bars', kind: 'items', label: '白色能量棒 + 红色能量棒',
                items: [item('白色能量棒', 3), item('红色能量棒', 3)], skipCr: 47000, subtaskKey: '5B',
            },
            {
                id: 's5-cable', kind: 'items', label: '高负荷电缆',
                items: [item('高负荷电缆', 2)], skipCr: 82000, subtaskKey: '5C',
            },
        ],
    },
    {
        number: 6,
        title: 'Superconductor',
        note: '发电部件：涅尔加金、纳米元件、水，还有……牛奶？',
        subtaskKeys: ['6A', '6B', '6C'],
        groups: [
            {
                id: 's6-plate', kind: 'items', label: 'Nergalium-79-B 金属板',
                items: [item('Nergalium-79-B金属板', 1)], skipCr: 63000, subtaskKey: '6A',
            },
            {
                id: 's6-supplies', kind: 'items', label: '纳米封装 + 水瓶 + 牛奶',
                items: [item('核心技术NIC“纳米”封装', 1), item('水瓶', 3), item('牛奶', 3)],
                skipCr: 72000, subtaskKey: '6B',
            },
        ],
    },
    {
        number: 7,
        title: 'Shielding Element',
        note: '装火星样本用的密封容器：锎做屏蔽、数据线缆，以及一大堆螺栓螺母之类的工具。',
        subtaskKeys: ['7A', '7B', '7C'],
        groups: [
            {
                id: 's7-plate', kind: 'items', label: 'Californium-252 屏蔽板',
                items: [item('Californium-252金属板', 1, '019d719f-84f4-71e8-a58e-983a7207e73e')],
                skipCr: 45000, subtaskKey: '7A',
            },
            {
                id: 's7-holo', kind: 'items', label: '全息场景 + 全息电缆',
                items: [
                    item('全息场景', 1),
                    item('全息电缆', 1, '019d719f-84f4-7114-bd53-7867ad546099'),
                ],
                skipCr: 17000, subtaskKey: '7B',
            },
            {
                id: 's7-tools', kind: 'items', label: '手术刀 + 手术剪刀 + 背包带子',
                items: [
                    item('手术刀', 3, '019d719f-84f4-7580-9dbc-f130c318394e'),
                    item('手术剪刀', 3, '019d719f-84f4-7d88-a0ea-ab3d4bbe9451'),
                    item('背包带子', 2, '019d719f-84f4-7adb-82ba-8ea327b77723'),
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
                id: 's8-electronics', kind: 'items', label: '电子元件',
                items: [item('电子元件', 2)], skipCr: 26000, subtaskKey: '8A',
            },
            {
                id: 's8-inhalers', kind: 'items', label: 'CSSI 止痛吸入剂 + CSS 小型氧气吸入罐',
                items: [item('CSSI止痛吸入剂', 3), item('CSS小型氧气吸入罐', 3)], skipCr: 95000, subtaskKey: '8B',
            },
            {
                id: 's8-medical', kind: 'items', label: 'METALIFE 医疗部件',
                items: [item('METALIFE医疗部件', 2)], skipCr: 61000, subtaskKey: '8C',
            },
        ],
    },
    {
        number: 9,
        title: 'Optical Sensors',
        note: '无人机的眼睛：基于全息处理器的光学传感器，加一块克里斯做的控制板卡。',
        subtaskKeys: ['9A', '9B'],
        groups: [
            {
                id: 's9-processor', kind: 'items', label: 'Holoscene 全息处理器 + CCS 水凝胶烧伤套件',
                items: [item('Holoscene全息处理器', 1), item('CCS水凝胶烧伤套件', 3)], skipCr: 51000, subtaskKey: '9A',
            },
            {
                id: 's9-electronics', kind: 'items', label: '电子元件 + 全息处理器',
                items: [item('电子元件', 2), item('全息处理器', 1)], skipCr: 47000, subtaskKey: '9B',
            },
        ],
    },
    {
        number: 10,
        title: 'Hostile Infringement Protection Firmware',
        note: '到软件了：固件、访问码、神经 AI 的校准与训练。',
        subtaskKeys: ['10A', '10B', '10C'],
        groups: [{ id: 's10-fee', kind: 'cr-only', label: '固件 / 访问码 / 校准（三项花费）', requiredCr: 34745, subtaskKey: '10A' }],
    },
    {
        number: 11,
        title: 'Assembly and Calibration',
        note: '执行机械臂：取样、修设备、干所有体力活的工具，校准需要不少时间。',
        subtaskKeys: ['11A', '11B'],
        groups: [
            {
                id: 's11-tools', kind: 'items', label: 'SPL 智能调节扳手 + 高负荷辅助电缆',
                items: [item('SPL"Smartwrench"智能调节扳手', 1), item('高负荷辅助电缆', 1)],
                skipCr: 44000, subtaskKey: '11A',
            },
        ],
    },
    {
        number: 12,
        title: 'Assembly Slot',
        note: '支付组装位费用，克里斯即可开始整机组装。',
        subtaskKeys: ['12A'],
        groups: [{ id: 's12-fee', kind: 'cr-only', label: '组装位费用', requiredCr: 2860, subtaskKey: '12A' }],
    },
    {
        number: 13,
        title: 'Cargo Test',
        note: '首次试飞：货运、通信、隐身三项实测。',
        subtaskKeys: ['13A', '13B', '13C'],
        groups: [{ id: 's13-fee', kind: 'cr-only', label: '测试费用（20 小时倒计时）', requiredCr: 1500, waitMinutes: 1200, subtaskKey: '13A' }],
    },
    {
        number: 14,
        title: 'System Integration',
        note: '导航模块和货运模块之间有协议冲突，需要一个适配器和一个固件补丁。',
        subtaskKeys: ['14A'],
        groups: [{ id: 's14-fee', kind: 'cr-only', label: '系统集成费用', requiredCr: 5000, subtaskKey: '14A' }],
    },
    {
        number: 15,
        title: 'Official Recognition',
        note: '到系统注册：交费、给无人机起名，然后等审核。WS 未给出具体金额，费用待补。',
        subtaskKeys: ['15A'],
        groups: [],
    },
];
