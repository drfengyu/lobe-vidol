import { MicrosoftSpeechTTS } from '@lobehub/tts';

const tts = new MicrosoftSpeechTTS({ locale: 'en-US' });

export const POST = async (req: Request) => {
  const { message, pitch, speed, voice } = await req.json();

  const payload = {
    input: message,
    options: {
      voice: voice || 'en-US-GuyNeural',
      pitch: (pitch - 1) / 2,
      rate: speed - 1,
    },
  };

  // ✅ 调用 tts.create 获取音频数据
  const arrayBuffer = await tts.create(payload);

  return new Response(arrayBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
    },
  });
};
