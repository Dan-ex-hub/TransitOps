
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TYPE public.app_role AS ENUM ('admin','manager','driver','viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.can_manage(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_role(_user_id,'manager')
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  model TEXT,
  type TEXT NOT NULL,
  max_load_capacity NUMERIC NOT NULL DEFAULT 0,
  odometer NUMERIC NOT NULL DEFAULT 0,
  acquisition_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  region TEXT NOT NULL DEFAULT 'West',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles readable" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicles manage" ON public.vehicles FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  license_number TEXT NOT NULL UNIQUE,
  license_category TEXT NOT NULL DEFAULT 'HGV',
  license_expiry_date DATE NOT NULL,
  contact_number TEXT,
  safety_score NUMERIC NOT NULL DEFAULT 80,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers readable" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "drivers manage" ON public.drivers FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_region TEXT,
  destination TEXT NOT NULL,
  destination_region TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  cargo_weight NUMERIC NOT NULL DEFAULT 0,
  planned_distance NUMERIC NOT NULL DEFAULT 0,
  actual_distance NUMERIC,
  fuel_consumed NUMERIC,
  revenue NUMERIC,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips readable" ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY "trips manage" ON public.trips FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  liters NUMERIC NOT NULL,
  cost NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  anomaly_flag BOOLEAN NOT NULL DEFAULT FALSE,
  anomaly_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_logs TO authenticated;
GRANT ALL ON public.fuel_logs TO service_role;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel readable" ON public.fuel_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "fuel manage" ON public.fuel_logs FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER trg_fuel_updated BEFORE UPDATE ON public.fuel_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_logs TO authenticated;
GRANT ALL ON public.maintenance_logs TO service_role;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maint readable" ON public.maintenance_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "maint manage" ON public.maintenance_logs FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER trg_maint_updated BEFORE UPDATE ON public.maintenance_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed vehicles
INSERT INTO public.vehicles (registration_number, name, model, type, max_load_capacity, odometer, acquisition_cost, status, region) VALUES
('MH-01-AB-1234','Falcon 01','Tata Prima 4028.S','Heavy Truck',28000,124500,3800000,'ON_TRIP','West'),
('MH-04-CD-5678','Falcon 02','Ashok Leyland 3520','Heavy Truck',35000,89230,4200000,'AVAILABLE','West'),
('DL-08-EF-9012','Kestrel 01','Eicher Pro 6028','Medium Truck',18000,56100,2400000,'ON_TRIP','North'),
('KA-05-GH-3456','Kestrel 02','BharatBenz 1617R','Medium Truck',16000,72400,2200000,'IN_SHOP','South'),
('TN-11-IJ-7890','Sparrow 01','Tata Ace Gold','Light Truck',800,34200,650000,'AVAILABLE','South'),
('GJ-01-KL-2345','Sparrow 02','Mahindra Bolero Pik-Up','Light Truck',1200,45900,780000,'ON_TRIP','West'),
('HR-26-MN-6789','Cargo 01','Volvo FM 460','Heavy Truck',40000,156800,5200000,'AVAILABLE','North'),
('MH-12-OP-4567','Cargo 02','Scania G410','Heavy Truck',40000,98700,5400000,'RETIRED','West');

INSERT INTO public.drivers (name, license_number, license_category, license_expiry_date, contact_number, safety_score, status) VALUES
('Rajesh Kumar','MH0120220001234','HGV','2027-08-14','+91 98200 12345',92,'ON_TRIP'),
('Priya Sharma','DL0820210005678','HGV','2026-11-22','+91 98111 23456',88,'AVAILABLE'),
('Amit Patel','GJ0120230009012','HGV','2028-03-05','+91 98240 34567',85,'ON_TRIP'),
('Sunita Reddy','KA0520220003456','MGV','2027-06-18','+91 98450 45678',94,'AVAILABLE'),
('Vikram Singh','HR2620210007890','HGV','2026-09-30','+91 98120 56789',78,'OFF_DUTY'),
('Neha Iyer','TN1120230002345','LGV','2028-01-12','+91 98410 67890',90,'ON_TRIP'),
('Manoj Verma','MH0420220006789','HGV','2027-04-25','+91 98220 78901',82,'AVAILABLE'),
('Kavita Nair','KL0720210001234','MGV','2026-12-08','+91 98470 89012',87,'SUSPENDED');

INSERT INTO public.trips (source, source_region, destination, destination_region, vehicle_id, driver_id, cargo_weight, planned_distance, actual_distance, fuel_consumed, revenue, status, dispatched_at, completed_at)
SELECT t.source, t.source_region, t.destination, t.destination_region,
       (SELECT id FROM public.vehicles ORDER BY random() LIMIT 1),
       (SELECT id FROM public.drivers ORDER BY random() LIMIT 1),
       t.cargo_weight, t.planned_distance, t.actual_distance, t.fuel_consumed, t.revenue, t.status, t.dispatched_at, t.completed_at
FROM (VALUES
  ('Mumbai','West','Pune','West',22000::numeric,148::numeric,151::numeric,42::numeric,58000::numeric,'COMPLETED', now() - interval '2 days', now() - interval '2 days' + interval '5 hours'),
  ('Delhi','North','Jaipur','North',15000,281,NULL,NULL,NULL,'DISPATCHED', now() - interval '4 hours', NULL),
  ('Bangalore','South','Chennai','South',12000,347,NULL,NULL,NULL,'DISPATCHED', now() - interval '8 hours', NULL),
  ('Mumbai','West','Ahmedabad','West',26000,524,532,168,148000,'COMPLETED', now() - interval '3 days', now() - interval '2 days' - interval '6 hours'),
  ('Chennai','South','Hyderabad','South',900,626,NULL,NULL,NULL,'DISPATCHED', now() - interval '12 hours', NULL),
  ('Pune','West','Nashik','West',18000,210,215,64,72000,'COMPLETED', now() - interval '1 day', now() - interval '1 day' + interval '4 hours'),
  ('Delhi','North','Chandigarh','North',30000,244,NULL,NULL,NULL,'DISPATCHED', now() - interval '2 hours', NULL),
  ('Bangalore','South','Mysuru','South',1000,145,NULL,NULL,NULL,'DRAFT', NULL, NULL)
) AS t(source, source_region, destination, destination_region, cargo_weight, planned_distance, actual_distance, fuel_consumed, revenue, status, dispatched_at, completed_at);

INSERT INTO public.fuel_logs (vehicle_id, liters, cost, date, anomaly_flag, anomaly_reason)
SELECT v.id, l.liters, l.cost, l.d::date, l.flag, l.reason FROM public.vehicles v
CROSS JOIN LATERAL (VALUES
  (120::numeric, 11400::numeric, (now() - interval '1 day')::timestamptz, false, NULL::text),
  (180::numeric, 17100::numeric, (now() - interval '2 days')::timestamptz, true, 'Efficiency below fleet baseline'::text),
  (95::numeric, 9025::numeric, (now() - interval '3 days')::timestamptz, false, NULL::text)
) AS l(liters, cost, d, flag, reason)
WHERE v.status <> 'RETIRED';

INSERT INTO public.maintenance_logs (vehicle_id, description, cost, status, start_date, end_date)
SELECT id, 'Scheduled 20,000 km service', 18500, 'CLOSED', CURRENT_DATE - 15, CURRENT_DATE - 12 FROM public.vehicles WHERE status = 'AVAILABLE' LIMIT 2;
INSERT INTO public.maintenance_logs (vehicle_id, description, cost, status, start_date)
SELECT id, 'Brake system inspection & pad replacement', 8200, 'ACTIVE', CURRENT_DATE - 2 FROM public.vehicles WHERE status = 'IN_SHOP' LIMIT 1;
