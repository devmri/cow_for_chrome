import { Tool } from "../../types";
import { computerTool } from "./computer.tool";
import { findTool } from "./find.tool";
import { formInputTool } from "./form_input.tool";
import { getPageTextTool } from "./get_page_text.tool";
import { navigateTool } from "./navigate.tool";
import { readPageTool } from "./read_page.tool";

export const ALL_TOOLS: Tool[] = [
  readPageTool,
  findTool,
  formInputTool,
  computerTool,
  navigateTool,
  getPageTextTool,
];

export const NON_INTERACTIVE_TOOLS: Tool[] = ALL_TOOLS.filter((tool) =>
  ["navigate"].includes(tool.name),
);

export {
  computerTool,
  findTool,
  formInputTool,
  getPageTextTool,
  navigateTool,
  readPageTool,
};