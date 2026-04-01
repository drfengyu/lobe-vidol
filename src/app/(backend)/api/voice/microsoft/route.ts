import { OpenAITTS } from '@lobehub/tts';

const tts = new OpenAITTS({
  apiKey: process.env.OPENAI_API_KEY,
});

export const POST = async (req: Request) => {
  try {
    const { message, pitch, speed, voice } = await req.json();

    // 确保 message 存在
    if (!message) {
      return Response.json({ error: 'Missing message' }, { status: 400 });
    }

    // 注意：OpenAI TTS 暂不支持 pitch/speed 直接设置
    // 如需使用，请查阅库文档是否支持自定义参数
    const payload: any = {
      model: 'tts-1',          // 或 'gpt-4o-mini-tts'
      input: message,
      voice: voice || 'alloy',
      response_format: 'mp3',  // 注意字段名
    };

    // 如果库支持 speed，可添加
    if (speed !== undefined) {
      payload.speed = Number(speed);
    }

    const result = await tts.create(payload);
    const arrayBuffer = result instanceof ArrayBuffer ? result : await result.arrayBuffer();

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('OpenAI TTS error:', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
};
