import { logger, task } from "@trigger.dev/sdk/v3"

export const helloWorldTask = task({
  id: "hello-world",
  maxDuration: 300,
  run: async (payload: { name: string }) => {
    logger.log("Hello, world!", { name: payload.name })

    return {
      message: `Hello, ${payload.name}!`,
    }
  },
})
