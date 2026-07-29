import { ConversationFlow, FlowNode } from "@/lib/flowEngine";

export interface ConversationSection {
  title: string;
  nodes: FlowNode[];
}

/** Question counts per section, in flow order. Extra questions join the last section. */
const SECTION_PLAN: { title: string; count: number }[] = [
  { title: "Your background", count: 3 },
  { title: "Your availability", count: 3 },
  { title: "Your qualifications", count: 1 },
  { title: "How you care", count: 2 },
  { title: "Getting started", count: 3 },
];

/** Group the flow's questions into named sections following the published order. */
export function buildSections(flow: ConversationFlow): ConversationSection[] {
  const ordered = [...flow.nodes].sort((a, b) => a.sort_order - b.sort_order);
  const sections: ConversationSection[] = [];
  let cursor = 0;

  SECTION_PLAN.forEach((plan, index) => {
    const isLast = index === SECTION_PLAN.length - 1;
    const slice = isLast ? ordered.slice(cursor) : ordered.slice(cursor, cursor + plan.count);
    cursor += slice.length;
    if (slice.length > 0) sections.push({ title: plan.title, nodes: slice });
  });

  if (sections.length === 0 && ordered.length > 0) {
    sections.push({ title: SECTION_PLAN[0].title, nodes: ordered });
  }
  return sections;
}

/** The section containing a node, plus the node's 0-based position inside it. */
export function locateNode(sections: ConversationSection[], nodeId: string | null) {
  if (!nodeId) return null;
  for (let s = 0; s < sections.length; s += 1) {
    const index = sections[s].nodes.findIndex((n) => n.id === nodeId);
    if (index >= 0) return { sectionIndex: s, section: sections[s], indexInSection: index };
  }
  return null;
}