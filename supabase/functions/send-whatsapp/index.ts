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

function templateName() {
  return trimEnv(Deno.env.get('WHATSAPP_TEMPLATE_NAME')) || 'welcome_message';
}

function templateLang() {
  return trimEnv(Deno.env.get('WHATSAPP_TEMPLATE_LANG')) || 'en_US';
}

function templateBodyParamCount() {
  const raw = trimEnv(Deno.env.get('WHATSAPP_TEMPLATE_BODY_PARAMS'));
  if (raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 0;
}

function richAutomateErrorMessage(data: Record<string, unknown>, status: number) {
  if (typeof data.error === 'string') return data.error;
  if (typeof data.message === 'string') return data.message;
  const errors = data.errors as Record<string, string[]> | undefined;
  const firstError = errors && Object.values(errors).flat()[0];
  if (firstError) return String(firstError);
  return `RichAutomate API error ${status}`;
}

async function sendRichAutomate(apiKey: string, payload: {
  phone: string;
  name?: string;
  orderNumber?: string;
  items?: string;
}) {
  const baseUrl = (trimEnv(Deno.env.get('RICHAUTOMATE_API_URL')) || 'https://richautomate.in/api/v1').replace(
    /\/$/,
    '',
  );
  const paramCount = templateBodyParamCount();
  const variables: string[] = [];
  if (paramCount > 0) {
    const values = [
      sanitizeTemplateText(payload.name),
      sanitizeTemplateText(payload.orderNumber, 24),
      sanitizeTemplateText(payload.items, 120),
    ];
    for (let i = 0; i < paramCount; i += 1) {
      variables.push(values[i] || '-');
    }
  }
  const body: Record<string, unknown> = {
    phone: payload.phone,
    template: templateName(),
    language: templateLang(),
  };
  if (variables.length > 0) body.variables = variables;

  const res = await fetch(`${baseUrl}/send-template`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.success === false) {
    throw new Error(richAutomateErrorMessage(data, res.status));
  }
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

  const richKey = trimEnv(Deno.env.get('RICHAUTOMATE_API_KEY'));
  const token = trimEnv(Deno.env.get('WHATSAPP_TOKEN') ?? Deno.env.get('WHATSAPP_ACCESS_TOKEN'));
  const phoneNumberId = trimEnv(Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'));
  const graphTemplateName = trimEnv(Deno.env.get('WHATSAPP_TEMPLATE_NAME'));
  const graphVersion = trimEnv(Deno.env.get('WHATSAPP_GRAPH_VERSION')) || 'v21.0';

  if (!richKey && (!token || !phoneNumberId)) {
    return json(
      {
        ok: false,
        status: 'unconfigured',
        message:
          'WhatsApp is not set up. Add RICHAUTOMATE_API_KEY as a function secret.',
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

  try {
    if (richKey) {
      await sendRichAutomate(richKey, {
        phone: to,
        name: payload.name,
        orderNumber: payload.orderNumber,
        items: payload.items,
      });
      return json({
        ok: true,
        status: 'sent',
        via: 'richautomate',
        message: 'WhatsApp confirmation sent',
      });
    }

    const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
    const base = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
    };

    if (graphTemplateName) {
      try {
        const template: Record<string, unknown> = {
          name: graphTemplateName,
          language: { code: templateLang() },
        };
        const paramCount = templateBodyParamCount();
        if (paramCount > 0) {
          const values = [
            sanitizeTemplateText(payload.name),
            sanitizeTemplateText(payload.orderNumber, 24),
            sanitizeTemplateText(payload.items, 120),
          ];
          template.components = [
            {
              type: 'body',
              parameters: values.slice(0, paramCount).map((text) => ({ type: 'text', text })),
            },
          ];
        }
        await postGraphMessage(token, url, {
          ...base,
          type: 'template',
          template,
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
