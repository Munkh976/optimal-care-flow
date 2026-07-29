import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AnswerInput,
  ConversationFlow,
  FlowNode,
  FlowState,
  applyAnswer,
  computeScore,
  getNode,
  goBack as goBackPure,
  initState,
  progress,
} from "@/lib/flowEngine";

export interface ContactDetails {
  name?: string;
  email?: string;
  phone?: string;
}

export function useConversationFlow(audience: string, options?: { persist?: boolean }) {
  const persist = options?.persist !== false;
  const [flow, setFlow] = useState<ConversationFlow | null>(null);
  const [state, setState] = useState<FlowState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadFlow = useCallback(async (): Promise<ConversationFlow | null> => {
    const { data: flowRow, error: flowError } = await supabase
      .from("conversation_flows")
      .select("id, audience, name, description, entry_node_id, strong_fit_threshold, review_threshold")
      .eq("audience", audience as never)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (flowError) throw flowError;
    if (!flowRow) return null;

    const { data: nodeRows, error: nodeError } = await supabase
      .from("flow_nodes")
      .select(
        "id, flow_id, node_key, prompt, helper_text, node_type, allow_skip, allow_free_text, free_text_label, sort_order, default_next_node_id"
      )
      .eq("flow_id", flowRow.id)
      .order("sort_order");
    if (nodeError) throw nodeError;

    const nodeIds = (nodeRows || []).map((n: any) => n.id);
    const { data: optionRows, error: optionError } = await supabase
      .from("flow_options")
      .select(
        "id, node_id, label, value, sort_order, score_weight, trait_tag, trait_weights, next_node_id"
      )
      .in("node_id", nodeIds)
      .order("sort_order");
    if (optionError) throw optionError;

    const nodes: FlowNode[] = (nodeRows || []).map((n: any) => ({
      ...n,
      options: (optionRows || []).filter((o: any) => o.node_id === n.id),
    }));

    return { ...(flowRow as any), nodes } as ConversationFlow;
  }, [audience]);

  // Load flow + resume any in-progress session for this visitor.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await loadFlow();
        if (cancelled) return;
        if (!loaded) {
          setError("No conversation is available yet.");
          setLoading(false);
          return;
        }
        setFlow(loaded);

        if (!persist) {
          setState(initState(loaded));
          setLoading(false);
          return;
        }

        // Visitors are anonymous and cannot read sessions back, so each visit
        // starts a new session with a client-generated id.
        const fresh = initState(loaded);
        const id = crypto.randomUUID();
        const token = crypto.randomUUID();
        const { error: createError } = await supabase.from("conversation_sessions").insert({
          id,
          flow_id: loaded.id,
          session_token: token,
          current_node_id: fresh.currentNodeId,
        });
        if (createError) throw createError;
        if (cancelled) return;
        setSessionId(id);
        setSessionToken(token);
        setState(fresh);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Could not load the conversation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audience, persist, loadFlow]);

  const currentNode = useMemo(
    () => (flow && state ? getNode(flow, state.currentNodeId) : null),
    [flow, state]
  );

  const score = useMemo(
    () => (flow && state ? computeScore(flow, state.answers) : null),
    [flow, state]
  );

  const answer = useCallback(
    async (input: AnswerInput) => {
      if (!flow || !state) return;
      const result = applyAnswer(flow, state, input);
      setState(result.state);

      if (!persist || !sessionId) return;
      setSaving(true);
      try {
        const { error: insertError } = await supabase.from("conversation_answers").insert({
          session_id: sessionId,
          node_id: result.answer.nodeId,
          option_ids: result.answer.optionIds,
          option_labels: result.answer.optionLabels,
          free_text: result.answer.freeText,
          skipped: result.answer.skipped,
          score_delta: result.answer.scoreDelta,
          sequence_index: result.answer.sequenceIndex,
        });
        if (insertError) console.error("Could not save answer", insertError);

        const { error: updateError } = await supabase.rpc("flow_session_progress", {
          p_session_id: sessionId,
          p_token: sessionToken ?? "",
          p_node_id: result.state.currentNodeId,
        });
        if (updateError) console.error("Could not update session", updateError);
      } finally {
        setSaving(false);
      }
    },
    [flow, state, sessionId, sessionToken, persist]
  );

  const back = useCallback(async () => {
    if (!state) return;
    const { state: previous, removed } = goBackPure(state);
    if (!removed) return;
    setState(previous);
    if (!persist || !sessionId) return;
    const { error: trimError } = await supabase.rpc("flow_session_trim_answers", {
      p_session_id: sessionId,
      p_token: sessionToken ?? "",
      p_from_index: removed.sequenceIndex,
      p_node_id: previous.currentNodeId,
    });
    if (trimError) console.error("Could not rewind session", trimError);
  }, [state, sessionId, sessionToken, persist]);

  /** Mark the session complete, store the score, and return it. */
  const complete = useCallback(
    async (contact?: ContactDetails) => {
      if (!flow || !state) return null;
      const finalScore = computeScore(flow, state.answers);
      if (!persist || !sessionId) return finalScore;
      const { error: completeError } = await supabase.rpc("flow_session_complete", {
        p_session_id: sessionId,
        p_token: sessionToken ?? "",
        p_total_score: finalScore.total,
        p_trait_scores: finalScore.profile as never,
        p_band: audience === "caregiver_screening" ? finalScore.band : null,
        p_contact_name: contact?.name ?? null,
        p_contact_email: contact?.email ?? null,
        p_contact_phone: contact?.phone ?? null,
      });
      if (completeError) console.error("Could not complete session", completeError);
      return finalScore;
    },
    [flow, state, sessionId, sessionToken, persist, audience]
  );

  const restart = useCallback(() => {
    if (typeof window !== "undefined") window.location.reload();
  }, []);

  const linkRegistration = useCallback(
    async (registrationId: string) => {
      if (!sessionId) return;
      const { error: linkError } = await supabase.rpc("flow_session_link_registration", {
        p_session_id: sessionId,
        p_token: sessionToken ?? "",
        p_registration_id: registrationId,
      });
      if (linkError) console.error("Could not link screening to application", linkError);
    },
    [sessionId, sessionToken]
  );

  return {
    flow,
    state,
    currentNode,
    loading,
    error,
    saving,
    sessionId,
    score,
    progress: flow && state ? progress(flow, state) : { step: 0, total: 0, percent: 0 },
    answer,
    back,
    complete,
    restart,
    linkRegistration,
  };
}