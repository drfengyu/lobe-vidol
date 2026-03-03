export enum MotionFileType {
  // Motion 文件类型枚举
  FBX = 'fbx',
  VMD = 'vmd',
  VRMA = 'vrma',
}

/**
 * 动作序列项：可以是预设名称或 URL
 * preset 使用 MotionPresetName 枚举值
 */
export type MotionSequenceItem =
  | { type: 'preset'; preset: string }
  | { type: 'url'; fileType: MotionFileType; url: string };
