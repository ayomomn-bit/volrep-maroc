import { Fragment, type ReactNode } from "react";

// Renders the emphasis notation used in "Page produit" text fields:
//   **bold**  -> <strong>
//   *italic*  -> <em>   (the serif accent face, via product-landing.css)
//   \n        -> <br>
//
// This is NOT markdown. It exists only to reproduce, 1:1, the <strong> /
// <em> / <br> spans the original hardcoded ProductLanding JSX contained.
// The migrated content never contains a literal "*".

const INLINE = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  INLINE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyBase}-s${i}`}>{match[1]}</strong>);
    } else {
      nodes.push(<em key={`${keyBase}-e${i}`}>{match[2]}</em>);
    }
    last = match.index + match[0].length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderRich(text: string, keyBase = "rt"): ReactNode {
  if (!text.includes("\n")) return renderInline(text, keyBase);
  return text.split("\n").map((line, idx) => (
    <Fragment key={`${keyBase}-l${idx}`}>
      {idx > 0 ? <br /> : null}
      {renderInline(line, `${keyBase}-l${idx}`)}
    </Fragment>
  ));
}
