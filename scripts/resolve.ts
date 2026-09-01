const [, , requestId, ...answerParts] = process.argv;
const answer = answerParts.join(" ");

if (!requestId || !answer) {
  console.error('Usage: npm run resolve -- <requestId> "<your answer>"');
  process.exit(1);
}

fetch(`http://localhost:8787/requests/${requestId}/resolve`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ answer }),
})
  .then(async (res) => {
    if (!res.ok) {
      console.error(`Failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    console.log(`Resolved ${requestId}. Switch back to the agent's terminal to watch it pick this up.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
