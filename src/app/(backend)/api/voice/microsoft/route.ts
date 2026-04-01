import { OpenAITTS } from '@lobehub/tts';

const tts = new OpenAITTS({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
});

export const POST = async (req: Request) => {
  try {
    const { message, voice } = await req.json();

    const response = await tts.create({
      input: message,
      options: {
        model: 'tts-1',      // 官方支持模型，如 tts-1 或 gpt-4o-mini-tts
        voice: voice || 'alloy', // 可选音色：alloy / verse / coral / sage...
      },
    });

    // 转换为 mp3 输出
    return new Response(await response.arrayBuffer(), {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  } catch (err) {
    console.error('TTS error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
