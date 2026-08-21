// TEMPORARY verification harness for Phase 2.5. Runs every test inside a single
// transaction that is always rolled back, then deletes itself from the project.
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const STAFF = "1da1cde0-6ce4-4518-ac22-d8caf957c5f3"; // agency_admin
const CG_USER = "32adf16d-faf0-44bd-8af0-c7405227b8e6"; // Tim's login
const TIM = "33dc498b-15e6-4f21-a0e9-1d541b67a211"; // skills ADL0001/2
const ERDENE = "de08b66f-dd16-4e51-8934-60861496a856"; // skills ADL0003 only
const SHIFT_MON = "1bc0c254-ff86-4fc9-add7-fc1d467c98bc"; // Mon 2026-08-24 09:00-13:00 ADL0001
const SHIFT_MON_PM = "b732d7a7-68ab-43cc-a396-f15057c33226"; // Mon 2026-08-24 17:00-19:00 ADL0002

Deno.serve(async () => {
  const client = new Client(Deno.env.get("SUPABASE_DB_URL")!);
  await client.connect();
  const results: any[] = [];
  const run = async (name: string, sql: string, expect: "ok" | "fail") => {
    try {
      const r = await client.queryObject(sql);
      results.push({ test: name, expected: expect, outcome: "ok", rows: r.rows });
    } catch (e) {
      results.push({ test: name, expected: expect, outcome: "error", message: String((e as Error).message) });
    }
  };
  const asUser = (id: string) =>
    `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{"sub":"${id}","role":"authenticated"}', true);`;
  const reset = `RESET ROLE;`;

  try {
    await client.queryArray("BEGIN");

    // 1. staff assigns eligible caregiver
    await run("1_staff_assign_eligible", `${asUser(STAFF)}
      SELECT public.assign_caregiver_to_shift('${SHIFT_MON}','${TIM}','manual',null,null) AS r;`, "ok");
    await run("1b_derived_shift_caregiver", `${reset}
      SELECT caregiver_id::text, status::text FROM public.shifts WHERE id='${SHIFT_MON}';`, "ok");

    // 2. overlap hard blocker, even with override reason
    await run("2_overlap_with_override", `${reset}
      INSERT INTO public.shifts (id, agency_id, client_id, order_title, care_type_code, shift_date, start_time, end_time, duration_hours, status)
      SELECT '11111111-1111-1111-1111-111111111111', agency_id, client_id, 'overlap test', 'ADL0001', shift_date, '10:00', '12:00', 2, 'open'
      FROM public.shifts WHERE id='${SHIFT_MON}';
      ${asUser(STAFF)}
      SELECT public.assign_caregiver_to_shift('11111111-1111-1111-1111-111111111111','${TIM}','manual',null,'manager override attempt') AS r;`, "fail");

    // 3. missing skill, hard, not overridable
    await run("3_missing_skill_with_override", `${reset}${asUser(STAFF)}
      SELECT public.assign_caregiver_to_shift('${SHIFT_MON_PM}','${ERDENE}','manual',null,'override attempt') AS r;`, "fail");

    // 4. expired certification seeded, hard, not overridable
    await run("4_expired_cert_with_override", `${reset}
      INSERT INTO public.caregiver_certifications (caregiver_id, certification_name, expiry_date, is_verified)
      VALUES ('${TIM}','CPR (test seed)','2026-01-01', true);
      ${asUser(STAFF)}
      SELECT public.assign_caregiver_to_shift('${SHIFT_MON_PM}','${TIM}','manual',null,'override attempt') AS r;`, "fail");
    await run("4b_remove_seed", `${reset} DELETE FROM public.caregiver_certifications WHERE certification_name='CPR (test seed)';`, "ok");

    // 5. weekly cap soft blocker
    await run("5_weekly_cap_no_reason", `${reset}
      UPDATE public.agency SET max_weekly_hours = 1 WHERE id = (SELECT agency_id FROM public.shifts WHERE id='${SHIFT_MON_PM}');
      ${asUser(STAFF)}
      SELECT public.assign_caregiver_to_shift('${SHIFT_MON_PM}','${TIM}','manual',null,null) AS r;`, "fail");
    await run("6_weekly_cap_with_reason", `${reset}${asUser(STAFF)}
      SELECT public.assign_caregiver_to_shift('${SHIFT_MON_PM}','${TIM}','manual',null,'Client insists on Tim; approved by manager') AS r;`, "ok");
    await run("6b_override_columns_logged", `${reset}
      SELECT override_reason, override_by::text, (override_at IS NOT NULL) AS has_ts
      FROM public.shift_assignments WHERE shift_id='${SHIFT_MON_PM}';`, "ok");

    // 7. caregiver pick-up over cap (cap still 1)
    await run("7_pickup_over_cap", `${reset}
      SELECT public.release_shift_assignments(ARRAY['${SHIFT_MON_PM}']::uuid[], 'test reset') FROM (SELECT set_config('request.jwt.claims','{"sub":"${STAFF}","role":"authenticated"}',true)) x;
      ${asUser(CG_USER)}
      SELECT public.caregiver_pick_up_shift('${SHIFT_MON_PM}') AS r;`, "fail");

    // 8. caregiver pick-up eligible (restore cap, release Monday shift first)
    await run("8_pickup_eligible", `${reset}
      UPDATE public.agency SET max_weekly_hours = 40 WHERE id = (SELECT agency_id FROM public.shifts WHERE id='${SHIFT_MON}');
      SELECT set_config('request.jwt.claims','{"sub":"${STAFF}","role":"authenticated"}',true);
      SET LOCAL ROLE authenticated;
      SELECT public.release_shift_assignments(ARRAY['${SHIFT_MON}']::uuid[], 'test reset') AS released;`, "ok");
    await run("8b_pickup_eligible_call", `${reset}${asUser(CG_USER)}
      SELECT public.caregiver_pick_up_shift('${SHIFT_MON}') AS r;`, "ok");

    // 9. caregiver calls staff assign function for another caregiver
    await run("9_caregiver_calls_assign", `${reset}${asUser(CG_USER)}
      SELECT public.assign_caregiver_to_shift('${SHIFT_MON_PM}','${ERDENE}','manual',null,null) AS r;`, "fail");

    // 10. direct PostgREST-style insert by staff
    await run("10_direct_insert_staff", `${reset}${asUser(STAFF)}
      INSERT INTO public.shift_assignments (shift_id, caregiver_id, status, assignment_method)
      VALUES ('${SHIFT_MON_PM}','${TIM}','scheduled','manual');`, "fail");

    // 11. direct caregiver_id change by staff
    await run("11_direct_caregiver_id_update", `${reset}${asUser(STAFF)}
      UPDATE public.shift_assignments SET caregiver_id='${ERDENE}' WHERE shift_id='${SHIFT_MON}';`, "fail");

    // 12. direct cancel + override tampering
    await run("12_direct_cancel", `${reset}${asUser(STAFF)}
      UPDATE public.shift_assignments SET status='cancelled' WHERE shift_id='${SHIFT_MON}';`, "fail");
    await run("12b_override_tamper", `${reset}${asUser(STAFF)}
      UPDATE public.shift_assignments SET override_reason='faked' WHERE shift_id='${SHIFT_MON}';`, "fail");

    // 13. operational timeclock update still works
    await run("13_timeclock_update", `${reset}${asUser(STAFF)}
      UPDATE public.shift_assignments
         SET clock_in_time=now(), clock_out_time=now(), actual_hours_worked=4, mileage=12, notes='clocked', status='completed'
       WHERE shift_id='${SHIFT_MON}'
      RETURNING status::text, actual_hours_worked, mileage;`, "ok");

    // 14. completed assignment delete still protected
    await run("14_delete_completed", `${reset}
      DELETE FROM public.shift_assignments WHERE shift_id='${SHIFT_MON}';`, "fail");

    // 15. shifts.caregiver_id remains derived after direct tamper attempt
    await run("15_derived_after_direct_write", `${reset}
      UPDATE public.shifts SET caregiver_id='${ERDENE}' WHERE id='${SHIFT_MON}';
      SELECT caregiver_id::text FROM public.shifts WHERE id='${SHIFT_MON}';`, "ok");
  } finally {
    await client.queryArray("ROLLBACK").catch(() => {});
    const counts = await client.queryObject<{ shifts: bigint; assignments: bigint }>(
      "SELECT (SELECT count(*) FROM public.shifts) AS shifts, (SELECT count(*) FROM public.shift_assignments) AS assignments"
    );
    results.push({ test: "final_counts", rows: counts.rows.map((r) => ({ shifts: Number(r.shifts), assignments: Number(r.assignments) })) });
    await client.end();
  }

  return new Response(JSON.stringify(results, null, 2), { headers: { "Content-Type": "application/json" } });
});
