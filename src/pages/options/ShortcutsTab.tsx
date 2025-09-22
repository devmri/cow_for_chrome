import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFeatureGate } from "@statsig/react-bindings";
import {
  Lightning,
  EnvelopeSimple,
  CalendarBlank,
  LinkedinLogo,
} from "@phosphor-icons/react";
import { Pencil, Trash2, MoreVertical } from "lucide-react";
import { SavedPrompt, SavedPromptsService } from "../../lib/savedPrompts";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Textarea } from "../../components/Textarea";
import { Modal, ModalFooter } from "../../components/Modal";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../components/DropdownMenu";
import { ToastContainer } from "../../components/ToastContainer";
import { SegmentedControl } from "../../components/SegmentedControl";

interface TemplatePrompt {
  prompt: string;
  command?: string;
}

interface TemplateGroup {
  category: "general" | "email" | "docs" | "calendar" | "linkedin";
  label: string;
  prompts: TemplatePrompt[];
}

const BROWSE_TEMPLATES: TemplateGroup[] = [
  {
    category: "general",
    label: "General",
    prompts: [
      {
        prompt:
          "Summarize this page and extract the key insights, main arguments, and important data points.",
        command: "summarize",
      },
      {
        prompt:
          "Research this topic by visiting multiple authoritative websites and gathering key information. Open each source in a new tab, read through the content, and summarize the main findings from each source.",
        command: "research",
      },
      {
        prompt:
          "Compare prices and features for this product across at least 5 different websites. Create a comparison table showing: price, shipping costs, delivery time, return policy, and any special features or bundles. Highlight the best overall value and explain why.",
        command: "compare-prices",
      },
      {
        prompt:
          "Fill out this form or application with the information I provide. Before submitting, show me a screenshot of the completed form for review. If there are multiple steps, take a screenshot at each step so I can verify the information is correct.",
        command: "fill-form",
      },
      {
        prompt:
          "Extract all the important data from this page (tables, lists, contact info, prices, etc.) and organize it in a clear, structured format that I can easily copy.",
        command: "extract",
      },
      {
        prompt:
          "Find and click through all the links on this page to discover what's available. Create a summary of what each major section or link leads to.",
        command: "explore",
      },
    ],
  },
  {
    category: "email",
    label: "Email",
    prompts: [
      {
        prompt:
          "Go through my recent emails and help me unsubscribe from promotional/marketing emails. \n\nFocus on: retail promotions, marketing newsletters, sales emails, and automated promotional content. DO NOT unsubscribe from: transactional emails (receipts, shipping notifications), account security emails, or emails that appear to be personal/conversational. \n\nStart with emails from the last 2 weeks. Before unsubscribing from anything, give me a full list of the different emails you plan to unsubscribe from so I can confirm you're identifying the right types of emails. When you do this, make sure to ask me if there's any of those emails you should not unsubscribe from.\n\nFor each promotional email you find: (1) Look for and click the native \"unsubscribe\" button from google (top of the email, next to sender email address); (2) Keep a running list of what you've unsubscribed from.",
        command: "unsubscribe",
      },
      {
        prompt:
          "Go through my email inbox and archive all emails where: (A) I don't need to take any actions; AND (B) where the email does not appear to be from an actual human (personal tone, specific to me, conversational).\n\nIf an email only meets one of those two criteria, don't archive it.\n\nEmails to archive covers things like general notifications, calendar invitations / acceptances, promotions etc.\n\nRemember – the archive button is the one that is second on the left. It has a down arrow sign within a folder. Make sure that you are not clicking the 'labels' button (second from the right, rectangular type of button that points right), and don't press \"move to\" as well (third from the right, folder icon with right arrow). DO NOT MARK AS SPAM (which is third button from left, the exclamation mark (\"report spam\" button).\n\nBefore you click to archive the first time, take a screenshot when you hover on the \"archive\" button to confirm that you are taking the action intended.\n\nAfter you click to archive, make sure to take a screenshot before taking any further actions so that you don't get lost.\n\nAlso archive any google automatic reminder emails for following up on emails I've sent in the past that haven't gotten a response.",
        command: "archive",
      },
      {
        prompt:
          "Go through my inbox and draft thoughtful responses to emails that require my attention. For each email that needs a response: \n\n1) Read the full context and any previous thread messages within that same email chain; (2) Draft a response that maintains my professional tone while being warm and helpful; (3) Save as a draft but DO NOT send. Once you've written the draft, Click on the \"back\" button in the top bar, which is the far left button and directly on left of the archive button, which takes you back to inbox and automatically saves the draft. Focus on emails from the last 3 days.\n\nOnly click into emails that you think need a response when looking at the sender and subject line – don't click into automated notifications, calendar invites etc.\n\nFor an email that needs a response, make sure you click in and expand each of the previous emails within the chain. You can see the collapsed preview state in the middle / top side of the email chain, with the number of how many previous emails are in the thread. Make sure to click into each one to get all the context, don't skip out on this.\n\nAfter you've drafted the email, click on the \"back to inbox\" button (left pointing arrow) that is the far left button on the top bar (the button is on the left of the archive button). This will take you back to inbox, and you can then go onto the next email.",
        command: "draft-responses",
      },
      {
        prompt:
          "Extract action items and deadlines from all unread emails and create a prioritized task list.",
        command: "actions",
      },
      {
        prompt:
          "Go through my sent emails from the last week and identify any that haven't received a response. Create a list of who I'm waiting to hear back from and what about.",
        command: "follow-ups",
      },
      {
        prompt:
          "Review my email drafts folder and help me finish or send any drafts that have been sitting there. Show me each draft and ask what action to take.",
        command: "review-drafts",
      },
    ],
  },
  {
    category: "docs",
    label: "Docs",
    prompts: [
      {
        prompt:
          "Create a comprehensive document from my outline, researching and writing each section with proper formatting.",
        command: "create-doc",
      },
      {
        prompt:
          "Review this document for clarity, grammar, structure, and factual accuracy, then implement improvements.",
        command: "review",
      },
      {
        prompt:
          "Generate an executive summary and key takeaways from this long document.",
        command: "summarize-doc",
      },
      {
        prompt:
          "Convert this document to different formats while preserving all formatting, images, and data.",
        command: "convert",
      },
      {
        prompt:
          "Merge multiple documents into one cohesive file, removing duplicates and organizing content logically.",
        command: "merge",
      },
      {
        prompt:
          "Create a presentation from this document with slides, speaker notes, and visual elements.",
        command: "present",
      },
    ],
  },
  {
    category: "calendar",
    label: "Calendar",
    prompts: [
      {
        prompt:
          "Find the optimal meeting time for all participants across different time zones and schedule it.",
        command: "schedule",
      },
      {
        prompt:
          "Analyze my calendar patterns and suggest ways to optimize for productivity and work-life balance.",
        command: "optimize",
      },
      {
        prompt:
          "Resolve all scheduling conflicts by proposing alternative times and notifying affected parties.",
        command: "conflicts",
      },
      {
        prompt:
          "Block focus time for deep work based on my priorities and energy patterns throughout the day.",
        command: "focus",
      },
      {
        prompt:
          "Plan a multi-day event with sessions, breaks, and logistics, sending invites to all participants.",
        command: "event",
      },
      {
        prompt:
          "Create recurring meetings with smart scheduling that avoids holidays and conflicts.",
        command: "recurring",
      },
    ],
  },
  {
    category: "linkedin",
    label: "LinkedIn",
    prompts: [
      {
        prompt:
          "Write an engaging LinkedIn post about this topic that will resonate with my professional network.",
        command: "post",
      },
      {
        prompt:
          "Optimize my entire LinkedIn profile with keywords, compelling descriptions, and strategic positioning.",
        command: "profile",
      },
      {
        prompt:
          "Identify and connect with relevant professionals in my industry with personalized messages.",
        command: "network",
      },
      {
        prompt:
          "Search for jobs matching my skills, apply with tailored resumes, and track application status.",
        command: "jobs",
      },
      {
        prompt:
          "Research this company's culture, recent news, and key employees to prepare for outreach or interviews.",
        command: "company",
      },
      {
        prompt:
          "Analyze my LinkedIn analytics and suggest content strategies to increase engagement and reach.",
        command: "analytics",
      },
    ],
  },
];

