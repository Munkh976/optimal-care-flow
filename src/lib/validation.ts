import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Email is required" })
  .email({ message: "Enter a valid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password must be less than 72 characters" });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Password is required" }).max(72),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Full name is required" })
    .max(100, { message: "Full name must be less than 100 characters" }),
  agencyName: z
    .string()
    .trim()
    .max(150, { message: "Agency name must be less than 150 characters" })
    .optional(),
});

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Enter a valid date" });

export const timeOffRequestSchema = z
  .object({
    caregiver_id: z.string().uuid({ message: "Select a caregiver" }),
    start_date: dateString,
    end_date: dateString,
    request_type: z.enum(["vacation", "medical", "personal", "emergency"]),
    reason: z
      .string()
      .trim()
      .max(500, { message: "Reason must be less than 500 characters" })
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
    message: "End date must be on or after the start date",
    path: ["end_date"],
  });

/** Returns the first validation message, or null when the input is valid. */
export function firstError(result: z.SafeParseReturnType<unknown, unknown>) {
  if (result.success) return null;
  return result.error.errors[0]?.message ?? "Invalid input";
}