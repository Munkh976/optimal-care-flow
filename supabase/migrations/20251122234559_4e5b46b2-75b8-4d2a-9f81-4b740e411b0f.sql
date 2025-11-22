-- Add missing RLS policies for security

-- Caregiver certifications policies
CREATE POLICY "Agency users can manage certifications" ON public.caregiver_certifications 
FOR ALL USING (EXISTS (SELECT 1 FROM caregivers WHERE caregivers.id = caregiver_certifications.caregiver_id AND caregivers.agency_id = auth.uid()));

-- Client care needs policies
CREATE POLICY "Agency users can manage client care needs" ON public.client_care_needs 
FOR ALL USING (client_id IN (SELECT id FROM clients WHERE agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Clients can manage their own care needs" ON public.client_care_needs 
FOR ALL USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Time off requests policies
CREATE POLICY "Caregivers can view their own time off requests" ON public.time_off_requests 
FOR SELECT USING (caregiver_id IN (SELECT id FROM caregivers WHERE agency_id = auth.uid()));

CREATE POLICY "Caregivers can create time off requests" ON public.time_off_requests 
FOR INSERT WITH CHECK (caregiver_id IN (SELECT id FROM caregivers WHERE agency_id = auth.uid()));

CREATE POLICY "Managers can view time off requests" ON public.time_off_requests 
FOR SELECT USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role) OR has_role(auth.uid(), 'scheduler'::app_role));

CREATE POLICY "Managers can update time off requests" ON public.time_off_requests 
FOR UPDATE USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role));

-- Shift trades policies
CREATE POLICY "Caregivers can create shift trades" ON public.shift_trades 
FOR INSERT WITH CHECK (original_caregiver_id IN (SELECT id FROM caregivers WHERE agency_id = auth.uid()));

CREATE POLICY "Agency users can view shift trades" ON public.shift_trades 
FOR SELECT USING (EXISTS (SELECT 1 FROM caregivers WHERE caregivers.id = shift_trades.original_caregiver_id AND caregivers.agency_id = auth.uid()));

CREATE POLICY "Agency users can update shift trades" ON public.shift_trades 
FOR UPDATE USING (EXISTS (SELECT 1 FROM caregivers WHERE caregivers.id = shift_trades.original_caregiver_id AND caregivers.agency_id = auth.uid()));

-- Caregiver registrations policies
CREATE POLICY "Anyone can create caregiver registration" ON public.caregiver_registrations 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Managers can view caregiver registrations" ON public.caregiver_registrations 
FOR SELECT USING ((agency_id = auth.uid()) OR has_role(auth.uid(), 'system_admin'::app_role));

CREATE POLICY "Managers can update caregiver registrations" ON public.caregiver_registrations 
FOR UPDATE USING ((agency_id = auth.uid()) OR has_role(auth.uid(), 'system_admin'::app_role));

-- System roles policies
CREATE POLICY "Anyone authenticated can view active system roles" ON public.system_roles 
FOR SELECT USING ((is_active = true) AND (auth.uid() IS NOT NULL));

CREATE POLICY "System admins can manage system roles" ON public.system_roles 
FOR ALL USING (has_role(auth.uid(), 'system_admin'::app_role));

-- System modules policies
CREATE POLICY "Anyone authenticated can view active modules" ON public.system_modules 
FOR SELECT USING ((is_active = true) AND (auth.uid() IS NOT NULL));

CREATE POLICY "System admins can manage modules" ON public.system_modules 
FOR ALL USING (has_role(auth.uid(), 'system_admin'::app_role));

-- Role permissions policies
CREATE POLICY "Anyone authenticated can view permissions" ON public.role_permissions 
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System admins can manage permissions" ON public.role_permissions 
FOR ALL USING (has_role(auth.uid(), 'system_admin'::app_role));