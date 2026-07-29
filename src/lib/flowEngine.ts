/**
 * Rule-based conversation flow engine.
 *
 * Pure, dependency-free logic: given a flow definition and the answers given so
 * far, it decides which question comes next, how to go back, and what the score
 * is. No React, no network — everything here is unit-testable.
 */

export type FlowNodeType =
  | "single_select"
  | "multi_select"
  | "info"
  | "contact_capture"
  | "terminal";

/** The five caregiver screening dimensions the builder scores against. */
export const TRAIT_KEYS = [
  "conscientiousness",
  "agreeableness",
  "emotional_stability",
  "ice",
  "resilience",
] as const;

export type TraitKey = (typeof TRAIT_KEYS)[number];

export const TRAIT_LABELS: Record<string, string> = {
  conscientiousness: "Conscientiousness",
  agreeableness: "Agreeableness",
  emotional_stability: "Emotional stability",
  ice: "Intergenerational care",
  resilience: "Resilience",
};

export interface FlowOption {
  id: string;
  node_id: string;
  label: string;
  value: string;
  sort_order: number;
  score_weight: number;
  trait_tag: string | null;
  trait_weights?: Record<string, number> | null;
  next_node_id: string | null;
}

export interface FlowNode {
  id: string;
  flow_id: string;
  node_key: string;
  prompt: string;
  helper_text: string | null;
  node_type: FlowNodeType;
  allow_skip: boolean;
  allow_free_text: boolean;
  free_text_label: string | null;
  sort_order: number;
  default_next_node_id: string | null;
  options: FlowOption[];
}

export interface ConversationFlow {
  id: string;
  audience: string;
  name: string;
  description: string | null;
  entry_node_id: string | null;
  strong_fit_threshold: number;
  review_threshold: number;
  nodes: FlowNode[];
}

export interface FlowAnswer {
  nodeId: string;
  optionIds: string[];
  optionLabels: string[];
  freeText?: string | null;
  skipped: boolean;
  scoreDelta: number;
  sequenceIndex: number;
}

export interface FlowState {
  currentNodeId: string | null;
  answers: FlowAnswer[];
  finished: boolean;
}

export type ScoreBand = "strong_fit" | "review" | "not_a_fit";

export interface ScoreResult {
  total: number;
  maxPossible: number;
  percent: number;
  traits: Record<string, number>;
  /** Each trait normalised to a 0-10 scale against the best obtainable score. */
  profile: Record<string, number>;
  band: ScoreBand;
}

/** Index a flow's nodes by id for quick lookups. */
export function nodeMap(flow: ConversationFlow): Record<string, FlowNode> {
  return Object.fromEntries(flow.nodes.map((n) => [n.id, n]));
}

export function getNode(flow: ConversationFlow, nodeId: string | null): FlowNode | null {
  if (!nodeId) return null;
  return flow.nodes.find((n) => n.id === nodeId) ?? null;
}

/** The first node of a flow: the explicit entry node, else the lowest sort order. */
export function entryNode(flow: ConversationFlow): FlowNode | null {
  if (flow.entry_node_id) {
    const explicit = getNode(flow, flow.entry_node_id);
    if (explicit) return explicit;
  }
  const sorted = [...flow.nodes].sort((a, b) => a.sort_order - b.sort_order);
  return sorted[0] ?? null;
}

/**
 * Where to go after answering `node` with `options`.
 * Priority: the first selected option's own branch, then the node default,
 * then the next node in sort order. `null` means the flow is complete.
 */
