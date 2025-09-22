import React from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "../../../utils/classNames";

interface MarkdownRendererProps {
  text: string;
  variant?: "user" | "assistant";
}

export function MarkdownRenderer({
  text,
  variant = "assistant",
}: MarkdownRendererProps) {
  const isUser = variant === "user";

  return (
    <div
      className={cn(
        "text-text-100 leading-relaxed",
        isUser ? "font-base" : "font-claude-response-small",
      )}
      style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="font-claude-response-title text-lg mb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-claude-response-heading text-base mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-claude-response-subheading text-sm mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p
              className={cn(
                isUser ? "mb-2 font-base" : "mb-3 font-claude-response-small",
                "last:mb-0",
              )}
            >
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul
              className={cn(
                isUser ? "mb-2" : "mb-3",
                "last:mb-0 space-y-1 list-disc pl-5 font-claude-response-small",
              )}
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol
              className={cn(
                isUser ? "mb-2" : "mb-3",
                "last:mb-0 space-y-1 list-decimal pl-5 font-claude-response-small",
              )}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="font-claude-response-small">{children}</li>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            const codeString = String(children).replace(/\n$/, "");
            if (isInline) {
              return (
                <code className="bg-bg-200 px-1 py-0.5 rounded font-code-inline">
                  {codeString}
                </code>
              );
            }
            return (
              <pre
                className={cn(
                  `bg-bg-200 rounded-lg mb-3 last:mb-0 font-code whitespace-pre-wrap overflow-x-auto`,
                  isUser ? "p-2" : "p-3",
                )}
              >
                <code>{codeString}</code>
              </pre>
            );
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-border-300 pl-3 italic text-text-300 mb-3">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-main-100 underline hover:text-accent-main-200 transition-colors"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => (
            <del className="line-through text-text-400">{children}</del>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}