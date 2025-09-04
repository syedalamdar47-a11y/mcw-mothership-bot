// index.js

// --- env & libs -------------------------------------------------------------
import 'dotenv/config';
import express from 'express';
import {
  ActivityHandler,
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} from 'botbuilder';

// --- n8n wiring -------------------------------------------------------------
const N8N_URL = process.env.N8N_WEBHOOK_URL;
console.log('Using N8N_WEBHOOK_URL:', N8N_URL || '(not set)');

// Node 20+ has global fetch. If you run an older Node, add:  import fetch from 'node-fetch';
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
    return (data && data.answer) ? data.answer : "I didn’t get a response from n8n.";
  } catch (err) {
    console.error('n8n call failed:', err?.message || err);
    return 'My n8n brain is unreachable right now.';
  }
}

// --- express app & health ---------------------------------------------------
const app = express();
const PORT = process.env.PORT || process.env.WEBSITES_PORT || 8080;
app.use(express.json());

app.get('/', (_, res) => res.status(200).send('ok'));
app.get('/healthz', (_, res) => res.status(200).send('healthy'));

// --- Bot Framework auth/adapter (single tenant) -----------------------------
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

// --- The bot ---------------------------------------------------------------
class McwBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const incoming = (context.activity.text || '').trim();
      console.log('Incoming message:', incoming);

      if (!incoming) {
        await context.sendActivity("Hi! Ask me anything to get started.");
        await next(); return;
      }

      const lower = incoming.toLowerCase();

      if (lower === 'hi' || lower === 'hello') {
        await context.sendActivity(
          "Hello! I’m your MCW Co-Pilot. Try:\n• 'DTSP utilization this week?'\n• 'Why were Tampa late-cancels high?'"
        );
        await next(); return;
      }

      if (lower === 'help') {
        await context.sendActivity(
          "I can analyze your data, send weekly snapshots, and create Trello tasks. Try: 'Weekend snapshot' or 'Top 3 under-utilized clinicians'."
        );
        await next(); return;
      }

      // Everything else goes to n8n
      const answer = await askN8n(incoming);
      await context.sendActivity(answer);

      await next();
    });
  }
}

const bot = new McwBot();

// Endpoint Bot Service calls
app.post('/api/messages', (req, res) => {
  adapter.process(req, res, (context) => bot.run(context));
});

// Start server
app.listen(PORT, () => console.log(`Boot: MCW Co-Pilot server listening on ${PORT}`));
