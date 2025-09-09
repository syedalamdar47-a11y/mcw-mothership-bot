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
