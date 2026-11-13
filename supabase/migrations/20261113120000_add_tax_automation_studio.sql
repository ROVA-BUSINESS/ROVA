-- Migration: Rova Tax Automation Studio Core Schema
-- Authorities, Snapshots, Element Mappings, Workflows, Filing Sessions & Handoffs

CREATE TABLE IF NOT EXISTS public.tax_authorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- e.g. 'LIRS', 'KANO_IRS', 'RIVERS_BIR', 'FCT_IRS', 'NRS_CIT'
    name TEXT NOT NULL,
    official_url TEXT NOT NULL,
    tax_type TEXT NOT NULL CHECK (tax_type IN ('PIT', 'CIT')),
    jurisdiction TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial tax authorities
INSERT INTO public.tax_authorities (code, name, official_url, tax_type, jurisdiction, description)
VALUES 
    ('LIRS', 'Lagos State Internal Revenue Service', 'https://etax.lirs.net/', 'PIT', 'Lagos State', 'Personal Income Tax and Direct Assessment for Lagos residents and enterprise owners.'),
    ('KANO_IRS', 'Kano State Internal Revenue Service', 'https://kanoirs.gov.ng/', 'PIT', 'Kano State', 'Personal Income Tax and self-assessment for Kano residents.'),
    ('RIVERS_BIR', 'Rivers State Board of Internal Revenue', 'https://riversbirs.gov.ng/', 'PIT', 'Rivers State', 'Personal Income Tax and RIV-TIN assessment for Rivers State residents.'),
    ('FCT_IRS', 'Federal Capital Territory Internal Revenue Service', 'https://fctirs.gov.ng/', 'PIT', 'Federal Capital Territory (Abuja)', 'Personal Income Tax for residents of Abuja FCT.'),
    ('NRS_CIT', 'Nigeria Revenue Service (NRS / FIRS)', 'https://selfservice.nrs.gov.ng/', 'CIT', 'Federal (Nigeria)', 'Federal Company Income Tax (CIT) administered by the federal tax authority (distinct from CAC).')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    official_url = EXCLUDED.official_url,
    tax_type = EXCLUDED.tax_type,
    jurisdiction = EXCLUDED.jurisdiction;

-- 2. Portal Snapshots / Saved HTML representations
CREATE TABLE IF NOT EXISTS public.tax_portal_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id UUID NOT NULL REFERENCES public.tax_authorities(id) ON DELETE CASCADE,
    page_name TEXT NOT NULL, -- e.g. "Login", "Taxpayer Search", "Direct Assessment Form"
    page_url TEXT,
    raw_html TEXT,
    parsed_metadata JSONB DEFAULT '{}'::jsonb, -- Forms, inputs, buttons, selects
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_portal_snapshots_auth ON public.tax_portal_snapshots(authority_id);

-- 3. Element Mappings & Interaction Rules
CREATE TABLE IF NOT EXISTS public.tax_element_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES public.tax_portal_snapshots(id) ON DELETE CASCADE,
    element_key TEXT NOT NULL, -- Unique identifier within the snapshot
    label TEXT,
    selector_primary TEXT NOT NULL,
    selector_fallbacks JSONB DEFAULT '[]'::jsonb,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'AI_FILL',
        'CUSTOMER_FILL',
        'AI_CLICK',
        'CUSTOMER_APPROVAL',
        'SKIP',
        'ASK_CUSTOMER',
        'PAUSE'
    )),
    field_binding TEXT, -- Maps to Rova customer profile or tax calculation output
    is_sensitive BOOLEAN NOT NULL DEFAULT false, -- True for BVN, NIN, password, OTP
    help_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tax_element_snapshot_key UNIQUE (snapshot_id, element_key)
);

CREATE INDEX IF NOT EXISTS idx_tax_element_mappings_snapshot ON public.tax_element_mappings(snapshot_id);

-- 4. Tax Filing Workflows
CREATE TABLE IF NOT EXISTS public.tax_filing_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id UUID NOT NULL REFERENCES public.tax_authorities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'TESTING', 'PUBLISHED', 'ARCHIVED')),
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_workflows_authority ON public.tax_filing_workflows(authority_id, status);

-- 5. Customer Tax Filing Sessions
CREATE TABLE IF NOT EXISTS public.tax_filing_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    authority_id UUID NOT NULL REFERENCES public.tax_authorities(id),
    workflow_id UUID REFERENCES public.tax_filing_workflows(id),
    tax_year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'IDLE' CHECK (status IN (
        'IDLE',
        'INITIALIZING',
        'RUNNING',
        'WAITING_CUSTOMER',
        'CUSTOMER_TAKEOVER',
        'REVIEW_READY',
        'SUBMITTED',
        'FAILED',
        'CANCELLED'
    )),
    current_step_index INTEGER NOT NULL DEFAULT 0,
    session_token TEXT,
    live_stream_ws_url TEXT,
    last_frame_url TEXT,
    masked_state JSONB DEFAULT '{}'::jsonb,
    logs JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_filing_sessions_user ON public.tax_filing_sessions(user_id, status);

-- 6. Customer Handoff Requests (BVN, NIN, OTP, Passwords)
CREATE TABLE IF NOT EXISTS public.tax_filing_handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.tax_filing_sessions(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    handoff_type TEXT NOT NULL CHECK (handoff_type IN ('OTP', 'PASSWORD', 'BVN', 'NIN', 'DOCUMENT', 'APPROVAL')),
    prompt_message TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_handoffs_session ON public.tax_filing_handoffs(session_id, status);

-- Enable RLS
ALTER TABLE public.tax_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_portal_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_element_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_filing_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_filing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_filing_handoffs ENABLE ROW LEVEL SECURITY;

-- Read policies for authorities and published workflows
CREATE POLICY "Public read active tax authorities" ON public.tax_authorities FOR SELECT USING (is_active = true);
CREATE POLICY "Admin manage tax authorities" ON public.tax_authorities FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manage portal snapshots" ON public.tax_portal_snapshots FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage element mappings" ON public.tax_element_mappings FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage workflows" ON public.tax_filing_workflows FOR ALL USING (auth.uid() IS NOT NULL);

-- Session policies for users
CREATE POLICY "Users can manage own filing sessions" ON public.tax_filing_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own filing handoffs" ON public.tax_filing_handoffs FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tax_filing_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
