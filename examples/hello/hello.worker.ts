import { defineWorker } from "@oona/vlo";

export default defineWorker({
  "hello.greet": (input: { name: string }) => ({ greeting: `Hello, ${input.name}!` }),
});