function useToast() {
  return useCallback((message: string, type: "success" | "error" = "success") => {
    window.showToast?.(message, type);
  }, []);
}

function iconForCategory(category: TemplateGroup["category"]) {
  const common = { size: 18, weight: "light" as const, className: "text-text-300" };
  switch (category) {
    case "general":
      return <Lightning {...common} />;
    case "email":
      return <EnvelopeSimple {...common} />;
    case "docs":
      return <CalendarBlank {...common} />;
    case "calendar":
      return <CalendarBlank {...common} />;
    case "linkedin":
      return <LinkedinLogo {...common} />;
    default:
      return <Lightning {...common} />;
  }
}

interface ShortcutCardProps {
  prompt: SavedPrompt;
  onEdit: () => void;
  onDelete: () => void;
}

// 卡片（重构前变量名: Ja）
function ShortcutCard({ prompt, onEdit, onDelete }: ShortcutCardProps) {
  return (
    <div className="relative group bg-bg-000 border-[0.5px] border-border-300 rounded-2xl p-4 hover:border-border-200 transition-all shadow-[0_2px_4px_0_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_0_rgba(0,0,0,0.08)] w-full">
      <div className="flex items-start justify-between gap-2 mb-2">
        <button onClick={onEdit} className="flex-1 min-w-0 text-left">
          {prompt.command && (
            <div className="font-large-bold text-text-200 relative overflow-hidden">
              <div className="whitespace-nowrap">
                <span className="text-text-500/50 font-mono">/</span>
                <span className="ml-0.5">{prompt.command}</span>
              </div>
              <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg-000 to-transparent pointer-events-none" />
            </div>
          )}
        </button>
        <DropdownMenu
          trigger={
            <button className="p-1 hover:bg-bg-200 rounded transition-colors">
              <MoreVertical size={16} className="text-text-300" />
            </button>
          }
          unstyledTrigger
        >
          <DropdownMenuItem
            icon={<Pencil size={14} />}
            onSelect={(event) => {
              event.preventDefault();
              onEdit();
            }}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<Trash2 size={14} />}
            danger
            onSelect={(event) => {
              event.preventDefault();
              onDelete();
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
      <button
        onClick={onEdit}
        className="bg-bg-100 rounded-lg p-3 w-full text-left cursor-pointer hover:bg-bg-200 transition-colors"
      >
        <div className="text-sm text-text-300 h-24 overflow-y-auto whitespace-pre-wrap">
          {prompt.prompt}
        </div>
      </button>
    </div>
  );
}

interface TemplateCardProps {
  template: TemplatePrompt;
  onUse: () => void;
}

// 模板卡片（重构前变量名: Xa）
function TemplateCard({ template, onUse }: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={onUse}
      className="relative group bg-bg-000 border-[0.5px] border-border-300 rounded-2xl p-4 hover:border-border-200 transition-all shadow-[0_2px_4px_0_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_0_rgba(0,0,0,0.08)] w-full text-left cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {template.command && (
            <div className="font-large-bold text-text-200 relative overflow-hidden">
              <div className="whitespace-nowrap">
                <span className="text-text-500/50 font-mono">/</span>
                <span className="ml-0.5">{template.command}</span>
              </div>
              <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg-000 to-transparent pointer-events-none" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onUse();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-text-300 hover:bg-bg-100 rounded-lg transition-all border-[0.5px] border-border-300"
        >
          <Lightning size={16} weight="bold" />
        </button>
      </div>
      <div className="bg-bg-100 rounded-lg p-3">
        <div className="text-sm text-text-300 h-24 overflow-y-auto whitespace-pre-wrap">
          {template.prompt}
        </div>
      </div>
    </button>
  );
}

