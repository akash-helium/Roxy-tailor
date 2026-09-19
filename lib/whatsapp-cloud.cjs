function trimEnv(value) {
  return String(value || '').trim();
}

function sanitizeTemplateText(value, max = 60) {
  const text = String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (text || '-').slice(0, max);
}

function loadEnvFiles(filePaths) {
  for (const filePath of filePaths) {
    if (!filePath) continue;
    try {
      if (!require('node:fs').existsSync(filePath)) continue;
      const text = require('node:fs').readFileSync(filePath, 'utf8');
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq < 1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] == null || process.env[key] === '') {
          process.env[key] = value;
        }
      }
    } catch {
      // ignore unreadable env files
    }
  }
}

function getWhatsAppCloudConfig(env = process.env) {
  const token = trimEnv(env.WHATSAPP_TOKEN || env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = trimEnv(env.WHATSAPP_PHONE_NUMBER_ID);
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    templateName: trimEnv(env.WHATSAPP_TEMPLATE_NAME),
    templateLang: trimEnv(env.WHATSAPP_TEMPLATE_LANG) || 'en',
    graphVersion: trimEnv(env.WHATSAPP_GRAPH_VERSION) || 'v21.0',
  };
}

async function postGraphMessage(config, body) {
  const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      json?.error?.error_user_msg ||
      json?.error?.message ||
      `WhatsApp API error ${res.status}`;
    const error = new Error(message);
    error.code = json?.error?.code;
    error.details = json;
    throw error;
  }
  return json;
}

async function sendWhatsAppCloudMessage({
  config,
  to,
  message,
  name,
  orderNumber,
  items,
}) {
  const recipient = String(to || '').replace(/\D/g, '');
  if (recipient.length < 10) {
    throw new Error('Invalid WhatsApp number');
  }

  const base = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
  };

  if (config.templateName) {
    try {
      const data = await postGraphMessage(config, {
        ...base,
        type: 'template',
        template: {
          name: config.templateName,
          language: { code: config.templateLang },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: sanitizeTemplateText(name) },
                { type: 'text', text: sanitizeTemplateText(orderNumber, 24) },
                { type: 'text', text: sanitizeTemplateText(items, 120) },
              ],
            },
          ],
        },
      });
      return { via: 'template', data };
    } catch (error) {
      if (!message) throw error;
    }
  }

  const data = await postGraphMessage(config, {
    ...base,
    type: 'text',
    text: {
      preview_url: false,
      body: String(message || '').slice(0, 4096),
    },
  });
  return { via: 'text', data };
}

async function sendWhatsAppFromPayload(payload, env = process.env) {
  const config = getWhatsAppCloudConfig(env);
  if (!config) {
    return {
      ok: false,
      status: 'unconfigured',
      message:
        'WhatsApp Business API is not set up. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.',
    };
  }

  try {
    const result = await sendWhatsAppCloudMessage({
      config,
      to: payload?.phone,
      message: payload?.message,
      name: payload?.name,
      orderNumber: payload?.orderNumber,
      items: payload?.items,
    });
    return {
      ok: true,
      status: 'sent',
      via: result.via,
      message: 'WhatsApp confirmation sent',
    };
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      message: error instanceof Error ? error.message : 'WhatsApp send failed',
    };
  }
}

module.exports = {
  loadEnvFiles,
  getWhatsAppCloudConfig,
  sendWhatsAppCloudMessage,
  sendWhatsAppFromPayload,
};
