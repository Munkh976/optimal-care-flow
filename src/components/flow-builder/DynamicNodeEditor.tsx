import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { FlowNode, TRAIT_KEYS, TRAIT_LABELS } from "@/lib/flowEngine";
import {
  DynamicItem,
  fetchDynamicItems,
  itemWeights,
  saveItemOverrides,
} from "@/lib/dynamicCatalog";

interface DynamicNodeEditorProps {
  node: FlowNode;
  readOnly: boolean;
  onChange: (patch: Partial<FlowNode>) => void;
}

function WeightGrid({
  weights,
  disabled,
  onChange,
}: {
  weights: Record<string, number>;
  disabled?: boolean;
  onChange: (trait: string, value: number) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {TRAIT_KEYS.map((trait) => (
        <div key={trait} className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{TRAIT_LABELS[trait]}</Label>
          <Input
            type="number"
            min={0}
            max={5}
            step={1}
            className="h-8"
            disabled={disabled}
            value={Number(weights[trait] ?? 0)}
            onChange={(e) =>
              onChange(trait, Math.max(0, Math.min(5, Number(e.target.value) || 0)))
            }
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Editor for questions whose answers come from a catalog table. Managers cannot
 * add or remove answers here — they edit the wording, the default scoring, and
 * optional per-item overrides stored on the catalog row itself.
 */
export function DynamicNodeEditor({ node, readOnly, onChange }: DynamicNodeEditorProps) {
  const source = node.dynamic_source_table as string;
  const [items, setItems] = useState<DynamicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDynamicItems(source)
      .then((rows) => !cancelled && setItems(rows))
      .catch((e) =>
        toast({ title: "Could not load options", description: e.message, variant: "destructive" })
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source]);

  const defaults = node.default_weights ?? {};

  const patchOverride = (itemId: string, trait: string, value: number) =>
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, weight_overrides: { ...(i.weight_overrides ?? {}), [trait]: value } }
          : i
      )
    );

  const persist = async (item: DynamicItem) => {
    setSavingId(item.id);
    try {
      await saveItemOverrides(source, item.id, item.weight_overrides);
      toast({ title: "Overrides saved", description: item.name });
    } catch (e: any) {
      toast({ title: "Could not save overrides", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const clearOverride = async (item: DynamicItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, weight_overrides: null } : i)));
    setSavingId(item.id);
    try {
      await saveItemOverrides(source, item.id, null);
      toast({ title: "Overrides cleared", description: item.name });
    } catch (e: any) {
      toast({ title: "Could not clear overrides", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <Badge variant="secondary">Dynamic question</Badge>
        <span className="text-muted-foreground">Options from: {source}</span>
      </div>

      <div className="space-y-2">
        <Label>Default weights</Label>
        <p className="text-xs text-muted-foreground">
          Applied to any option that has no override of its own (0–5 per trait).
        </p>
        <WeightGrid
          weights={defaults}
          disabled={readOnly}
          onChange={(trait, value) =>
            onChange({ default_weights: { ...defaults, [trait]: value } })
          }
        />
      </div>

      {source === "care_service_categories" && (
        <div className="space-y-2">
          <Label>Follow-up question</Label>
          <Input
            value={node.sub_question_template ?? ""}
            readOnly={readOnly}
            placeholder="Which {category} services have you provided?"
            onChange={(e) => onChange({ sub_question_template: e.target.value || null })}
          />
          <p className="text-xs text-muted-foreground">
            Asked once per chosen category. Use <code>{"{category}"}</code> where the category name
            should appear.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Per-item overrides</Label>
        {loading && <p className="text-sm text-muted-foreground">Loading options...</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No active options in {source} yet.</p>
        )}
        {items.map((item) => {
          const open = openId === item.id;
          const weights = itemWeights(defaults, item.weight_overrides);
          return (
            <div key={item.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{item.name}</span>
                <div className="flex items-center gap-2">
                  {item.weight_overrides && <Badge variant="outline">Overridden</Badge>}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOpenId(open ? null : item.id)}
                  >
                    {open ? "Close" : "Override weights"}
                  </Button>
                </div>
              </div>
              {open && (
                <div className="space-y-3 pt-3">
                  <WeightGrid
                    weights={weights}
                    disabled={readOnly}
                    onChange={(trait, value) => patchOverride(item.id, trait, value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={readOnly || savingId === item.id}
                      onClick={() => persist(item)}
                    >
                      {savingId === item.id ? "Saving..." : "Save overrides"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={readOnly || savingId === item.id || !item.weight_overrides}
                      onClick={() => clearOverride(item)}
                    >
                      Use defaults
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label>Live preview</Label>
        <p className="text-xs text-muted-foreground">
          Exactly what caregivers will see right now.
        </p>
        <ul className="space-y-1.5 rounded-lg border border-border p-3">
          {items.map((item) => (
            <li key={item.id} className="text-sm text-foreground">
              • {item.name}
            </li>
          ))}
          {!loading && items.length === 0 && (
            <li className="text-sm text-muted-foreground">No active options.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
