
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  actor_id UUID,
  actor_email TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX audit_logs_table_created_idx ON public.audit_logs (table_name, created_at DESC);
CREATE INDEX audit_logs_record_idx ON public.audit_logs (record_id);

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  uemail TEXT;
  rec_id UUID;
BEGIN
  BEGIN
    SELECT email INTO uemail FROM auth.users WHERE id = uid;
  EXCEPTION WHEN OTHERS THEN uemail := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    rec_id := (row_to_json(OLD)->>'id')::uuid;
    INSERT INTO public.audit_logs (table_name, record_id, action, actor_id, actor_email, old_data)
    VALUES (TG_TABLE_NAME, rec_id, 'DELETE', uid, uemail, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    rec_id := (row_to_json(NEW)->>'id')::uuid;
    INSERT INTO public.audit_logs (table_name, record_id, action, actor_id, actor_email, old_data, new_data)
    VALUES (TG_TABLE_NAME, rec_id, 'UPDATE', uid, uemail, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    rec_id := (row_to_json(NEW)->>'id')::uuid;
    INSERT INTO public.audit_logs (table_name, record_id, action, actor_id, actor_email, new_data)
    VALUES (TG_TABLE_NAME, rec_id, 'INSERT', uid, uemail, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER audit_vehicles AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_drivers AFTER INSERT OR UPDATE OR DELETE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_trips AFTER INSERT OR UPDATE OR DELETE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_fuel_logs AFTER INSERT OR UPDATE OR DELETE ON public.fuel_logs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_maintenance_logs AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Allow profile updates by owner
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
