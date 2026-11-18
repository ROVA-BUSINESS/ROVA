export const config = {
  runtime: 'edge',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('audio') || formData.get('file');

    if (!file) {
      return new Response(JSON.stringify({ success: false, error: 'No audio file received' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

    const promptContext = 'Nigerian financial transaction speech. Context: Naira, Kobo, cartons, packs, supplier, customer, expense, sale, POS, NEPA, invoice, payment, transfer.';

    // 1. Try Groq Whisper (Ultra fast Whisper-Large-v3)
    if (groqKey) {
      try {
        const groqForm = new FormData();
        groqForm.append('file', file, 'voice.webm');
        groqForm.append('model', 'whisper-large-v3');
        groqForm.append('language', 'en');
        groqForm.append('prompt', promptContext);

        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: groqForm,
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          if (groqData.text && groqData.text.trim()) {
            return new Response(
              JSON.stringify({
                success: true,
                transcript: groqData.text.trim(),
                confidence: 0.96,
                source: 'groq_whisper',
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (groqErr) {
        console.warn('Groq Whisper error:', groqErr);
      }
    }

    // 2. Try OpenAI Whisper (whisper-1)
    if (openaiKey) {
      try {
        const oaiForm = new FormData();
        oaiForm.append('file', file, 'voice.webm');
        oaiForm.append('model', 'whisper-1');
        oaiForm.append('language', 'en');
        oaiForm.append('prompt', promptContext);

        const oaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
          },
          body: oaiForm,
        });

        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          if (oaiData.text && oaiData.text.trim()) {
            return new Response(
              JSON.stringify({
                success: true,
                transcript: oaiData.text.trim(),
                confidence: 0.95,
                source: 'openai_whisper',
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (oaiErr) {
        console.warn('OpenAI Whisper error:', oaiErr);
      }
    }

    // Return structured response if no key is configured on Vercel
    return new Response(
      JSON.stringify({
        success: false,
        error: 'NO_SPEECH_PROVIDER',
        message: 'No server speech provider configured on backend. Client will use fallback transcript.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Transcription failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
