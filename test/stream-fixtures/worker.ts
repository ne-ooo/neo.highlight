import { parentPort, workerData } from "node:worker_threads";
import { createJavaScriptSessionHandler } from "../../src/experimental/javascript-sessions";
const handler = createJavaScriptSessionHandler(workerData ?? {});
parentPort!.on("message", request => parentPort!.postMessage(handler.handle(request)));
