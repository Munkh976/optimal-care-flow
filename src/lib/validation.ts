import { z } from "zod";

export const userFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["system_admin", "agency_admin", "manager", "scheduler", "hr_staff"]),
});

export const roleUpdateSchema = z.object({
  role: z.enum(["system_admin", "agency_admin", "manager", "scheduler", "hr_staff", "caregiver", "client"]),
});

export const systemRoleSchema = z.object({
  role_name: z.string().min(1, "Role name is required").max(100, "Name too long"),
  role_code: z.string().min(1, "Role code is required").max(50, "Code too long"),
  description: z.string().max(500, "Description too long").optional(),
  access_level: z.number().min(0).max(100),
  is_active: z.boolean(),
});

export const passwordResetSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(72, "Password too long"),
});
