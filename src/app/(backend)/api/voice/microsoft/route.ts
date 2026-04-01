import { OpenAITTS } from '@lobehub/tts';

const tts = new OpenAITTS({
  voice: 'alloy', // 可自定义默认音色
});

export const POST = async (req: Request) => {
  try {
    const { message, pitch, speed, voice } = await req.json();

    const pitchValue = Number(pitch ?? 1);
    const speedValue = Number(speed ?? 1);

    const response = await tts.create({
      model: 'gpt-4o-mini-tts', // ✅ 模型写在这里！
      input: message,
      options: {
        voice: voice || 'alloy',
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
