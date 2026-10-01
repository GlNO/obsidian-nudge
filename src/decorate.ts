import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType
} from "@codemirror/view";

import {moment} from "obsidian";
// group 1 = the whitespace before the token, group 2 = the token itself
const TOKEN_RE =
  /(^|\s)(@\d{4}-\d{1,2}-\d{1,2}(?:\s+\d{1,2}:\d{2})?|done:\d{4}-\d{1,2}-\d{1,2})/g;

const mark = Decoration.mark({ class: "nudge-token" });


class DoneWidget extends WidgetType {
  constructor(private label: string) { super(); }
  eq(other: DoneWidget) { return other.label === this.label; }
  toDOM() {
    const span = document.createElement("span");
    span.className = "nudge-done";
    span.textContent = `✓ ${this.label}`;
    return span;
  }
}



function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);

      TOKEN_RE.lastIndex = 0;
      let m: RegExpExecArray | null;



      while ((m = TOKEN_RE.exec(line.text)) !== null) {
  if (!m[1] || !m[2]) continue;  // Add safety check
  const start = line.from + m.index + m[1].length;
  const end = start + m[2].length;

  const isDone = m[2].startsWith("done:");
  const cursorInside = view.state.selection.ranges.some(
    (r) => r.from <= end && r.to >= start
  );

  if (isDone && !cursorInside) {
    const label = moment(m[2].slice(5), "YYYY-M-D").format("MMM D");
    builder.add(start, end, Decoration.replace({ widget: new DoneWidget(label) }));
  } else {
    builder.add(start, end, mark);
  }
}

      pos = line.to + 1;
    }
  }

  return builder.finish();
}

export const nudgeDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = build(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);