import { MicrosoftSpeechTTS } from '@lobehub/tts';

const tts = new MicrosoftSpeechTTS({ locale: 'en-US' });

export const POST = async (req: Request) => {
  try {
    const { message, pitch, speed, voice } = await req.json();

    const payload = {
      input: message,
      options: {
        voice: voice || 'en-US-GuyNeural',
        pitch: (pitch - 1) / 2,
        rate: speed - 1,
      },
    };

    const audioResponse = await tts.create(payload);
    
    if (!audioResponse.ok) {
      throw new Error(`TTS API error: ${audioResponse.status}`);
    }

    const arrayBuffer = await audioResponse.arrayBuffer();

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
