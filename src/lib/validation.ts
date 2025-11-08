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

export const caregiverFormSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100, "Name too long"),
  last_name: z.string().min(1, "Last name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  phone: z.string().min(1, "Phone is required").max(20, "Phone too long"),
  hourly_rate: z.string().optional(),
  employment_type: z.enum(["full_time", "part_time", "on_call"]),
  address: z.string().max(255, "Address too long").optional(),
  city: z.string().max(100, "City too long").optional(),
  state: z.string().max(2, "State code too long").optional(),
  zip_code: z.string().max(10, "Zip code too long").optional(),
});

export const clientFormSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100, "Name too long"),
  last_name: z.string().min(1, "Last name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address").max(255, "Email too long").optional(),
  phone: z.string().min(1, "Phone is required").max(20, "Phone too long"),
  address: z.string().min(1, "Address is required").max(255, "Address too long"),
  city: z.string().max(100, "City too long").optional(),
  state: z.string().max(2, "State code too long").optional(),
  zip_code: z.string().max(10, "Zip code too long").optional(),
  date_of_birth: z.string().optional(),
  emergency_contact_name: z.string().max(100, "Name too long").optional(),
  emergency_contact_phone: z.string().max(20, "Phone too long").optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
});

export const agencyFormSchema = z.object({
  agency_name: z.string().min(1, "Agency name is required").max(200, "Name too long"),
  address: z.string().max(255, "Address too long").optional(),
  city: z.string().max(100, "City too long").optional(),
  state: z.string().max(2, "State code too long").optional(),
  zip_code: z.string().max(10, "Zip code too long").optional(),
  phone: z.string().max(20, "Phone too long").optional(),
  email: z.string().email("Invalid email address").max(255, "Email too long").optional(),
  website: z.string().url("Invalid website URL").max(255, "URL too long").optional().or(z.literal("")),
  naics_code: z.string().max(10, "NAICS code too long").optional(),
  business_type: z.string().max(100, "Business type too long").optional(),
  tax_id: z.string().max(20, "Tax ID too long").optional(),
});

export const careTypeFormSchema = z.object({
  code: z.string().min(1, "Code is required").max(50, "Code too long"),
  category: z.string().min(1, "Category is required").max(100, "Category too long"),
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  keywords: z.string().max(1000, "Keywords too long").optional(),
  price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Price must be a valid positive number",
  }),
  duration: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Duration must be a valid positive number",
  }),
});
