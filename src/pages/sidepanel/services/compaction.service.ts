// 原始类: ed

import Anthropic from "@anthropic-ai/sdk";
import { Message, AnthropicContent } from "../types";
import { tokenManager } from "./token.service";

type CreateMessageFn = (
  params: any,
) => Promise<Anthropic.Messages.Message>;

export interface CompactionResult {
  summaryMessage: Message;
  messagesAfterCompacting: Message[];
  preCompactTokenCount: number;
  postCompactTokenCount: number;
  tokensSaved: number;
}

export class CompactionService {
  private createMessage: CreateMessageFn;

  constructor(createMessage: CreateMessageFn) {
    this.createMessage = createMessage;
  }

  public async compactConversation(
    messages: Message[],
    continueAutomatically = false,
  ): Promise<CompactionResult> {
    if (messages.length === 0) {
      throw new Error("Not enough messages to compact");
    }

    const metrics = tokenManager.calculateMetricsFromMessages(messages);
    const preCompactTokenCount = metrics?.totalTokens || 0;

    const apiMessages = this.prepareMessagesForAPI(messages);

    apiMessages.push({
      role: "user",
      content:
        "Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.\nThis summary should be thorough in capturing browser automation details, page interactions, and navigation patterns that would be essential for continuing the automation work without losing context.\n\nBefore providing your final summary, wrap your analysis in <analysis> tags to organize your thoughts and ensure you've covered all necessary points. In your analysis process:\n\n1. Chronologically analyze each message and section of the conversation. For each section thoroughly identify:\n   - The user's explicit requests and intents\n   - Your approach to addressing the user's requests\n   - Key browser interactions and automation steps\n   - Specific details like:\n     - URLs visited\n     - Elements clicked or interacted with\n     - Form data entered\n     - Screenshots taken\n     - Navigation patterns\n   - Errors that you ran into and how you fixed them\n   - Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.\n\n2. Double-check for technical accuracy and completeness, addressing each required element thoroughly.\n\nYour summary should include the following sections:\n\n1. Primary Request and Intent: Capture all of the user's explicit requests and intents in detail\n2. Key Browser Context: Current page URL, domain, and any important page state\n3. Pages and Interactions: List all pages visited, elements interacted with, and actions taken\n4. Automation Steps: Document the sequence of browser automation steps performed\n5. Errors and fixes: List all errors that you ran into, and how you fixed them\n6. All user messages: List ALL user messages that are not tool results. These are critical for understanding the users' feedback and changing intent.\n7. Pending Tasks: Outline any pending tasks that you have explicitly been asked to work on.\n8. Current Work: Describe in detail precisely what was being worked on immediately before this summary request\n9. Optional Next Step: List the next step that you will take that is related to the most recent work you were doing\n\nHere's an example of how your output should be structured:\n\n<example>\n<analysis>\n[Your thought process, ensuring all points are covered thoroughly and accurately]\n</analysis>\n\n<summary>\n1. Primary Request and Intent:\n   [Detailed description]\n\n2. Key Browser Context:\n   - Current URL: [URL]\n   - Current Domain: [Domain]\n   - Page State: [Any important state information]\n\n3. Pages and Interactions:\n   - [Page 1]: [Actions taken]\n   - [Page 2]: [Actions taken]\n   - [...]\n\n4. Automation Steps:\n   - Step 1: [Description]\n   - Step 2: [Description]\n   - [...]\n\n5. Errors and fixes:\n   - [Detailed description of error 1]:\n     - [How you fixed the error]\n     - [User feedback on the error if any]\n   - [...]\n\n6. All user messages: \n   - [User message 1]\n   - [User message 2]\n   - [...]\n\n7. Pending Tasks:\n   - [Task 1]\n   - [Task 2]\n   - [...]\n\n8. Current Work:\n   [Precise description of current work]\n\n9. Optional Next Step:\n   [Optional Next step to take]\n\n</summary>\n</example>\n\nPlease provide your summary based on the conversation so far, following this structure and ensuring precision and thoroughness in your response.",
    });

    try {
      const response = await this.createMessage({
        max_tokens: 10000,
        messages: apiMessages,
        system: [
          {
            type: "text",
            text: "You are a helpful AI assistant tasked with summarizing browser automation conversations.",
          },
        ],
      });

      const summaryText = this.extractTextFromResponse(response);
      const formattedSummary = this.formatSummaryForUser(
        summaryText,
        continueAutomatically,
      );

      const summaryMessage: Message = {
        role: "user",
        content: formattedSummary,
        isCompactSummary: true,
      };

      const preservedContext = this.preserveRecentContext(messages);

      const messagesAfterCompacting: Message[] = [
        {
          role: "assistant",
          content: "This conversation has been summarized so we can keep going.",
          isCompactionMessage: true,
        },
        summaryMessage,
        ...preservedContext,
      ];

      const IMAGE_TOKEN_ESTIMATE = 1600;
      const postCompactTokenCount = Math.round(
        formattedSummary.length / 4 +
          preservedContext.reduce((acc, msg) => {
            let tokens = 0;
            if (typeof msg.content === "string") {
              tokens = msg.content.length / 4;
            } else if (Array.isArray(msg.content)) {
              tokens =
                msg.content.filter(
                  (c) => c.type === "image",
                ).length * IMAGE_TOKEN_ESTIMATE;
              tokens +=
                JSON.stringify(
                  msg.content.filter((c) => c.type !== "image"),
                ).length / 4;
            } else {
              tokens = JSON.stringify(msg.content).length / 4;
            }
            return acc + tokens;
          }, 0),
      );

      return {
        summaryMessage,
        messagesAfterCompacting,
        preCompactTokenCount,
        postCompactTokenCount,
        tokensSaved: Math.max(0, preCompactTokenCount - postCompactTokenCount),
      };
    } catch (error) {
      throw new Error(`Failed to compact conversation: ${error}`);
    }
  }