interface ShortcutModalProps {
  prompt: SavedPrompt | (TemplatePrompt & { id: string });
  onClose: () => void;
  onSaved: (updated: boolean) => void;
}

// 编辑 / 新建弹窗（重构前变量名: Qa）
function ShortcutModal({ prompt, onClose, onSaved }: ShortcutModalProps) {
  const [command, setCommand] = useState(prompt.command ?? "");
  const [text, setText] = useState(prompt.prompt);
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isExisting = Boolean(prompt.id && prompt.id !== "");

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      event.preventDefault();
      handleSave();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  const handleSave = async () => {
    setSubmitted(true);
    if (!command.trim() || !text.trim()) return;
    try {
      if (isExisting) {
        await SavedPromptsService.updatePrompt(prompt.id, {
          command: command.trim(),
          prompt: text.trim(),
        });
      } else {
        await SavedPromptsService.savePrompt({
          command: command.trim(),
          prompt: text.trim(),
        });
      }
      onSaved(isExisting);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Failed to save");
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isExisting ? "Edit shortcut" : "Create shortcut"}
    >
      <div className="space-y-4">
        <Input
          ref={inputRef}
          label="Name"
          type="text"
          value={command}
          onChange={(event) => {
            const value = event.target.value
              .replace(/\s/g, "-")
              .replace(/[^a-zA-Z0-9-_]/g, "");
            setCommand(value);
            if (error && !error.includes("already in use")) setError(undefined);
          }}
          prepend={<span className="text-text-300">/</span>}
          placeholder="e.g., summarize"
          error={
            submitted && !command.trim()
              ? "Name is required"
              : error && error.includes("already in use")
              ? error
              : undefined
          }
        />
        <Textarea
          label="Prompt"
          required
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="min-h-32 max-h-64 overflow-y-auto"
          placeholder="Enter your prompt text..."
          error={submitted && !text.trim() ? "Prompt is required" : undefined}
        />
        {error && !error.includes("already in use") && (
          <div className="text-danger-000 text-sm">{error}</div>
        )}
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>{isExisting ? "Save changes" : "Create shortcut"}</Button>
      </ModalFooter>
    </Modal>
  );
}

