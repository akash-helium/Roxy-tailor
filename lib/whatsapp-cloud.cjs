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

function templateNameFromEnv(env = process.env) {
  return trimEnv(env.WHATSAPP_TEMPLATE_NAME) || 'welcome_message';
}

function templateLangFromEnv(env = process.env) {
  return trimEnv(env.WHATSAPP_TEMPLATE_LANG) || 'en_US';
}

function templateBodyParamCount(env = process.env) {
  const raw = trimEnv(env.WHATSAPP_TEMPLATE_BODY_PARAMS);
  if (raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 0;
}

function getRichAutomateConfig(env = process.env) {
  const apiKey = trimEnv(env.RICHAUTOMATE_API_KEY);
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: trimEnv(env.RICHAUTOMATE_API_URL) || 'https://richautomate.in/api/v1',
    templateName: templateNameFromEnv(env),
    templateLang: templateLangFromEnv(env),
    bodyParamCount: templateBodyParamCount(env),
  };
}

function getWhatsAppCloudConfig(env = process.env) {
  const token = trimEnv(env.WHATSAPP_TOKEN || env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = trimEnv(env.WHATSAPP_PHONE_NUMBER_ID);
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    templateName: trimEnv(env.WHATSAPP_TEMPLATE_NAME),
    templateLang: templateLangFromEnv(env),
    graphVersion: trimEnv(env.WHATSAPP_GRAPH_VERSION) || 'v21.0',
    bodyParamCount: templateBodyParamCount(env),
  };
}

function richAutomateErrorMessage(json, status) {
  if (json?.error) return String(json.error);
  if (json?.message) return String(json.message);
  const firstError = json?.errors && Object.values(json.errors).flat()[0];
  if (firstError) return String(firstError);
  return `RichAutomate API error ${status}`;
}

async function sendRichAutomateTemplate(config, { to, name, orderNumber, items }) {
  const recipient = String(to || '').replace(/\D/g, '');
  if (recipient.length < 10) {
    throw new Error('Invalid WhatsApp number');
  }

  const variables = [];
  const paramCount = config.bodyParamCount ?? 0;
  if (paramCount > 0) {
    const values = [
      sanitizeTemplateText(name),
      sanitizeTemplateText(orderNumber, 24),
      sanitizeTemplateText(items, 120),
    ];
    for (let i = 0; i < paramCount; i += 1) {
      variables.push(values[i] || '-');
    }
  }

  const body = {
    phone: recipient,
    template: config.templateName,
    language: config.templateLang,
  };
  if (variables.length > 0) body.variables = variables;

  const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/send-template`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(richAutomateErrorMessage(json, res.status));
  }
  return { via: 'richautomate', data: json };
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
      const template = {
        name: config.templateName,
        language: { code: config.templateLang },
      };
      const paramCount = config.bodyParamCount ?? 0;
      if (paramCount > 0) {
        const values = [
          sanitizeTemplateText(name),
          sanitizeTemplateText(orderNumber, 24),
          sanitizeTemplateText(items, 120),
        ];
        template.components = [
          {
            type: 'body',
            parameters: values.slice(0, paramCount).map((text) => ({ type: 'text', text })),
          },
        ];
      }
      const data = await postGraphMessage(config, {
        ...base,
        type: 'template',
        template,
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
  const rich = getRichAutomateConfig(env);
  const cloud = getWhatsAppCloudConfig(env);
  if (!rich && !cloud) {
    return {
      ok: false,
      status: 'unconfigured',
      message:
        'WhatsApp is not set up. Add RICHAUTOMATE_API_KEY (Settings → API Keys in RichAutomate).',
    };
  }

  try {
    const result = rich
      ? await sendRichAutomateTemplate(rich, {
          to: payload?.phone,
          name: payload?.name,
          orderNumber: payload?.orderNumber,
          items: payload?.items,
        })
      : await sendWhatsAppCloudMessage({
          config: cloud,
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
  getRichAutomateConfig,
  getWhatsAppCloudConfig,
  sendWhatsAppCloudMessage,
  sendWhatsAppFromPayload,
};
