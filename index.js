import 'dotenv/config';
import express from 'express';
import { BotFrameworkAdapter, ActivityHandler } from 'botbuilder';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (_, res) => res.status(200).send('ok'));

const adapter = new BotFrameworkAdapter({
  appId: process.env.MicrosoftAppId,
  appPassword: process.env.MicrosoftAppPassword
});

class McwBot extends ActivityHandler {
  constructor() {
    super();
    this.onMessage(async (context, next) => {
      const text = (context.activity.text || '').trim().toLowerCase();

      if (text === 'hi' || text === 'hello') {
        await context.sendActivity("Hello! I’m your MCW Co-Pilot. Ask me things like:\n• 'DTSP utilization this week?'\n• 'Why were Tampa late-cancels high?'");
      } else if (text === 'help') {
        await context.sendActivity("I can analyze your data, send weekly snapshots, and create Trello tasks. Try: 'Weekend snapshot' or 'Top 3 under-utilized clinicians'.");
      } else {
        try {
          const resp = await axios.post(process.env.N8N_WEBHOOK_URL, { userQuestion: context.activity.text });
          await context.sendActivity(resp?.data?.answer || JSON.stringify(resp.data));
        } catch (err) {
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

app.listen(PORT, () => console.log(`Bot listening on ${PORT}`));
