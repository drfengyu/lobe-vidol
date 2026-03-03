import { MotionFileType } from '@/libs/emoteController/type';
import type { MotionSequenceItem } from '@/libs/emoteController/type';

/**
 * 预定义的动作序列
 * 可在视频模式中通过 usePlayMotionSequence 或 viewer.model?.playMotionSequence 调用
 */
export const MOTION_SEQUENCES = {
  /** 开场介绍：招手 → 数字1指 → 展示 */
  intro: [
    { type: 'preset', preset: 'female_greeting' },
    { type: 'preset', preset: 'number_meter_1' },
    { type: 'preset', preset: 'female_appeal' },
  ] as MotionSequenceItem[],

  /** 讲解列举：数字1 → 2 → 3 */
  explainPoints: [
    { type: 'preset', preset: 'number_meter_1' },
    { type: 'preset', preset: 'number_meter_2' },
    { type: 'preset', preset: 'number_meter_3' },
  ] as MotionSequenceItem[],

  /** 指向系列：使用自定义 FBX 动作 */
  pointing: [
    { type: 'url', fileType: MotionFileType.FBX, url: '/animations/Pointing.fbx' },
    { type: 'url', fileType: MotionFileType.FBX, url: '/animations/PointingForward.fbx' },
    { type: 'url', fileType: MotionFileType.FBX, url: '/animations/ReachingOut.fbx' },
  ] as MotionSequenceItem[],

  /** 开心互动 */
  happy: [
    { type: 'preset', preset: 'female_happy' },
    { type: 'preset', preset: 'female_greeting' },
    { type: 'preset', preset: 'female_appeal' },
  ] as MotionSequenceItem[],
} as const;

export type MotionSequenceId = keyof typeof MOTION_SEQUENCES;
