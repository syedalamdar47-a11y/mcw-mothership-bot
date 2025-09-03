import 'dotenv/config';
import express from 'express';
import axios from 'axios';
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

// ---- Bot ----
class McwBot extends ActivityHandler {
  constructor() {
    super();
    this.onMessage(async (context, next) => {
      const incoming = (context.activity.text || '').trim();
      console.log('Incoming message:', incoming);

      const text = incoming.toLowerCase();

      if (text === 'hi' || text === 'hello') {
        await context.sendActivity(
          "Hello! I’m your MCW Co-Pilot. Try:\n• 'DTSP utilization this week?'\n• 'Why were Tampa late-cancels high?'"
        );
      } else if (text === 'help') {
        await context.sendActivity(
          "I can analyze your data, send weekly snapshots, and create Trello tasks. Try: 'Weekend snapshot' or 'Top 3 under-utilized clinicians'."
        );
      } else {
        try {
          const resp = await axios.post(process.env.N8N_WEBHOOK_URL, {
            userQuestion: incoming,
          });
          await context.sendActivity(resp?.data?.answer || JSON.stringify(resp.data));
        } catch (err) {
          console.error('n8n call failed:', err?.message);
          await context.sendActivity("Sorry, I couldn’t reach the analyst service.");
        }
      }

      await next();
    });
  }
}
const bot = new McwBot();

// Endpoint Bot Service calls
app.post('/api/messages', (req, res) => {
  adapter.process(req, res, (context) => bot.run(context));
});

app.listen(PORT, () => console.log(`Boot: MCW Co-Pilot server listening on ${PORT}`));
