import BuiltinTelegramPlugin from "@cognisphere-sh/cognisphere-harness/src/plugins/telegram/index.ts";

/**
 * User-scope override of the builtin `telegram` plugin (same id shadows it).
 *
 * Adds one config option, `threadId`: when set, every inbound telegram
 * notification is enqueued with `threadIdOverride = threadId`, pinning all
 * telegram traffic to a single thread (e.g. `"admin"`) instead of the
 * agent's threadIdStrategy-derived `telegram:<chatId>` threads.
 *
 * The `seed/` here is a copy of the builtin's (seed is provisioned from the
 * shadowing plugin's dir) — re-sync it after upgrading the harness package.
 */

type Ctx = Parameters<BuiltinTelegramPlugin["start"]>[0];

export default class TelegramPlugin extends BuiltinTelegramPlugin {
  constructor() {
    super();
    const schema = this.manifest.configSchema as {
      properties: Record<string, unknown>;
    };
    schema.properties.threadId = {
      type: "string",
      description:
        "Pin all inbound telegram notifications to this thread id (sent as threadIdOverride). Unset = per-channel threads.",
    };
  }

  async start(ctx: Ctx): Promise<void> {
    const threadId = (ctx.config as { threadId?: string } | undefined)
      ?.threadId;
    if (threadId) {
      const notify = ctx.notify;
      ctx = {
        ...ctx,
        notify: (name, payload) =>
          notify(name, {
            ...payload,
            threadIdOverride: payload.threadIdOverride ?? threadId,
          }),
      };
    }
    await super.start(ctx);
  }
}
