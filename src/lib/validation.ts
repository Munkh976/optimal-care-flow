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

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} must be less than ${max} characters` })
    .optional()
    .or(z.literal(""));

const requiredText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `${label} is required` })
    .max(max, { message: `${label} must be less than ${max} characters` });

const phoneField = z
  .string()
  .trim()
  .max(30, { message: "Phone must be less than 30 characters" })
  .regex(/^[0-9+()\-.\s]*$/, { message: "Phone contains invalid characters" })
  .optional()
  .or(z.literal(""));

export const passwordResetSchema = z.object({
  newPassword: passwordSchema,
});

export const agencyFormSchema = z.object({
  agency_name: requiredText(150, "Agency name"),
  address: optionalText(200, "Address"),
  city: optionalText(100, "City"),
  state: optionalText(50, "State"),
  zip_code: optionalText(20, "ZIP code"),
  phone: phoneField,
  email: z
    .string()
    .trim()
    .max(255, { message: "Email must be less than 255 characters" })
    .email({ message: "Enter a valid email address" })
    .optional()
    .or(z.literal("")),
  website: optionalText(255, "Website"),
  naics_code: optionalText(20, "NAICS code"),
  tax_id: optionalText(50, "Tax ID").optional(),
  business_type: optionalText(100, "Business type").optional(),
});

export const careTypeFormSchema = z.object({
  code: requiredText(30, "Code"),
  category: requiredText(50, "Category"),
  name: requiredText(120, "Name"),
  description: optionalText(1000, "Description"),
  keywords: optionalText(500, "Keywords"),
  price: z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
      message: "Price must be a positive number",
    }),
  duration: z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) > 0 && Number(v) <= 24), {
      message: "Duration must be between 0 and 24 hours",
    }),
});

export const caregiverFormSchema = z.object({
  first_name: requiredText(60, "First name"),
  last_name: requiredText(60, "Last name"),
  email: emailSchema,
  phone: phoneField,
  hourly_rate: z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 1000), {
      message: "Hourly rate must be between 0 and 1000",
    }),
  employment_type: optionalText(30, "Employment type"),
  city: optionalText(100, "City"),
  state: optionalText(50, "State"),
  address: optionalText(200, "Address"),
  zip_code: optionalText(20, "ZIP code"),
  care_type_codes: z.array(z.string().max(30)).max(50).optional(),
});

export const clientFormSchema = z.object({
  first_name: requiredText(60, "First name"),
  last_name: requiredText(60, "Last name"),
  email: z
    .string()
    .trim()
    .max(255, { message: "Email must be less than 255 characters" })
    .email({ message: "Enter a valid email address" })
    .optional()
    .or(z.literal("")),
  phone: phoneField,
  address: optionalText(200, "Address"),
  city: optionalText(100, "City"),
  state: optionalText(50, "State"),
  zip_code: optionalText(20, "ZIP code"),
  date_of_birth: optionalText(20, "Date of birth"),
  medical_conditions: z.array(z.string().max(200)).max(100).optional(),
  care_type_codes: z.array(z.string().max(30)).max(50).optional(),
  emergency_contact_name: optionalText(120, "Emergency contact name"),
  emergency_contact_phone: phoneField,
  notes: optionalText(2000, "Notes"),
});