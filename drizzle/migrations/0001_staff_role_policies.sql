-- Directory read: all staff
CREATE POLICY "Staff can read profiles" ON public.profiles FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'principal') OR private.has_role(auth.uid(),'bursar') OR private.has_role(auth.uid(),'registrar') OR private.has_role(auth.uid(),'auditor'));
CREATE POLICY "Staff can read student profiles" ON public.student_profiles FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'principal') OR private.has_role(auth.uid(),'bursar') OR private.has_role(auth.uid(),'registrar') OR private.has_role(auth.uid(),'auditor'));
CREATE POLICY "Staff can read parent profiles" ON public.parent_profiles FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'principal') OR private.has_role(auth.uid(),'bursar') OR private.has_role(auth.uid(),'registrar') OR private.has_role(auth.uid(),'auditor'));
CREATE POLICY "Staff can read virtual accounts" ON public.virtual_accounts FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'principal') OR private.has_role(auth.uid(),'bursar') OR private.has_role(auth.uid(),'registrar') OR private.has_role(auth.uid(),'auditor'));
CREATE POLICY "Staff can read roles" ON public.user_roles FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'principal') OR private.has_role(auth.uid(),'bursar') OR private.has_role(auth.uid(),'registrar') OR private.has_role(auth.uid(),'auditor'));

-- Finance read: principal, bursar, auditor
CREATE POLICY "Finance staff can read transactions" ON public.transactions FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'principal') OR private.has_role(auth.uid(),'bursar') OR private.has_role(auth.uid(),'auditor'));
CREATE POLICY "Finance staff can read wallets" ON public.wallets FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'principal') OR private.has_role(auth.uid(),'bursar') OR private.has_role(auth.uid(),'auditor'));
CREATE POLICY "Finance staff can read settlements" ON public.settlements FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'principal') OR private.has_role(auth.uid(),'bursar') OR private.has_role(auth.uid(),'auditor'));
CREATE POLICY "Finance staff can read reconciliation logs" ON public.reconciliation_logs FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'principal') OR private.has_role(auth.uid(),'bursar') OR private.has_role(auth.uid(),'auditor'));

-- Bursar write on finance ops
CREATE POLICY "Bursar can update reconciliation logs" ON public.reconciliation_logs FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(),'bursar')) WITH CHECK (private.has_role(auth.uid(),'bursar'));
CREATE POLICY "Bursar can manage settlements" ON public.settlements FOR ALL TO authenticated
USING (private.has_role(auth.uid(),'bursar')) WITH CHECK (private.has_role(auth.uid(),'bursar'));

-- Audit trail: principal, auditor
CREATE POLICY "Oversight staff can read audit logs" ON public.audit_logs FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'principal') OR private.has_role(auth.uid(),'auditor'));
CREATE POLICY "Auditor can read webhook events" ON public.webhook_events FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'auditor'));

-- Registrar: student/parent records and imports
CREATE POLICY "Registrar can update student profiles" ON public.student_profiles FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(),'registrar')) WITH CHECK (private.has_role(auth.uid(),'registrar'));
CREATE POLICY "Registrar can update parent profiles" ON public.parent_profiles FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(),'registrar')) WITH CHECK (private.has_role(auth.uid(),'registrar'));
CREATE POLICY "Registrar can read staging" ON public.students_import_staging FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'registrar'));
CREATE POLICY "Registrar can update staging" ON public.students_import_staging FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(),'registrar')) WITH CHECK (private.has_role(auth.uid(),'registrar'));
CREATE POLICY "Registrar can delete staging" ON public.students_import_staging FOR DELETE TO authenticated
USING (private.has_role(auth.uid(),'registrar'));