"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// ponytail: react-markdown + remark-gfm (tables/strikethrough/autolinks).
// No raw-HTML plugin = XSS-safe. Tailwind classes per element since there's
// no @tailwindcss/typography.
export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="text-sm leading-snug [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ className, ...p }) => (
            <a
              {...p}
              target="_blank"
              rel="noreferrer"
              className={cn("underline underline-offset-2", className)}
            />
          ),
          ul: ({ className, ...p }) => (
            <ul {...p} className={cn("my-1 list-disc pl-4", className)} />
          ),
          ol: ({ className, ...p }) => (
            <ol {...p} className={cn("my-1 list-decimal pl-4", className)} />
          ),
          code: ({ className, ...p }) => (
            <code
              {...p}
              className={cn(
                "rounded bg-black/10 px-1 py-0.5 text-[0.85em] dark:bg-white/10",
                className,
              )}
            />
          ),
          pre: ({ className, ...p }) => (
            <pre
              {...p}
              className={cn(
                "my-1 overflow-x-auto rounded bg-black/10 p-2 text-[0.85em] dark:bg-white/10",
                className,
              )}
            />
          ),
          table: ({ className, ...p }) => (
            <div className="my-1 overflow-x-auto">
              <table
                {...p}
                className={cn("w-full border-collapse text-[0.85em]", className)}
              />
            </div>
          ),
          th: ({ className, ...p }) => (
            <th
              {...p}
              className={cn(
                "border border-current/20 px-2 py-1 text-left font-medium",
                className,
              )}
            />
          ),
          td: ({ className, ...p }) => (
            <td
              {...p}
              className={cn("border border-current/20 px-2 py-1 align-top", className)}
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
