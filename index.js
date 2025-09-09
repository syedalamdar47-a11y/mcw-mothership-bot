// index.js (CommonJS, Node 18/20)
require('dotenv').config();
const express = require('express');
const {
  ActivityHandler,
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} = require('botbuilder');

const app = express();
const PORT = process.env.PORT || process.env.WEBSITES_PORT || 8080;
app.use(express.json());

// ---------- n8n wiring ----------
const N8N_URL = process.env.N8N_WEBHOOK_URL || '';
console.log('Using N8N_WEBHOOK_URL:', N8N_URL || '(not set)');

async function askN8n(userQuestion) {
  if (!N8N_URL) return "My n8n endpoint isn't configured.";
  try {
    const r = await fetch(N8N_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuestion }),
    });

    const ctype = (r.headers.get('content-type') || '').toLowerCase();

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('n8n HTTP error', r.status, text);
      return `I couldn't reach n8n (HTTP ${r.status}).`;
    }

    if (ctype.includes('application/json')) {
      const data = await r.json().catch(() => ({}));
      return (data && data.answer) ? data.answer : JSON.stringify(data || {});
    } else {
      const text = await r.text().catch(() => '');
      return text || 'n8n responded with no content.';
    }
  } catch (err) {
    console.error('n8n call failed:', err?.message || err);
    return 'My n8n brain is unreachable right now.';
  }
}

// ---------- Bot Framework auth/adapter ----------
const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: process.env.MicrosoftAppId,
  MicrosoftAppPassword: process.env.MicrosoftAppPassword,
  MicrosoftAppType: process.env.MicrosoftAppType || 'SingleTenant',
  MicrosoftAppTenantId: process.env.MicrosoftAppTenantId,
});

const botFrameworkAuthentication =
  createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);

const adapter = new CloudAdapter(botFrameworkAuthentication);

adapter.onTurnError = async (context, error) => {
  console.error('Bot error:', error);
  try {
    await context.sendActivity('Sorry—something went wrong on my side.');
  } catch {}
};

// ---------- Bot ----------
class McwBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const incoming = (context.activity?.text ?? '').trim();
      console.log('Incoming message:', incoming);

      // DEBUG: prove the bot can reply to Web Chat immediately
      await context.sendActivity(`(debug) received: ${incoming || '[empty]'}`);

      try {
        const lower = incoming.toLowerCase();

        if (lower === 'hi' || lower === 'hello') {
          await context.sendActivity(
            "Hello! I’m your MCW Co-Pilot. Try:\n• “What’s Tampa utilization this week?”"
          );
        } else if (lower === 'help') {
          await context.sendActivity(
            "I can analyze Mothership data, send weekly snapshots, and more. Try: “Weekend snapshot”."
          );
        } else {
          const answer = await askN8n(incoming);
          await context.sendActivity(answer ?? '(empty answer from n8n)');
        }
      } catch (err) {
        console.error('onMessage failed:', err);
        await context.sendActivity('Sorry—message handler error.');
      }

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      await context.sendActivity("Hi! I’m online. Say “help” to see examples.");
      await next();
    });
  }
}
const bot = new McwBot();

// ---------- Endpoints ----------
app.get('/', (_, res) => res.status(200).send('ok'));
app.get('/healthz', (_, res) => res.status(200).send('healthy'));

// Messaging endpoint for Azure Bot Channel Service
app.post('/api/messages', (req, res) => {
  adapter.process(req, res, (context) => bot.run(context));
});

app.listen(PORT, () => {
  console.log(`Boot: MCW Co-Pilot server listening on ${PORT}`);
});