export function nextNodeId(
  flow: ConversationFlow,
  node: FlowNode,
  options: FlowOption[]
): string | null {
  // A branch may only move forward. Anything pointing at the current question or
  // an earlier one is ignored, so bad data can never create a loop.
  const forward = (targetId: string | null | undefined): string | null => {
    if (!targetId) return null;
    const target = getNode(flow, targetId);
    if (!target) return null;
    return target.sort_order > node.sort_order ? target.id : null;
  };

  for (const option of options) {
    const branch = forward(option.next_node_id);
    if (branch) return branch;
  }

  const fallback = forward(node.default_next_node_id);
  if (fallback) return fallback;

  const sorted = [...flow.nodes].sort((a, b) => a.sort_order - b.sort_order);
  const following = sorted.find((n) => n.sort_order > node.sort_order);
  return following?.id ?? null;
}

export function initState(flow: ConversationFlow): FlowState {
  const first = entryNode(flow);
  return { currentNodeId: first?.id ?? null, answers: [], finished: !first };
}

export interface AnswerInput {
  optionIds?: string[];
  freeText?: string | null;
  skipped?: boolean;
}

/** Record an answer for the current node and advance. */
export function applyAnswer(
  flow: ConversationFlow,
  state: FlowState,
  input: AnswerInput
): { state: FlowState; answer: FlowAnswer } {
  const node = getNode(flow, state.currentNodeId);
  if (!node) throw new Error("No current question to answer");

  const selected = (input.optionIds ?? [])
    .map((id) => node.options.find((o) => o.id === id))
    .filter((o): o is FlowOption => Boolean(o));

  const skipped = Boolean(input.skipped) || (selected.length === 0 && !input.freeText);

  const answer: FlowAnswer = {
    nodeId: node.id,
    optionIds: selected.map((o) => o.id),
    optionLabels: selected.map((o) => o.label),
    freeText: input.freeText ?? null,
    skipped,
    scoreDelta: skipped ? 0 : selected.reduce((sum, o) => sum + optionPoints(o), 0),
    sequenceIndex: state.answers.length,
  };

  const target = nextNodeId(flow, node, selected);
  const targetNode = getNode(flow, target);

  return {
    answer,
    state: {
      currentNodeId: target,
      answers: [...state.answers, answer],
      finished: !targetNode,
    },
  };
}

/** Step back one question, discarding the last answer. */
export function goBack(state: FlowState): { state: FlowState; removed: FlowAnswer | null } {
  if (state.answers.length === 0) return { state, removed: null };
  const answers = state.answers.slice(0, -1);
  const removed = state.answers[state.answers.length - 1];
  return {
    removed,
    state: { currentNodeId: removed.nodeId, answers, finished: false },
  };
}

export function canGoBack(state: FlowState): boolean {
  return state.answers.length > 0;
}

/** Best-case score for the flow, used to turn raw points into a percentage. */
/** Weights for an option, falling back to the legacy single trait tag. */
export function optionTraitWeights(option: FlowOption): Record<string, number> {
  const weights = option.trait_weights;
  if (weights && Object.keys(weights).length > 0) {
    return Object.fromEntries(
      Object.entries(weights).map(([k, v]) => [k, Number(v) || 0])
    );
  }
  if (option.trait_tag) return { [option.trait_tag]: Number(option.score_weight || 0) };
  return {};
}

/** Total points an option is worth (sum of its trait weights). */
export function optionPoints(option: FlowOption): number {
  const weights = option.trait_weights;
  if (weights && Object.keys(weights).length > 0) {
    return Object.values(weights).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }
  return Number(option.score_weight || 0);
}

/** Best obtainable points per trait across the whole flow. */
export function maxTraitScores(flow: ConversationFlow): Record<string, number> {
  const max: Record<string, number> = {};
  for (const node of flow.nodes) {
    const best: Record<string, number> = {};
    for (const option of node.options) {
      for (const [trait, value] of Object.entries(optionTraitWeights(option))) {
        best[trait] = Math.max(best[trait] ?? 0, value);
      }
    }
    for (const [trait, value] of Object.entries(best)) {
      max[trait] = (max[trait] ?? 0) + value;
    }
  }
  return max;
}

