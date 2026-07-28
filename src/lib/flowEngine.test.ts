import { describe, it, expect } from "vitest";
import {
  ConversationFlow,
  FlowNode,
  applyAnswer,
  computeScore,
  entryNode,
  findOrphanNodes,
  goBack,
  initState,
  nextNodeId,
} from "./flowEngine";

function node(partial: Partial<FlowNode> & { id: string }): FlowNode {
  return {
    flow_id: "flow",
    node_key: partial.id,
    prompt: "Question " + partial.id,
    helper_text: null,
    node_type: "single_select",
    allow_skip: true,
    allow_free_text: false,
    free_text_label: null,
    sort_order: 0,
    default_next_node_id: null,
    options: [],
    ...partial,
  };
}

const flow: ConversationFlow = {
  id: "flow",
  audience: "caregiver_screening",
  name: "Screening",
  description: null,
  entry_node_id: "q1",
  strong_fit_threshold: 70,
  review_threshold: 40,
  nodes: [
    node({
      id: "q1",
      sort_order: 1,
      options: [
        { id: "a1", node_id: "q1", label: "Yes", value: "yes", sort_order: 1, score_weight: 10, trait_tag: "reliability", next_node_id: null },
        { id: "a2", node_id: "q1", label: "No", value: "no", sort_order: 2, score_weight: 0, trait_tag: "reliability", next_node_id: "q3" },
      ],
    }),
    node({
      id: "q2",
      sort_order: 2,
      options: [
        { id: "b1", node_id: "q2", label: "Calm", value: "calm", sort_order: 1, score_weight: 10, trait_tag: "patience", next_node_id: null },
      ],
    }),
    node({ id: "q3", sort_order: 3, node_type: "terminal", options: [] }),
  ],
};

describe("flowEngine", () => {
  it("starts at the entry node", () => {
    expect(entryNode(flow)?.id).toBe("q1");
    expect(initState(flow).currentNodeId).toBe("q1");
  });

  it("falls through to the next node in sort order", () => {
    expect(nextNodeId(flow, flow.nodes[0], [])).toBe("q2");
  });

  it("follows an option branch when one is set", () => {
    const state = initState(flow);
    const { state: next } = applyAnswer(flow, state, { optionIds: ["a2"] });
    expect(next.currentNodeId).toBe("q3");
    expect(next.finished).toBe(true);
  });

  it("skipping records an answer with no score and advances", () => {
    const { state, answer } = applyAnswer(flow, initState(flow), { skipped: true });
    expect(answer.skipped).toBe(true);
    expect(answer.scoreDelta).toBe(0);
    expect(state.currentNodeId).toBe("q2");
  });

  it("goes back to the previous question and drops the answer", () => {
    const { state } = applyAnswer(flow, initState(flow), { optionIds: ["a1"] });
    const back = goBack(state);
    expect(back.state.currentNodeId).toBe("q1");
    expect(back.state.answers).toHaveLength(0);
  });

  it("scores totals, traits and bands", () => {
    let state = initState(flow);
    state = applyAnswer(flow, state, { optionIds: ["a1"] }).state;
    state = applyAnswer(flow, state, { optionIds: ["b1"] }).state;
    const score = computeScore(flow, state.answers);
    expect(score.total).toBe(20);
    expect(score.maxPossible).toBe(20);
    expect(score.percent).toBe(100);
    expect(score.traits.reliability).toBe(10);
    expect(score.band).toBe("strong_fit");
  });

  it("detects unreachable questions", () => {
    const orphaned: ConversationFlow = {
      ...flow,
      nodes: [...flow.nodes, node({ id: "q9", sort_order: 99, options: [] })],
    };
    // q9 is last in sort order and nothing points at it after the terminal node
    expect(findOrphanNodes(orphaned).map((n) => n.id)).toContain("q9");
  });
});