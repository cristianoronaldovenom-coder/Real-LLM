import "dotenv/config";
import app from "./app.js";
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
    console.log(`\n🚀  LLM Studio server running at http://localhost:${port}`);
    console.log(`   API: http://localhost:${port}/api/health`);
    const hasKey = Boolean(process.env.OPENROUTER_API_KEY);
    if (hasKey) {
        console.log("   ✅  OPENROUTER_API_KEY detected from environment.");
    }
    else {
        console.log("   ⚠️   No OPENROUTER_API_KEY set — add it via the Settings page in the UI.");
    }
    console.log();
});
