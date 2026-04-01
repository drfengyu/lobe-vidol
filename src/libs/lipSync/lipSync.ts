import { LipSyncAnalyzeResult } from './lipSyncAnalyzeResult';

const TIME_DOMAIN_DATA_LENGTH = 2048;

export class LipSync {
  public readonly audio: AudioContext;
  public readonly analyser: AnalyserNode;
  public readonly timeDomainData: Float32Array<ArrayBuffer>;
  public bufferSource: AudioBufferSourceNode | undefined;

  // 平滑相关
  private smoothedVolume = 0;
  private readonly attackRate = 0.35;   // 张嘴速度
  private readonly releaseRate = 0.12;  // 闭嘴速度

  public constructor(audio: AudioContext) {
    this.audio = audio;
    this.bufferSource = undefined;

    this.analyser = audio.createAnalyser();
    this.analyser.fftSize = TIME_DOMAIN_DATA_LENGTH * 2; // 可选：更细一点
    this.timeDomainData = new Float32Array(TIME_DOMAIN_DATA_LENGTH);
  }

  public update(): LipSyncAnalyzeResult {
    this.analyser.getFloatTimeDomainData(this.timeDomainData);

    // 1) RMS 计算，更稳定
    let sum = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const v = this.timeDomainData[i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.timeDomainData.length);

    // 2) 轻微增益 + Sigmoid 压缩
    let volume = rms * 2.8;
    volume = 1 / (1 + Math.exp(-8 * (volume - 0.18)));

    // 3) 静音门限
    if (volume < 0.05) volume = 0;

    // 4) 攻击/释放平滑
    if (volume > this.smoothedVolume) {
      this.smoothedVolume += (volume - this.smoothedVolume) * this.attackRate;
    } else {
      this.smoothedVolume += (volume - this.smoothedVolume) * this.releaseRate;
    }

    // 5) 再做一次极小值清理
    if (this.smoothedVolume < 0.02) this.smoothedVolume = 0;

    return {
      volume: this.smoothedVolume,
    };
  }

  public async playFromArrayBuffer(buffer: ArrayBuffer, onEnded?: () => void) {
    const audioBuffer = await this.audio.decodeAudioData(buffer);

    this.bufferSource = this.audio.createBufferSource();
    this.bufferSource.buffer = audioBuffer;

    this.bufferSource.connect(this.audio.destination);
    this.bufferSource.connect(this.analyser);

    if (onEnded) {
      this.bufferSource.addEventListener('ended', onEnded);
    }

    this.bufferSource.start();
  }

  public stopPlay() {
    if (this.bufferSource) {
      this.bufferSource.stop();
      this.bufferSource.disconnect();
      this.bufferSource = undefined;
    }
  }

  public async playFromURL(url: string, onEnded?: () => void) {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    await this.playFromArrayBuffer(buffer, onEnded);
  }
}
