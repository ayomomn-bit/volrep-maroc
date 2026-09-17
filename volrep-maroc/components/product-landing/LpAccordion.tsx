"use client";

import { useState } from "react";

export type LpAccordionItem = {
  question: string;
  answer: string;
};

// The reference's `.accordion` / `.accordion-item.active` toggle behavior,
// reimplemented as React state (the reference's version lived in the
// un-provided script.js). Used by both the mini "Description" accordion and
// the full FAQ section.
export function LpAccordion({ items, defaultOpen = -1 }: { items: LpAccordionItem[]; defaultOpen?: number }) {
  const [openIndex, setOpenIndex] = useState(defaultOpen);

  return (
    <div className="accordion">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.question} className={`accordion-item ${isOpen ? "active" : ""}`}>
            <button
              type="button"
              className="accordion-header"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
            >
              <span>{item.question}</span>
              <span className="accordion-icon" aria-hidden="true">
                +
              </span>
            </button>
            <div className="accordion-content" role="region">
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
