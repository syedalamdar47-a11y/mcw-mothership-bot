import 'dotenv/config';
import express from 'express';
import {
  ActivityHandler,
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} from 'botbuilder';

const app = express();
const PORT = process.env.PORT || process.env.WEBSITES_PORT || 8080;
app.use(express.json());

// Health checks
app.get('/',  (_, res) => res.status(200).send('ok'));
app.get('/healthz', (_, res) => res.status(200).send('healthy'));

// ---- Bot Framework auth (single-tenant) ----
const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId:        process.env.MicrosoftAppId,
  MicrosoftAppPassword:  process.env.MicrosoftAppPassword,
  MicrosoftAppType:      process.env.MicrosoftAppType || 'SingleTenant',
  MicrosoftAppTenantId:  process.env.MicrosoftAppTenantId,
});
const botFrameworkAuthentication =
  createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(botFrameworkAuthentication);

adapter.onTurnError = async (context, error) => {
  console.error('Bot error:', error);
  await context.sendActivity('Sorry—something went wrong on my side.');
};

// ---- n8n wiring ----
const N8N_URL = process.env.N8N_WEBHOOK_URL;
console.log('Using N8N_WEBHOOK_URL:', N8N_URL || '(not set)');

async function askN8n(userQuestion) {
  if (!N8N_URL) return "My n8n endpoint isn't configured.";
  try {
    const r = await fetch(N8N_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuestion })
    });

    const raw = await r.text();              // log the raw body for visibility
    if (!r.ok) {
      console.error('n8n HTTP error', r.status, raw);
      return `I couldn't reach n8n (HTTP ${r.status}).`;
    }
    console.log('n8n raw:', raw);            // you should see {"answer":"..."} here
    let data;
    try { data = JSON.parse(raw); } catch { data = {}; }
    return data?.answer ?? "I didn’t get a response from n8n.";
  } catch (err) {
    console.error('n8n call failed:', err?.message || err);
    return 'My n8n brain is unreachable right now.';
  }
}

// ---- Bot ----
class McwBot extends ActivityHandler {
  constructor() {
    super();
    this.onMessage(async (context, next) => {
      const incoming = (context.activity.text || '').trim();
      console.log('Incoming message:', incoming);

      const reply = await askN8n(incoming);
      await context.sendActivity(reply);

      await next();
    });
  }
}
const bot = new McwBot();

// Endpoint Bot Service calls
app.post('/api/messages', (req, res) => {
  adapter.process(req, res, (context) => bot.run(context));
});

app.listen(PORT, () =>
  console.log(`Boot: MCW Co-Pilot server listening on ${PORT}`)
);
