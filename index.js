import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import botbuilderPkg from 'botbuilder'; // CJS -> import default then destructure
const { BotFrameworkAdapter, ActivityHandler } = botbuilderPkg;

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (_, res) => res.status(200).send('ok'));
app.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));

const adapter = new BotFrameworkAdapter({
  appId: process.env.MicrosoftAppId,
  appPassword: process.env.MicrosoftAppPassword,
});

adapter.onTurnError = async (context, err) => {
  console.error('Bot error:', err);
  await context.sendActivity('The bot hit an error.');
};

class McwBot extends ActivityHandler {
  constructor() {
    super();
    this.onMessage(async (context, next) => {
      const text = (context.activity.text || '').trim().toLowerCase();

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
          const resp = await axios.post(
            process.env.N8N_WEBHOOK_URL,
            { userQuestion: context.activity.text },
            { timeout: 15000 }
          );
          await context.sendActivity(resp?.data?.answer ?? JSON.stringify(resp.data));
        } catch (e) {
          console.error('n8n call failed:', e?.message);
          await context.sendActivity("Sorry, I couldn’t reach the analyst service.");
        }
      }
      await next();
    });
  }
}
const bot = new McwBot();

app.post('/api/messages', express.json(), (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    await bot.run(context);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Boot: MCW Co-Pilot server listening on ${PORT}`);
});
