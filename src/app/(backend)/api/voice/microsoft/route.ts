import { OpenAITTS } from '@lobehub/tts';

const tts = new OpenAITTS({
  model: 'gpt-4o-mini-tts', // 可换成 gpt-4o-tts 或别的 model
  voice: 'alloy',           // OpenAI 默认可选 voices: alloy, verse, coral, sage...
});

export const POST = async (req) => {
  try {
    const { message, pitch, speed, voice } = await req.json();

    const pitchValue = Number(pitch ?? 1);
    const speedValue = Number(speed ?? 1);

    const response = await tts.create({
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
