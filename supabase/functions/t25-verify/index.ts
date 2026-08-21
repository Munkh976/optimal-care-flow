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
    await client.queryArray("SAVEPOINT sp");
    try {
      const r = await client.queryObject(sql);
      await client.queryArray("RESET ROLE");
      await client.queryArray("RELEASE SAVEPOINT sp");
      results.push({ test: name, expected: expect, outcome: "ok", rows: r.rows.map((x) => JSON.parse(JSON.stringify(x, (_k, v) => typeof v === "bigint" ? Number(v) : v))) });
    } catch (e) {
      await client.queryArray("ROLLBACK TO SAVEPOINT sp").catch(() => {});
      await client.queryArray("RESET ROLE").catch(() => {});
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

    // 7. caregiver pick-up refused while weekly cap is still 1
    await run("7_release_pm_as_staff", `${asUser(STAFF)}
      SELECT public.release_shift_assignments(ARRAY['${SHIFT_MON_PM}']::uuid[], 'test reset') AS released;`, "ok");
    await run("7b_pickup_over_cap", `${asUser(CG_USER)}
      SELECT public.caregiver_pick_up_shift('${SHIFT_MON_PM}') AS r;`, "fail");

    // 8. caregiver pick-up eligible after cap restored and Monday shift released
    await run("8_restore_cap_and_release", `UPDATE public.agency SET max_weekly_hours = 40
        WHERE id = (SELECT agency_id FROM public.shifts WHERE id='${SHIFT_MON}');`, "ok");
    await run("8b_release_monday", `${asUser(STAFF)}
      SELECT public.release_shift_assignments(ARRAY['${SHIFT_MON}']::uuid[], 'test reset') AS released;`, "ok");
    await run("8c_shift_back_to_open", `SELECT status::text, caregiver_id::text FROM public.shifts WHERE id='${SHIFT_MON}';`, "ok");
    await run("8d_pickup_eligible", `${asUser(CG_USER)}
      SELECT public.caregiver_pick_up_shift('${SHIFT_MON}') AS r;`, "ok");
    await run("8e_derived_after_pickup", `SELECT status::text, caregiver_id::text FROM public.shifts WHERE id='${SHIFT_MON}';`, "ok");

    // 9. caregiver calls the staff-only assign function
    await run("9_caregiver_calls_assign", `${asUser(CG_USER)}
      SELECT public.assign_caregiver_to_shift('${SHIFT_MON_PM}','${ERDENE}','manual',null,null) AS r;`, "fail");

    // 10. direct PostgREST-style insert by staff
    await run("10_direct_insert_staff", `${asUser(STAFF)}
      INSERT INTO public.shift_assignments (shift_id, caregiver_id, status, assignment_method)
      VALUES ('${SHIFT_MON_PM}','${TIM}','scheduled','manual');`, "fail");

    // 11-12. direct tampering on the ACTIVE picked-up assignment
    await run("11_direct_caregiver_id_update", `${asUser(STAFF)}
      UPDATE public.shift_assignments SET caregiver_id='${ERDENE}'
       WHERE shift_id='${SHIFT_MON}' AND status <> 'cancelled';`, "fail");
    await run("12_direct_cancel_active", `${asUser(STAFF)}
      UPDATE public.shift_assignments SET status='cancelled'
       WHERE shift_id='${SHIFT_MON}' AND status <> 'cancelled';`, "fail");
    await run("12b_override_tamper", `${asUser(STAFF)}
      UPDATE public.shift_assignments SET override_reason='faked'
       WHERE shift_id='${SHIFT_MON}' AND status <> 'cancelled';`, "fail");

    // 13. operational timeclock update still works for staff
    await run("13_timeclock_update", `${asUser(STAFF)}
      UPDATE public.shift_assignments
         SET clock_in_time=now(), clock_out_time=now(), actual_hours_worked=4, mileage=12,
             notes='clocked', status='completed'
       WHERE shift_id='${SHIFT_MON}' AND status <> 'cancelled';`, "ok");
    await run("13b_timeclock_read", `SELECT status::text, actual_hours_worked::text, mileage::text
      FROM public.shift_assignments WHERE shift_id='${SHIFT_MON}' AND status='completed';`, "ok");

    // 14. completed assignment cannot be deleted
    await run("14_delete_completed", `${asUser(STAFF)}
      DELETE FROM public.shift_assignments WHERE shift_id='${SHIFT_MON}' AND status='completed';`, "fail");

    // 15. shifts.caregiver_id is re-derived after a direct write attempt
    await run("15_direct_write_shifts_caregiver", `${asUser(STAFF)}
      UPDATE public.shifts SET caregiver_id='${ERDENE}' WHERE id='${SHIFT_MON}';`, "ok");
    await run("15b_derived_value", `SELECT caregiver_id::text FROM public.shifts WHERE id='${SHIFT_MON}';`, "ok");
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