  private prepareMessagesForAPI(
    messages: Message[],
  ): Anthropic.Messages.MessageParam[] {
    const apiMessages: Anthropic.Messages.MessageParam[] = [];
    for (const msg of messages) {
      if (
        !msg.content ||
        (typeof msg.content === "string" && msg.content.trim() === "") ||
        (Array.isArray(msg.content) && msg.content.length === 0)
      ) {
        continue;
      }
      if (!("role" in msg) || (msg.role !== "user" && msg.role !== "assistant")) {
        continue;
      }
      apiMessages.push({
        role: msg.role,
        content: msg.content as Anthropic.Messages.MessageParam["content"],
      });
    }

    if (apiMessages.length > 0 && apiMessages[0].role === "assistant") {
      apiMessages.unshift({ role: "user", content: "Continue the conversation." });
    }

    return apiMessages;
  }

  private extractTextFromResponse(
    response: Anthropic.Messages.Message,
  ): string {
    if (!response.content || response.content.length === 0) {
      throw new Error("No content in API response");
    }
    const textBlocks = response.content.filter((c) => c.type === "text");
    if (textBlocks.length === 0) {
      throw new Error("No text content in API response");
    }
    return textBlocks.map((b) => b.text).join("\n");
  }

  private preserveRecentContext(messages: Message[]): Message[] {
    const preservedMessages: Message[] = [];
    let imageCount = 0;
    const maxImagesToPreserve = 3;

    for (let i = messages.length - 1; i >= 0 && imageCount < maxImagesToPreserve; i--) {
      const msg = messages[i];
      if (
        msg &&
        "role" in msg &&
        msg.role === "user" &&
        Array.isArray(msg.content)
      ) {
        if (
          msg.content.some(
            (c) => c.type === "image" && "source" in c && c.source,
          )
        ) {
          const imageContent = msg.content.filter(
            (c) =>
              c.type === "image" && "source" in c && c.source,
          );
          if (imageContent.length > 0) {
            preservedMessages.unshift({ ...msg, content: imageContent });
            imageCount++;
          }
        }
      }
    }
    return preservedMessages;
  }
  
  private parseAndCleanSummary(rawSummary: string): string {
    let cleaned = rawSummary;
    const analysisMatch = cleaned.match(/<analysis>([\s\S]*?)<\/analysis>/);
    if (analysisMatch) {
      const analysisContent = analysisMatch[1] || '';
      cleaned = cleaned.replace(/<analysis>[\s\S]*?<\/analysis>/, `Analysis:\n${analysisContent.trim()}`);
    }

    const summaryMatch = cleaned.match(/<summary>([\s\S]*?)<\/summary>/);
    if (summaryMatch) {
      const summaryContent = summaryMatch[1] || '';
      cleaned = cleaned.replace(/<summary>[\s\S]*?<\/summary>/, `Summary:\n${summaryContent.trim()}`);
    }
    
    cleaned = cleaned.replace(/\n\n+/g, '\n\n');
    return cleaned.trim();
  }
  
  private formatSummaryForUser(rawSummary: string, continueAutomatically: boolean): string {
    const cleanedSummary = this.parseAndCleanSummary(rawSummary);
    const preamble = `The conversation history was compressed to save context space. Here's a summary of what we discussed:\n\n${cleanedSummary}`;
    
    if (continueAutomatically) {
      return `${preamble}\n\nI'll continue from where we left off without asking additional questions.`;
    } else {
      return `${preamble}\n\nHow would you like to proceed?`;
    }
  }
}
