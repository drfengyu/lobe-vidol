import { VRM } from '@pixiv/three-vrm';
import { AnimationAction, AnimationClip, AnimationMixer, LoopOnce, LoopRepeat } from 'three';

import { loadMixamoAnimation } from '@/libs/FBXAnimation/loadMixamoAnimation';
import { loadVMDAnimation } from '@/libs/VMDAnimation/loadVMDAnimation';
import IKHandler from '@/libs/VMDAnimation/vrm-ik-handler';
import VRMIKHandler from '@/libs/VMDAnimation/vrm-ik-handler';
import { loadVRMAnimation } from '@/libs/VRMAnimation/loadVRMAnimation';

import { MotionPresetName, motionPresetMap } from './motionPresetMap';
import { MotionFileType, MotionSequenceItem } from './type';

export class MotionController {
  private vrm: VRM;
  private mixer?: AnimationMixer;
  private currentAction?: AnimationAction;
  private currentClip?: AnimationClip;
  private ikHandler: VRMIKHandler;
  private preloadedMotions = new Map<string, AnimationClip>();
  private _sequenceItems: MotionSequenceItem[] = [];
  private _sequenceIndex = 0;
  private _sequenceOnComplete?: () => void;
  private _finishedHandler?: (e: { action: AnimationAction }) => void;

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.ikHandler = IKHandler.get(vrm);
  }

  public async preloadMotion(motion: MotionPresetName) {
    const { type, url } = this.getMotionInfo(motion);
    await this.preloadMotionUrl(type, url);
  }

  public async preloadMotionUrl(fileType: MotionFileType, url: string) {
    if (!this.preloadedMotions.has(url)) {
      const clip = await this.loadMotionClip(fileType, url);
      if (clip) {
        this.preloadedMotions.set(url, clip);
      }
    }
  }

  public playMotion(motion: MotionPresetName, loop: boolean) {
    const { type, url } = this.getMotionInfo(motion);
    if (type && url) this.playMotionUrl(type, url, loop);
  }

  private getMotionInfo(motion: MotionPresetName) {
    return motionPresetMap[motion] || motionPresetMap.idle;
  }

  /**
   * 按顺序播放一系列动作，每个动作播放一次（不循环）
   * @param items 动作序列
   * @param onComplete 全部播放完成后的回调
   */
  public async playMotionSequence(
    items: MotionSequenceItem[],
    onComplete?: () => void,
  ): Promise<void> {
    if (items.length === 0) {
      onComplete?.();
      return;
    }

    this._sequenceItems = [...items];
    this._sequenceIndex = 0;
    this._sequenceOnComplete = onComplete;

    await this._playNextInSequence();
  }

  private async _playNextInSequence(): Promise<void> {
    if (this._sequenceIndex >= this._sequenceItems.length) {
      this._sequenceItems = [];
      this._sequenceOnComplete?.();
      this._sequenceOnComplete = undefined;
      return;
    }

    const item = this._sequenceItems[this._sequenceIndex];
    let fileType: MotionFileType;
    let url: string;

    if (item.type === 'preset') {
      const info = this.getMotionInfo(item.preset as MotionPresetName);
      fileType = info.type as MotionFileType;
      url = info.url;
    } else {
      fileType = item.fileType;
      url = item.url;
    }

    this._sequenceIndex++;

    // 移除之前的 finished 监听
    if (this._finishedHandler && this.mixer) {
      this.mixer.removeEventListener('finished', this._finishedHandler);
    }

    this.stopMotion();

    let clip: AnimationClip | undefined;
    if (this.preloadedMotions.has(url)) {
      clip = this.preloadedMotions.get(url);
    } else {
      clip = await this.loadMotionClip(fileType, url);
    }

    if (!clip) {
      console.error(`无法加载动作: ${url}`);
      await this._playNextInSequence();
      return;
    }

    this.mixer = new AnimationMixer(this.vrm.scene);
    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.setLoop(LoopOnce, 1);
    this.currentAction.play();
    this.currentClip = clip;

    this._finishedHandler = () => {
      this._playNextInSequence();
    };
    this.mixer.addEventListener('finished', this._finishedHandler);
  }

  public async playMotionUrl(
    fileType: MotionFileType,
    url: string,
    loop: boolean = true,
  ): Promise<void> {
    this.stopMotion();

    let clip: AnimationClip | undefined;

    if (this.preloadedMotions.has(url)) {
      clip = this.preloadedMotions.get(url);
    } else {
      clip = await this.loadMotionClip(fileType, url);
    }

    if (!clip) {
      console.error(`无法加载动作: ${url}`);
      return;
    }

    // 创建新的 mixer
    this.mixer = new AnimationMixer(this.vrm.scene);

    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    this.currentAction.play();

    this.currentClip = clip;
  }

  private async loadMotionClip(
    fileType: MotionFileType,
    url: string,
  ): Promise<AnimationClip | undefined> {
    switch (fileType) {
      case 'vmd':
        return await this.loadVMD(url);
      case 'fbx':
        return await this.loadFBX(url);
      case 'vrma':
        return await this.loadVRMA(url);
      default:
        throw new Error('不支持的文件格式');
    }
  }

  private async loadVMD(url: string): Promise<AnimationClip | undefined> {
    return await loadVMDAnimation(url, this.vrm);
  }

  private async loadFBX(url: string): Promise<AnimationClip | undefined> {
    return await loadMixamoAnimation(url, this.vrm);
  }

  private async loadVRMA(url: string): Promise<AnimationClip | undefined> {
    return await loadVRMAnimation(url, this.vrm);
  }

  public stopMotion(): void {
    if (this.mixer) {
      if (this._finishedHandler) {
        this.mixer.removeEventListener('finished', this._finishedHandler);
        this._finishedHandler = undefined;
      }
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.vrm.scene);
    }

    this.ikHandler.disableAll();

    if (this.currentAction) {
      this.currentAction.stop();
    }

    this.currentAction = undefined;
    this.currentClip = undefined;
    this.mixer = undefined;
    this._sequenceItems = [];
    this._sequenceIndex = 0;
    this._sequenceOnComplete = undefined;
  }

  public update(delta: number): void {
    if (this.mixer) {
      this.mixer.update(delta);
    }
    this.vrm.update(delta);
    this.ikHandler.update();
  }
}