export function maxPossibleScore(flow: ConversationFlow): number {
  return flow.nodes.reduce((sum, node) => {
    const weights = node.options.map((o) => optionPoints(o));
    const best = weights.length ? Math.max(...weights, 0) : 0;
    return sum + best;
  }, 0);
}

export function computeScore(flow: ConversationFlow, answers: FlowAnswer[]): ScoreResult {
  const traits: Record<string, number> = {};
  let total = 0;

  for (const answer of answers) {
    if (answer.skipped) continue;
    const node = getNode(flow, answer.nodeId);
    if (!node) continue;
    for (const id of answer.optionIds) {
      const option = node.options.find((o) => o.id === id);
      if (!option) continue;
      total += optionPoints(option);
      for (const [trait, value] of Object.entries(optionTraitWeights(option))) {
        traits[trait] = (traits[trait] ?? 0) + value;
      }
    }
  }

  const maxPossible = maxPossibleScore(flow);
  const percent = maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;
  const maxTraits = maxTraitScores(flow);
  const profile: Record<string, number> = {};
  for (const trait of Object.keys(maxTraits)) {
    const best = maxTraits[trait];
    const earned = traits[trait] ?? 0;
    profile[trait] = best > 0 ? Math.round((earned / best) * 100) / 10 : 0;
  }
  const band: ScoreBand =
    percent >= Number(flow.strong_fit_threshold)
      ? "strong_fit"
      : percent >= Number(flow.review_threshold)
        ? "review"
        : "not_a_fit";

  return { total, maxPossible, percent, traits, profile, band };
}

export const BAND_LABELS: Record<ScoreBand, string> = {
  strong_fit: "Strong fit",
  review: "Needs review",
  not_a_fit: "Not a fit",
};

/** Rough progress for the header: answered vs. total questions in the flow. */
export function progress(flow: ConversationFlow, state: FlowState) {
  const total = Math.max(flow.nodes.length, 1);
  const step = Math.min(state.answers.length + (state.finished ? 0 : 1), total);
  return { step, total, percent: Math.round((state.answers.length / total) * 100) };
}

/** Nodes that can never be reached from the entry node (flow-builder validation). */
export function findOrphanNodes(flow: ConversationFlow): FlowNode[] {
  const start = entryNode(flow);
  if (!start) return flow.nodes;

  const seen = new Set<string>();
  const queue = [start.id];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = getNode(flow, id);
    if (!node) continue;
    const targets = new Set<string>();
    node.options.forEach((o) => {
      const t = nextNodeId(flow, node, [o]);
      if (t) targets.add(t);
    });
    const fallback = nextNodeId(flow, node, []);
    if (fallback) targets.add(fallback);
    targets.forEach((t) => queue.push(t));
  }

  return flow.nodes.filter((n) => !seen.has(n.id));
}

export interface FlowValidation {
  orphans: FlowNode[];
  /** Answers whose branch points at an earlier question (creates loops). */
  backwardBranches: { node: FlowNode; option: FlowOption }[];
  /** Questions claimed as the next step by more than one earlier question. */
  multiParent: FlowNode[];
}

/** Structural checks surfaced in the conversation builder. */
export function validateFlow(flow: ConversationFlow): FlowValidation {
  const orphans = findOrphanNodes(flow);
  const backwardBranches: { node: FlowNode; option: FlowOption }[] = [];
  const parents: Record<string, Set<string>> = {};

  for (const node of flow.nodes) {
    const claim = (targetId: string | null) => {
      if (!targetId) return;
      (parents[targetId] ??= new Set()).add(node.id);
    };
    claim(node.default_next_node_id);
    for (const option of node.options) {
      claim(option.next_node_id);
      const target = getNode(flow, option.next_node_id);
      if (target && target.sort_order <= node.sort_order) {
        backwardBranches.push({ node, option });
      }
    }
  }

  const multiParent = flow.nodes.filter((n) => (parents[n.id]?.size ?? 0) > 1);
  return { orphans, backwardBranches, multiParent };
}