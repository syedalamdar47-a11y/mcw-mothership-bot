async function askN8n(userQuestion) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return "My n8n endpoint isn't configured.";

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuestion })
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('n8n HTTP error', r.status, text);
      return `I couldn't reach n8n (HTTP ${r.status}).`;
    }

    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await r.json().catch(() => ({}));
      return (data && typeof data.answer === 'string')
        ? data.answer
        : "I didn’t get a response from n8n.";
    } else {
      // Text fallback
      const text = await r.text();
      return text || "I didn’t get a response from n8n.";
    }
  } catch (err) {
    console.error('n8n call failed:', err?.message || err);
    return 'My n8n brain is unreachable right now.';
  }
}
