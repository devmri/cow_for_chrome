/*
  等价还原：assets/accessibility-tree.js-BYuwdz4C.js
  - 全局导出 window.__generateAccessibilityTree(filter?: 'all' | 'interactive')
  - 保留 WeakRef 元素映射（__claudeElementMap/__claudeRefCounter），保证引用 ID 稳定
  - 输出 pageContent（字符串）与 viewport（可视区尺寸）
*/

// 让本文件成为模块，以允许 global 扩展（修复 TS2669）
export {};

declare global {
  interface Window {
    __claudeElementMap?: Record<string, WeakRef<Element>>;
    __claudeRefCounter?: number;
    __generateAccessibilityTree?: (filter?: "all" | "interactive" | null) => {
      pageContent: string;
      viewport: { width: number; height: number };
    };
  }
}

// 初始化全局引用表
if (!window.__claudeElementMap) window.__claudeElementMap = {};
if (!window.__claudeRefCounter) window.__claudeRefCounter = 0;

// 重构前变量名：window.__generateAccessibilityTree
window.__generateAccessibilityTree = function generateAccessibilityTree(
  filter?: "all" | "interactive" | null
) {
  try {
    // 重构前变量名: n（推断角色）
    function inferRole(el: Element): string {
      const role = el.getAttribute("role");
      if (role) return role;
      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute("type") || "";
      const map: Record<string, string> = {
        a: "link",
        button: "button",
        input:
          type === "submit" || type === "button"
            ? "button"
            : type === "checkbox"
            ? "checkbox"
            : type === "radio"
            ? "radio"
            : type === "file"
            ? "button"
            : "textbox",
        select: "combobox",
        textarea: "textbox",
        h1: "heading",
        h2: "heading",
        h3: "heading",
        h4: "heading",
        h5: "heading",
        h6: "heading",
        img: "image",
        nav: "navigation",
        main: "main",
        header: "banner",
        footer: "contentinfo",
        section: "region",
        article: "article",
        aside: "complementary",
        form: "form",
        table: "table",
        ul: "list",
        ol: "list",
        li: "listitem",
        label: "label",
      };
      return map[tag] || "generic";
    }

    // 重构前变量名: a（推断 label/文本）
    function inferLabel(el: Element): string {
      const tag = el.tagName.toLowerCase();
      // select: 选中项文本
      if (tag === "select") {
        const sel = el as HTMLSelectElement;
        const opt =
          sel.querySelector("option[selected]") ||
          sel.options[sel.selectedIndex];
        if (opt && opt.textContent) return opt.textContent.trim();
      }
      const aria = el.getAttribute("aria-label");
      if (aria && aria.trim()) return aria.trim();
      const placeholder = el.getAttribute("placeholder");
      if (placeholder && placeholder.trim()) return placeholder.trim();
      const title = el.getAttribute("title");
      if (title && title.trim()) return title.trim();
      const alt = el.getAttribute("alt");
      if (alt && alt.trim()) return alt.trim();
      if ((el as HTMLElement).id) {
        const lab = document.querySelector(
          `label[for="${(el as HTMLElement).id}"]`
        );
        if (lab && lab.textContent && lab.textContent.trim())
          return lab.textContent.trim();
      }
      if (tag === "input") {
        const input = el as HTMLInputElement;
        const type = input.getAttribute("type") || "";
        const val = input.getAttribute("value");
        if (type === "submit" && val && val.trim()) return val.trim();
        if (input.value && input.value.length < 50 && input.value.trim())
          return input.value.trim();
      }
      if (["button", "a", "summary"].includes(tag)) {
        let text = "";
        for (let i = 0; i < el.childNodes.length; i++) {
          const n = el.childNodes[i];
          if (n.nodeType === Node.TEXT_NODE) text += n.textContent || "";
        }
        if (text.trim()) return text.trim();
      }
      if (tag.match(/^h[1-6]$/)) {
        const t = el.textContent;
        if (t && t.trim()) return t.trim().substring(0, 100);
      }
      if (tag === "img") {
        const src = el.getAttribute("src");
        if (src) {
          const file = src.split("/").pop()?.split("?")[0];
          return `Image: ${file}`;
        }
      }
      // 汇总直接子文本
      let agg = "";
      for (let i = 0; i < el.childNodes.length; i++) {
        const n = el.childNodes[i];
        if (n.nodeType === Node.TEXT_NODE) agg += n.textContent || "";
      }
      if (agg && agg.trim() && agg.trim().length >= 3) {
        const v = agg.trim();
        return v.length > 50 ? v.substring(0, 50) + "..." : v;
      }
      return "";
    }

    // 重构前变量名: o（可见性）
    function isVisible(el: Element): boolean {
      const cs = window.getComputedStyle(el as HTMLElement);
      if (
        cs.display === "none" ||
        cs.visibility === "hidden" ||
        cs.opacity === "0"
      )
        return false;
      return (
        (el as HTMLElement).offsetWidth > 0 &&
        (el as HTMLElement).offsetHeight > 0
      );
    }

    // 重构前变量名: l（可交互）
    function isInteractive(el: Element): boolean {
      const tag = el.tagName.toLowerCase();
      if (
        [
          "a",
          "button",
          "input",
          "select",
          "textarea",
          "details",
          "summary",
        ].includes(tag)
      )
        return true;
      if (el.getAttribute("onclick") != null) return true;
      if (el.getAttribute("tabindex") != null) return true;
      const role = el.getAttribute("role");
      if (role === "button" || role === "link") return true;
      if (el.getAttribute("contenteditable") === "true") return true;
      return false;
    }

    // 重构前变量名: u（结构性）
    function isStructural(el: Element): boolean {
      const tag = el.tagName.toLowerCase();
      if (
        [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "nav",
          "main",
          "header",
          "footer",
          "section",
          "article",
          "aside",
        ].includes(tag)
      )
        return true;
      return el.getAttribute("role") != null;
    }

    // 重构前变量名: c（表单/分组容器判断）
    function isFormishContainer(el: Element): boolean {
      const role = el.getAttribute("role") || "";
      const tag = el.tagName.toLowerCase();
      const cls = (el as HTMLElement).className || "";
      const id = (el as HTMLElement).id || "";
      return (
        role === "search" ||
        role === "form" ||
        role === "group" ||
        role === "toolbar" ||
        role === "navigation" ||
        tag === "form" ||
        tag === "fieldset" ||
        tag === "nav" ||
        id.includes("search") ||
        cls.includes("search") ||
        id.includes("form") ||
        cls.includes("form") ||
        id.includes("menu") ||
        cls.includes("menu") ||
        id.includes("nav") ||
        cls.includes("nav")
      );
    }

    // 重构前变量名: d（是否应纳入）
    function shouldInclude(
      el: Element,
      cfg: { filter?: "all" | "interactive" }
    ): boolean {
      const tag = el.tagName.toLowerCase();
      // 排除非文档元素
      if (
        ["script", "style", "meta", "link", "title", "noscript"].includes(tag)
      )
        return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      if (!isVisible(el)) return false;
      // 视口过滤（非 all 时要求与视口相交）
      if ((cfg.filter as any) !== "all") {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (
          !(
            r.top < window.innerHeight &&
            r.bottom > 0 &&
            r.left < window.innerWidth &&
            r.right > 0
          )
        )
          return false;
      }
      if (cfg.filter === "interactive") return isInteractive(el);
      if (isInteractive(el)) return true;
      if (isStructural(el)) return true;
      if (inferLabel(el).length > 0) return true;
      if (inferRole(el) === "generic" && (tag === "div" || tag === "span")) {
        const id = (el as HTMLElement).id || "";
        const cls = (el as HTMLElement).className || "";
        const s = inferLabel(el);
        if (s && s.length >= 3) return true;
        const hints = [
          "search",
          "dropdown",
          "menu",
          "modal",
          "dialog",
          "popup",
          "toolbar",
          "sidebar",
          "content",
          "text",
        ];
        if (hints.some((h) => id.includes(h) || cls.includes(h))) return true;
        return false;
      }
      return isFormishContainer(el);
    }

    // 重构前变量名: f（遍历）
    function traverse(
      el: Element,
      depth: number,
      cfg: { filter?: "all" | "interactive" },
      out: string[]
    ): void {
      if (depth > 15 || !el || !(el as any).tagName) return;
      const include = shouldInclude(el, cfg) || depth === 0;
      if (include) {
        const role = inferRole(el);
        let label = inferLabel(el);
        let refId: string | null = null;
        // 复用已有 WeakRef 标识
        for (const k in window.__claudeElementMap!) {
          if (window.__claudeElementMap![k].deref() === el) {
            refId = k;
            break;
          }
        }
        if (!refId) {
          refId = `ref_${++window.__claudeRefCounter!}`;
          window.__claudeElementMap![refId] = new WeakRef(el);
        }
        const rect = (el as HTMLElement).getBoundingClientRect();
        const cx = Math.round(rect.left + rect.width / 2);
        const cy = Math.round(rect.top + rect.height / 2);
        let line = `${"  ".repeat(depth)}- ${role}`;
        if (label) {
          label = label.replace(/\s+/g, " ").substring(0, 100);
          line += ` "${label.replace(/"/g, '\\"')}"`;
        }
        line += ` [ref=${refId}] (x=${cx},y=${cy})`;
        if ((el as HTMLElement).id) line += ` id="${(el as HTMLElement).id}"`;
        const href = el.getAttribute("href");
        if (href) line += ` href="${href}"`;
        const type = el.getAttribute("type");
        if (type) line += ` type="${type}"`;
        const placeholder = el.getAttribute("placeholder");
        if (placeholder) line += ` placeholder="${placeholder}"`;
        out.push(line);
      }
      if ((el as HTMLElement).children && depth < 15) {
        const children = (el as HTMLElement).children;
        for (let i = 0; i < children.length; i++) {
          traverse(children[i], include ? depth + 1 : depth, cfg, out);
        }
      }
    }

    const out: string[] = [];
    const cfg: any = { filter };
    if (document.body) traverse(document.body, 0, cfg, out);
    // 清理已失效的 WeakRef
    for (const k in window.__claudeElementMap!) {
      if (!window.__claudeElementMap![k].deref())
        delete window.__claudeElementMap![k];
    }
    // 产物中的过滤：去除仅为 "- generic [ref=ref_x]" 的行
    const pageContent = out
      .filter((line) => !/^\s*- generic \[ref=ref_\d+\]$/.test(line))
      .join("\n");
    return {
      pageContent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  } catch (err: any) {
    throw new Error(
      "Error generating accessibility tree: " +
        (err?.message || "Unknown error")
    );
  }
};
