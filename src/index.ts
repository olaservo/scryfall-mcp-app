#!/usr/bin/env node

const args = process.argv.slice(2);
const transportName = args[0] || "stdio";

async function run() {
  try {
    switch (transportName) {
      case "stdio":
        await import("./transports/stdio.js");
        break;
      case "streamableHttp":
        await import("./transports/streamableHttp.js");
        break;
      default:
        console.error(`Unknown transport: ${transportName}`);
        console.log("Available transports: stdio, streamableHttp");
        process.exit(1);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

await run();