// 主组件（重构前变量名: qa）
export function ShortcutsTab() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<SavedPrompt | (TemplatePrompt & { id: string }) | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [segment, setSegment] = useState<"my-tasks" | "browse">("my-tasks");
  const showToast = useToast();
  const browseGate = useFeatureGate("crochet_browse_shortcuts").value;

  const loadPrompts = useCallback(async () => {
    const all = await SavedPromptsService.getAllPrompts();
    setPrompts([...all].sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const handleCreate = () => {
    setSelectedPrompt({ id: "", prompt: "", command: "" });
    setModalVisible(true);
  };

  const handleEdit = (prompt: SavedPrompt | (TemplatePrompt & { id: string })) => {
    setSelectedPrompt(prompt);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prompt?")) return;
    await SavedPromptsService.deletePrompt(id);
    await loadPrompts();
    showToast("Shortcut deleted successfully");
  };

  const emptyState = prompts.length === 0;

  const groupedTemplates = useMemo(() => BROWSE_TEMPLATES, []);

  return (
    <Fragment>
      <ToastContainer />
      <div className="space-y-6">
        <div className="bg-bg-100 border-[0.5px] border-border-300 rounded-xl px-6 pt-6 pb-6 md:px-8 md:pt-8 md:pb-8">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-text-100 font-xl-bold">Shortcuts</h3>
              <p className="text-text-300 font-base mt-1">
                Create shortcuts to use in chat or schedule for tasks you repeat
              </p>
            </div>
            <Button
              size="sm"
              className="ml-2"
              prepend={<Lightning size={16} weight="bold" />}
              onClick={handleCreate}
            >
              Create shortcut
            </Button>
          </div>

          {browseGate && (
            <div className="mt-6">
              <SegmentedControl
                value={segment}
                onSelect={(key) => setSegment(key as typeof segment)}
                options={[
                  { key: "my-tasks", label: "My shortcuts" },
                  { key: "browse", label: "Browse" },
                ]}
              />
            </div>
          )}

          {segment === "browse" && browseGate ? (
            <div className="space-y-8 mt-6">
              {groupedTemplates.map((group) => (
                <div key={group.category}>
                  <div className="flex items-center gap-2 mb-4">
                    {iconForCategory(group.category)}
                    <h4 className="text-text-200 font-base-bold">{group.label}</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.prompts.map((template, index) => (
                      <TemplateCard
                        key={`${group.category}-${index}`}
                        template={template}
                        onUse={() => {
                          handleEdit({ id: "", ...template });
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {prompts.map((prompt) => (
                <ShortcutCard
                  key={prompt.id}
                  prompt={prompt}
                  onEdit={() => handleEdit(prompt)}
                  onDelete={() => handleDelete(prompt.id)}
                />
              ))}
              {emptyState && (
                <div className="col-span-full">
                  <div className="bg-bg-000 border-[0.5px] border-border-300 rounded-2xl p-6 text-center flex flex-col items-center gap-3">
                    <img
                      src="data:image/svg+xml,%3csvg%20width='80'%20height='69'%20viewBox='0%200%2080%2069'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20filter='url(%23filter0_d_5136_3558)'%3e%3cpath%20d='M5%2019C5%2013.3995%205%2010.5992%206.08993%208.46009C7.04867%206.57847%208.57847%205.04867%2010.4601%204.08993C12.5992%203%2015.3995%203%2021%203H59.0648C64.6654%203%2067.4656%203%2069.6047%204.08993C71.4864%205.04867%2073.0162%206.57847%2073.9749%208.46009C75.0648%2010.5992%2075.0648%2013.3995%2075.0648%2019V46C75.0648%2051.6005%2075.0648%2054.4008%2073.9749%2056.5399C73.0162%2058.4215%2071.4864%2059.9513%2069.6047%2060.9101C67.4656%2062%2064.6654%2062%2059.0648%2062H21C15.3995%2062%2012.5992%2062%2010.4601%2060.9101C8.57847%2059.9513%207.04867%2058.4215%206.08993%2056.5399C5%2054.4008%205%2051.6005%205%2046V19Z'%20fill='%2330302E'%20shape-rendering='crispEdges'/%3e%3cpath%20d='M59.0645%202.75C61.8606%202.75%2063.9733%202.74945%2065.6533%202.88672C67.3361%203.02421%2068.6072%203.30141%2069.7178%203.86719C71.6464%204.84987%2073.2146%206.41806%2074.1973%208.34668C74.7632%209.45736%2075.0402%2010.7291%2075.1777%2012.4121C75.315%2014.0921%2075.3145%2016.2041%2075.3145%2019V46C75.3145%2048.7959%2075.315%2050.9079%2075.1777%2052.5879C75.0402%2054.2709%2074.7632%2055.5426%2074.1973%2056.6533C73.2146%2058.5819%2071.6464%2060.1501%2069.7178%2061.1328C68.6072%2061.6986%2067.3361%2061.9758%2065.6533%2062.1133C63.9733%2062.2505%2061.8606%2062.25%2059.0645%2062.25H21C18.2041%2062.25%2016.0921%2062.2505%2014.4121%2062.1133C12.7292%2061.9758%2011.4573%2061.6987%2010.3467%2061.1328C8.41802%2060.1501%206.84989%2058.582%205.86719%2056.6533C5.30129%2055.5427%205.02422%2054.2708%204.88672%2052.5879C4.74949%2050.9079%204.75%2048.7959%204.75%2046V19C4.75%2016.2041%204.74949%2014.0921%204.88672%2012.4121C5.02422%2010.7292%205.30129%209.45734%205.86719%208.34668C6.84989%206.41802%208.41802%204.84989%2010.3467%203.86719C11.4573%203.30129%2012.7292%203.02422%2014.4121%202.88672C16.0921%202.74949%2018.2041%202.75%2021%202.75H59.0645Z'%20stroke='%23DEDCD1'%20stroke-opacity='0.3'%20stroke-width='0.5'%20shape-rendering='crispEdges'/%3e%3cpath%20d='M14.4844%2019.2899L16.6109%2012.6917L17.5147%2012.7101L15.3882%2019.3083L14.4844%2019.2899Z'%20fill='%23C2C0B6'/%3e%3crect%20x='22.9209'%20y='15'%20width='32.0373'%20height='2'%20rx='1'%20fill='%23DEDCD1'%20fill-opacity='0.15'/%3e%3cpath%20d='M14.4844%2030.2899L16.6109%2023.6917L17.5147%2023.7101L15.3882%2030.3083L14.4844%2030.2899Z'%20fill='%23C2C0B6'/%3e%3crect%20x='22.9209'%20y='26'%20width='44.1435'%20height='2'%20rx='1'%20fill='%23DEDCD1'%20fill-opacity='0.15'/%3e%3cpath%20d='M14.4844%2041.2899L16.6109%2034.6917L17.5147%2034.7101L15.3882%2041.3083L14.4844%2041.2899Z'%20fill='%23C2C0B6'/%3e%3crect%20x='22.9209'%20y='37'%20width='38.9607'%20height='2'%20rx='1'%20fill='%23DEDCD1'%20fill-opacity='0.15'/%3e%3cpath%20d='M14.4844%2052.2899L16.6109%2045.6917L17.5147%2045.7101L15.3882%2052.3083L14.4844%2052.2899Z'%20fill='%23C2C0B6'/%3e%3crect%20x='22.9209'%20y='48'%20width='34.6778'%20height='2'%20rx='1'%20fill='%23DEDCD1'%20fill-opacity='0.15'/%3e%3c/g%3e%3cdefs%3e%3cfilter%20id='filter0_d_5136_3558'%20x='0.5'%20y='0.5'%20width='79.0645'%20height='68'%20filterUnits='userSpaceOnUse'%20color-interpolation-filters='sRGB'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeColorMatrix%20in='SourceAlpha'%20type='matrix'%20values='0%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%20127%200'%20result='hardAlpha'/%3e%3cfeOffset%20dy='2'/%3e%3cfeGaussianBlur%20stdDeviation='2'/%3e%3cfeComposite%20in2='hardAlpha'%20operator='out'/%3e%3cfeColorMatrix%20type='matrix'%20values='0%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200.05%200'/%3e%3cfeBlend%20mode='normal'%20in2='BackgroundImageFix'%20result='effect1_dropShadow_5136_3558'/%3e%3cfeBlend%20mode='normal'%20in='SourceGraphic'%20in2='effect1_dropShadow_5136_3558'%20result='shape'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e"
                      alt="Tasks illustration"
                      className="w-24 h-24 mx-auto mb-1"
                    />
                    <p className="font-large-bold text-text-100">No shortcuts yet</p>
                    <p className="text-text-300 max-w-[200px] mx-auto">
                      {browseGate ? (
                        <Fragment>
                          Create your first shortcut or{" "}
                          <button
                            onClick={() => setSegment("browse")}
                            className="text-text-200 underline hover:text-text-100 transition-colors cursor-pointer"
                          >
                            explore examples
                          </button>{" "}
                          to get started
                        </Fragment>
                      ) : (
                        "Create your first shortcut to get started"
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {modalVisible && selectedPrompt && (
          <ShortcutModal
            prompt={selectedPrompt}
            onClose={() => {
              setModalVisible(false);
              setSelectedPrompt(null);
            }}
            onSaved={(updated) => {
              setModalVisible(false);
              setSelectedPrompt(null);
              loadPrompts();
              showToast(updated ? "Shortcut updated successfully" : "Shortcut added successfully");
            }}
          />
        )}
      </div>
    </Fragment>
  );
}
