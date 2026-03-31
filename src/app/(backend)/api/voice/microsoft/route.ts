import { MicrosoftSpeechTTS } from '@lobehub/tts';

const tts = new MicrosoftSpeechTTS({ locale: 'en-US' });

export const POST = async (req: Request) => {
  try {
    const { message, pitch, speed, voice } = await req.json();

    const pitchValue = Number(pitch ?? 1);
    const speedValue = Number(speed ?? 1);

    const payload = {
      input: message,
      options: {
        voice: voice || 'en-US-GuyNeural',
        pitch: (pitchValue - 1) / 2,
        rate: speedValue - 1,
      },
    };

    const response = await tts.create(payload);

    return new Response(await response.arrayBuffer(), {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
};
