const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function trimEnv(value: string | undefined) {
  return String(value || '').trim();
}

function sanitizeTemplateText(value: unknown, max = 60) {
  const text = String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (text || '-').slice(0, max);
}

async function postGraphMessage(
  token: string,
  url: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: { error_user_msg?: string; message?: string } })?.error
        ?.error_user_msg ||
      (data as { error?: { message?: string } })?.error?.message ||
      `WhatsApp API error ${res.status}`;
    throw new Error(message);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, status: 'failed', message: 'Method not allowed' }, 405);
  }

  const token = trimEnv(Deno.env.get('WHATSAPP_TOKEN') ?? Deno.env.get('WHATSAPP_ACCESS_TOKEN'));
  const phoneNumberId = trimEnv(Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'));
  const templateName = trimEnv(Deno.env.get('WHATSAPP_TEMPLATE_NAME'));
  const templateLang = trimEnv(Deno.env.get('WHATSAPP_TEMPLATE_LANG')) || 'en';
  const graphVersion = trimEnv(Deno.env.get('WHATSAPP_GRAPH_VERSION')) || 'v21.0';

  if (!token || !phoneNumberId) {
    return json(
      {
        ok: false,
        status: 'unconfigured',
        message:
          'WhatsApp Business API is not set up. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID as function secrets.',
      },
      501,
    );
  }

  let payload: {
    phone?: string;
    name?: string;
    orderNumber?: string;
    items?: string;
    message?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, status: 'failed', message: 'Invalid JSON' }, 400);
  }

  const to = String(payload.phone || '').replace(/\D/g, '');
  if (to.length < 10) {
    return json({ ok: false, status: 'failed', message: 'Invalid WhatsApp number' }, 400);
  }

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  const base = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
  };

  try {
    if (templateName) {
      try {
        await postGraphMessage(token, url, {
          ...base,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: sanitizeTemplateText(payload.name) },
                  { type: 'text', text: sanitizeTemplateText(payload.orderNumber, 24) },
                  { type: 'text', text: sanitizeTemplateText(payload.items, 120) },
                ],
              },
            ],
          },
        });
        return json({ ok: true, status: 'sent', via: 'template', message: 'WhatsApp confirmation sent' });
      } catch (error) {
        if (!payload.message) throw error;
      }
    }

    await postGraphMessage(token, url, {
      ...base,
      type: 'text',
      text: {
        preview_url: false,
        body: String(payload.message || '').slice(0, 4096),
      },
    });
    return json({ ok: true, status: 'sent', via: 'text', message: 'WhatsApp confirmation sent' });
  } catch (error) {
    return json(
      {
        ok: false,
        status: 'failed',
        message: error instanceof Error ? error.message : 'WhatsApp send failed',
      },
      400,
    );
  }
});
