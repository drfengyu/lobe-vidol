import { MicrosoftSpeechTTS } from '@lobehub/tts';

// Instantiate MicrosoftSpeechTTS
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

  const response = await tts.create(payload);
  const audioData = await response.arrayBuffer(); // 直接得到 ArrayBuffer

  return new Response(audioData, {
    headers: { 'Content-Type': 'audio/mpeg' },
  });
};
