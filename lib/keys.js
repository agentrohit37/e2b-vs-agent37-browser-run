// Reads API keys from environment variables. A .env file in the repo root is loaded first if it exists
// (variables already set in the shell win). Keys are never printed.
//   AGENT37_API_KEY     Agent37 API key
//   E2B_API_KEY         E2B API key
//   OPENROUTER_API_KEY  OpenRouter key (Part B only)
const fs = require('fs'), path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Set it in your shell or in .env (see .env.example).`);
  return v;
}

module.exports = {
  agent37: () => need('AGENT37_API_KEY'),
  e2b: () => need('E2B_API_KEY'),
  openrouter: () => need('OPENROUTER_API_KEY'),
  has: (name) => !!process.env[name],
};
