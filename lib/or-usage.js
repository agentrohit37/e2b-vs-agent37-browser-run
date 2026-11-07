// Prints OpenRouter key usage (USD) so LLM spend can be measured as a before/after difference.
const k = require('./keys').openrouter();
fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: 'Bearer ' + k } }).then(r => r.json()).then(j => console.log(JSON.stringify({ at: new Date().toISOString(), usage: j.data && j.data.usage, limit: j.data && j.data.limit, limit_remaining: j.data && j.data.limit_remaining })));
