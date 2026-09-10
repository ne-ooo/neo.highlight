import { createJavaScriptSessionHandler } from "../../dist/experimental/index.js";
const handler = createJavaScriptSessionHandler();
self.addEventListener("message", event => self.postMessage(handler.handle(event.data)));
