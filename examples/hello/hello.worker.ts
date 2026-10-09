import { defineWorker } from "@vlo/sdk";

export default defineWorker({
  "hello.greet": (input: { name: string }) => ({ greeting: `Hello, ${input.name}!` }),
});
