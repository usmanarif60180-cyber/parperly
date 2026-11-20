import { processPdf } from "./index";
self.onmessage = async (e: MessageEvent) => {
  try {
    const outputs = await processPdf(
      e.data.tool,
      e.data.files,
      e.data.settings,
      (stage) => self.postMessage({ stage }),
    );
    self.postMessage({ outputs });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Processing failed.",
    });
  }
};
