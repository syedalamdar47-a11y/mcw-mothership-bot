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

const N8N_URL = process.env.N8N_WEBHOOK_URL;
console.log('Using N8N_WEBHOOK_URL:', N8N_URL || '(not set)');

app.use(express.json());

// Health checks
app.get('/', (_, res) => res.status(200).send('ok'));
app.get('/healthz', (_, res) => res.status(200).send('healthy'));

// ---- Auth / Adapter (Single-Tenant) ----
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
  await context.sendActivity('Sorry—something went wrong on my side.');
};

// ---- Call n8n ----
async function askN8n(userQuestion) {
  if (!N8N_URL) return "My n8n endpoint isn't configured.";
  try {
    const r = await fetch(N8N_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuestion }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('n8n HTTP error', r.status, text);
      return `I couldn't reach n8n (HTTP ${r.status}).`;
    }
    const data = await r.json().catch(() => ({}));
    console.log('n8n raw:', data);
    return data?.answer ?? 'I didn’t get a response from n8n.';
  } catch (e) {
    console.error('n8n call failed:', e?.message || e);
    return 'My n8n brain is unreachable right now.';
  }
}

// ---- Bot ----
class McwBot extends ActivityHandler {
  constructor() {
    super();
    this.onMessage(async (context, next) => {
      const text = (context.activity.text || '').trim();
      console.log('Incoming message:', text);
      const reply = await askN8n(text);
      await context.sendActivity(reply);
      await next();
    });
  }
}
const bot = new McwBot();

// Endpoint Bot Service calls
app.post('/api/messages', (req, res) =>
  adapter.process(req, res, (context) => bot.run(context))
);

app.listen(PORT, () =>
  console.log(`Boot: MCW Co-Pilot server listening on ${PORT}`)
);
