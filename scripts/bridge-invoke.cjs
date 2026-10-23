// Read authority privately; command arguments and output contain no bearer.
const { readSession } = require('./bridge-session.cjs');
async function main() {
  const session = readSession();
  const cmd = process.argv[2] || 'engine_is_running';
  const args = JSON.parse(process.argv[3] || '{}');
  const response = await fetch(`${session.bridgeUrl}/api/invoke`, { method: 'POST',
    headers: { Authorization: `Bearer ${session.bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, args }) });
  if (!response.ok) throw new Error(`Bridge refused request (${response.status}); reopen the private bootstrap`);
  console.log(await response.text());
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
