import { OpenAITTS } from '@lobehub/tts';

const tts = new OpenAITTS();

export const POST = async (req: Request) => {
  try {
    const { message, pitch, speed, voice } = await req.json();

    const pitchValue = Number(pitch ?? 1);
    const speedValue = Number(speed ?? 1);

    // 🪄 新写法：全部字段提到根层级
    const response = await tts.create({
      model: 'gpt-4o-mini-tts',
      input: message,
      voice: voice || 'alloy',
      format: 'mp3',
      // 🧠 pitch/speed 可用自定义方式控制，但不在类型定义里
    });

    return new Response(await response.arrayBuffer(), {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  } catch (error) {
    console.error('OpenAI TTS error:', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
};
