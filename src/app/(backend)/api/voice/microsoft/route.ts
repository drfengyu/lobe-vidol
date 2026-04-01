import { OpenAITTS } from '@lobehub/tts';

const tts = new OpenAITTS(); // ❌ 构造时别放 voice

export const POST = async (req: Request) => {
  try {
    const { message, pitch, speed, voice } = await req.json();

    const pitchValue = Number(pitch ?? 1);
    const speedValue = Number(speed ?? 1);

    const response = await tts.create({
      model: 'gpt-4o-mini-tts', // 语音模型
      input: message,
      options: {
        voice: voice || 'alloy', // ✅ 声音参数放在这里
        format: 'mp3',
        rate: speedValue - 1,
        pitch: (pitchValue - 1) / 2,
      },
    });

    return new Response(await response.arrayBuffer(), {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  } catch (error) {
    console.error('OpenAI TTS error:', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
};
