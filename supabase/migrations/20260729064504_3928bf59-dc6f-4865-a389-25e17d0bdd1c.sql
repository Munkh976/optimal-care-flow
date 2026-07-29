-- Clear default "next question" links that point backwards
UPDATE public.flow_nodes n
SET default_next_node_id = NULL
FROM public.flow_nodes t
WHERE n.default_next_node_id = t.id
  AND t.flow_id = n.flow_id
  AND t.sort_order <= n.sort_order;

-- Clear answer branches that point backwards
UPDATE public.flow_options o
SET next_node_id = NULL
FROM public.flow_nodes n, public.flow_nodes t
WHERE o.node_id = n.id
  AND o.next_node_id = t.id
  AND t.flow_id = n.flow_id
  AND t.sort_order <= n.sort_order;