-- ============================================================================
-- LeadForge AI - Complete PostgreSQL Schema
-- Multi-tenant B2B Lead Generation SaaS
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- GLOBAL TABLES (No RLS)
-- ============================================================================

-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'starter',
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Plans
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_users INT NOT NULL,
  max_leads INT NOT NULL,
  max_ai_calls INT NOT NULL,
  features JSONB DEFAULT '{}',
  price_inr INT NOT NULL
);

-- Sectors (global reference table - shared across all tenants)
CREATE TABLE sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  ai_persona TEXT,
  pain_points TEXT[],
  value_props TEXT[]
);

-- ============================================================================
-- TENANT-SCOPED TABLES (All have tenant_id + RLS)
-- ============================================================================

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- Pipeline Stages
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INT NOT NULL,
  color TEXT,
  is_default BOOLEAN DEFAULT false
);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sector_code TEXT NOT NULL REFERENCES sectors(code),
  company_name TEXT NOT NULL,
  industry TEXT,
  sub_industry TEXT,
  state TEXT DEFAULT 'Tamil Nadu',
  district TEXT,
  city TEXT,
  address TEXT,
  pincode TEXT,
  website TEXT,
  company_size TEXT,
  annual_revenue_inr BIGINT,
  contact_name TEXT,
  designation TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  lead_score INT DEFAULT 50,
  score_reason TEXT,
  icp_match TEXT,
  ai_summary TEXT,
  stage TEXT DEFAULT 'new',
  assigned_to UUID REFERENCES users(id),
  tags TEXT[],
  source TEXT,
  custom_fields JSONB DEFAULT '{}',
  last_contacted TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sector_codes TEXT[],
  status TEXT DEFAULT 'draft',
  channel TEXT DEFAULT 'email',
  segment_filter JSONB DEFAULT '{}',
  daily_limit INT DEFAULT 100,
  ai_tone TEXT DEFAULT 'professional',
  created_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Campaign Steps
CREATE TABLE campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  channel TEXT,
  delay_days INT DEFAULT 0,
  subject TEXT,
  body TEXT,
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Outreach Log
CREATE TABLE outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id),
  step_id UUID REFERENCES campaign_steps(id),
  lead_id UUID REFERENCES leads(id),
  channel TEXT,
  recipient TEXT,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  error_msg TEXT,
  message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI Interactions
CREATE TABLE ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  lead_id UUID REFERENCES leads(id),
  type TEXT,
  prompt_tokens INT,
  completion_tokens INT,
  model TEXT,
  input_summary TEXT,
  output_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activities
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  user_id UUID REFERENCES users(id),
  type TEXT,
  note TEXT,
  outcome TEXT,
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Deals
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  stage_id UUID REFERENCES pipeline_stages(id),
  assigned_to UUID REFERENCES users(id),
  title TEXT,
  value_inr INT,
  close_date DATE,
  probability INT DEFAULT 20,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT,
  key_hash TEXT NOT NULL,
  last_used TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leads
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaigns
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE campaign_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaign_steps
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE outreach_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON outreach_log
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_interactions
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON activities
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON deals
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pipeline_stages
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON api_keys
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Tenant ID indexes for all tenant-scoped tables
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaign_steps_tenant ON campaign_steps(tenant_id);
CREATE INDEX idx_outreach_log_tenant ON outreach_log(tenant_id);
CREATE INDEX idx_ai_interactions_tenant ON ai_interactions(tenant_id);
CREATE INDEX idx_activities_tenant ON activities(tenant_id);
CREATE INDEX idx_deals_tenant ON deals(tenant_id);
CREATE INDEX idx_pipeline_stages_tenant ON pipeline_stages(tenant_id);
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);

-- Business logic indexes
CREATE INDEX idx_leads_sector_code ON leads(sector_code);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_lead_score ON leads(lead_score);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_outreach_log_lead ON outreach_log(lead_id);
CREATE INDEX idx_outreach_log_status ON outreach_log(status);
CREATE INDEX idx_activities_lead ON activities(lead_id);
CREATE INDEX idx_deals_stage ON deals(stage_id);

-- Full-text search on leads
CREATE INDEX idx_leads_search ON leads USING gin(
  to_tsvector('english',
    coalesce(company_name, '') || ' ' ||
    coalesce(contact_name, '') || ' ' ||
    coalesce(industry, '') || ' ' ||
    coalesce(city, '')
  )
);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Plans
INSERT INTO plans (name, max_users, max_leads, max_ai_calls, features, price_inr) VALUES
('starter', 3, 1000, 500, '{"analytics": "basic", "integrations": false, "api_access": false}', 0),
('growth', 10, 10000, 5000, '{"analytics": "advanced", "integrations": true, "api_access": true, "custom_branding": false}', 4999),
('enterprise', 999999, 100000, 50000, '{"analytics": "advanced", "integrations": true, "api_access": true, "custom_branding": true, "sla": true, "dedicated_support": true}', 14999);

-- Sectors
INSERT INTO sectors (code, name, icon, description, ai_persona, pain_points, value_props) VALUES
(
  'it_ites',
  'Technology & Information Services',
  'Monitor',
  'IT companies, software firms, ITES/BPO, SaaS providers and tech startups across India.',
  'Expert B2B sales consultant specializing in Technology & Information Services in India. You understand software development cycles, SaaS metrics, IT outsourcing trends, and digital transformation challenges faced by Indian tech companies.',
  ARRAY['Long sales cycles with enterprise clients', 'Difficulty reaching CTO/CIO-level decision makers', 'High competition from global IT vendors', 'Talent acquisition and retention challenges', 'Converting free/trial users to paid plans'],
  ARRAY['AI-powered lead scoring to prioritize high-intent prospects', 'Automated multi-channel outreach to technical decision makers', 'Industry-specific email templates that resonate with IT buyers', 'Integration with CRM and project management tools', 'Data-driven insights on technology adoption trends']
),
(
  'agriculture',
  'Agriculture & Allied Sectors',
  'Sprout',
  'Agribusinesses, farm equipment suppliers, agri-tech startups, food processing and allied agricultural sectors.',
  'Expert B2B sales consultant specializing in Agriculture & Allied Sectors in India. You understand crop cycles, farm mechanization, agri-supply chains, government subsidy schemes, and the unique challenges of selling to rural and semi-urban agricultural businesses.',
  ARRAY['Seasonal buying patterns and cash-flow constraints', 'Fragmented market with small-to-medium farm operators', 'Low digital adoption among traditional agri-businesses', 'Complex government subsidy and compliance processes', 'Difficulty in reaching decision makers in rural areas'],
  ARRAY['Geo-targeted lead generation across agricultural districts', 'Season-aware campaign scheduling aligned to crop cycles', 'Vernacular outreach support for regional engagement', 'Lead enrichment with land holding and crop pattern data', 'Government scheme eligibility mapping for prospects']
),
(
  'manufacturing',
  'Manufacturing Companies',
  'Factory',
  'Manufacturing units, industrial suppliers, OEMs, fabrication, and process industries across India.',
  'Expert B2B sales consultant specializing in Manufacturing in India. You understand production planning, supply chain management, quality certifications (ISO, BIS), and the operational challenges of Indian manufacturing businesses.',
  ARRAY['Identifying the right procurement and plant managers', 'Long approval processes with multiple stakeholders', 'Price-sensitive buyers comparing many vendors', 'Quality certification and compliance requirements', 'Supply chain disruptions impacting buying decisions'],
  ARRAY['Firmographic data to identify manufacturing decision makers', 'Multi-touch campaigns targeting procurement committees', 'Industry-specific content addressing compliance needs', 'AI-generated proposals tailored to manufacturing pain points', 'Automated follow-up sequences for long sales cycles']
),
(
  'education',
  'Education - Schools, Colleges & Training',
  'GraduationCap',
  'Schools (K-12), colleges, universities, ed-tech companies, coaching centres, and corporate training providers.',
  'Expert B2B sales consultant specializing in Education in India. You understand academic calendars, NEP 2020 requirements, ed-tech adoption trends, and the decision-making processes of educational institutions.',
  ARRAY['Budget constraints and lengthy procurement cycles', 'Academic calendar-driven buying windows', 'Multiple decision makers (principal, management, trustees)', 'Resistance to technology adoption in traditional institutions', 'High competition from free and low-cost ed-tech solutions'],
  ARRAY['Academic calendar-aware campaign timing', 'Decision-maker mapping across institution hierarchies', 'NEP 2020 compliance-focused messaging templates', 'Lead scoring based on institution size and tech readiness', 'Automated nurture sequences for budget approval cycles']
),
(
  'marketing_media',
  'Marketing, Media & Services',
  'Megaphone',
  'Advertising agencies, digital marketing firms, media houses, PR agencies, and creative services companies.',
  'Expert B2B sales consultant specializing in Marketing, Media & Services in India. You understand campaign ROI metrics, digital marketing trends, content strategies, and the competitive dynamics of the Indian marketing and media landscape.',
  ARRAY['High client churn and short contract durations', 'Difficulty demonstrating measurable ROI', 'Rapidly changing digital marketing landscape', 'Competition from freelancers and boutique agencies', 'Budget constraints from SME clients'],
  ARRAY['Agency-specific lead scoring based on client portfolio size', 'Automated outreach to marketing directors and CMOs', 'ROI-focused email templates with case study integration', 'Competitive intelligence on agency-client relationships', 'AI-powered pitch deck content generation']
),
(
  'finance_professional',
  'Finance & Professional Services',
  'Landmark',
  'Banks, NBFCs, insurance companies, CA/CS firms, legal practices, and financial advisory services.',
  'Expert B2B sales consultant specializing in Finance & Professional Services in India. You understand RBI regulations, SEBI compliance, GST implications, and the trust-driven sales process typical in financial and professional services.',
  ARRAY['Strict regulatory compliance requirements (RBI, SEBI, IRDAI)', 'High trust barrier in financial services sales', 'Complex product comparison and due diligence process', 'Difficulty reaching C-suite in regulated entities', 'Data privacy and security concerns'],
  ARRAY['Compliance-aware outreach templates for regulated industries', 'Trust-building multi-touch nurture campaigns', 'Lead enrichment with financial health and regulatory data', 'AI-generated content that respects regulatory language requirements', 'Secure data handling aligned with RBI/SEBI data guidelines']
),
(
  'construction_real_estate',
  'Construction & Real Estate',
  'Building',
  'Construction firms, real estate developers, architects, interior designers, and building material suppliers.',
  'Expert B2B sales consultant specializing in Construction & Real Estate in India. You understand RERA regulations, project lifecycle stages, material procurement patterns, and the relationship-driven nature of real estate business development.',
  ARRAY['Project-based and cyclical buying patterns', 'Difficulty tracking decision makers across project sites', 'RERA compliance and documentation overhead', 'Fragmented vendor ecosystem with local preferences', 'Cash flow challenges tied to project milestones'],
  ARRAY['Project lifecycle-aware lead engagement timing', 'Site-level decision maker identification and mapping', 'RERA-compliant communication templates', 'Material requirement forecasting based on project stage', 'Automated follow-ups aligned to construction milestones']
),
(
  'retail_ecommerce',
  'Retail & E-commerce',
  'ShoppingCart',
  'Retail chains, D2C brands, e-commerce platforms, distributors, and omnichannel retail businesses.',
  'Expert B2B sales consultant specializing in Retail & E-commerce in India. You understand omnichannel retail trends, D2C growth strategies, inventory management challenges, and the competitive dynamics of the Indian retail market.',
  ARRAY['Thin margins requiring high-volume lead generation', 'Rapid trend shifts and seasonal demand volatility', 'Difficulty differentiating from marketplace competition', 'Complex multi-channel inventory and fulfillment', 'Price-sensitive customers demanding instant gratification'],
  ARRAY['High-volume lead generation with e-commerce intent signals', 'Seasonal campaign automation for festive and sale periods', 'D2C brand outreach with personalized product pitches', 'Integration with Shopify, WooCommerce, and marketplace data', 'AI-powered discount and offer strategy recommendations']
),
(
  'energy_utilities',
  'Energy & Utilities',
  'Zap',
  'Power companies, renewable energy firms, solar installers, EV charging providers, and utility service companies.',
  'Expert B2B sales consultant specializing in Energy & Utilities in India. You understand government renewable energy policies, solar subsidy programs, EV infrastructure plans, and the regulatory framework governing Indian energy and utility businesses.',
  ARRAY['Long government procurement and approval cycles', 'Complex subsidy and policy compliance requirements', 'High upfront capital requirements for projects', 'Technical decision makers requiring deep domain expertise', 'Grid connectivity and infrastructure dependency challenges'],
  ARRAY['Government tender and policy tracking for timely outreach', 'Technical decision maker identification in energy companies', 'Subsidy and incentive-aware proposal generation', 'Project feasibility data enrichment for lead qualification', 'AI-powered technical content for energy sector engagement']
);

-- Demo Tenant
INSERT INTO tenants (id, name, slug, plan, is_active, settings) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'LeadForge Demo', 'demo', 'growth', true, '{"theme": "default", "timezone": "Asia/Kolkata"}');

-- Default Pipeline Stages for Demo Tenant
INSERT INTO pipeline_stages (tenant_id, name, order_index, color, is_default) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Qualification', 1, '#3B82F6', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Discovery', 2, '#8B5CF6', false),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Proposal', 3, '#F59E0B', false),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Negotiation', 4, '#EF4444', false),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Closed Won', 5, '#10B981', false),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Closed Lost', 6, '#6B7280', false);

-- Demo Admin User (password: admin123)
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active) VALUES
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
 'admin@leadforge.ai', '$2b$12$LJ3m4ys3Lk0TSwHBGOGKneFGxGiAUMFpMQEarlNXqTKATa/GhJnGy',
 'Admin User', 'admin', true);

-- ============================================================================
-- SAMPLE LEADS (5 per sector, 45 total - Tamil Nadu, India)
-- ============================================================================

-- IT & ITES (5 leads)
INSERT INTO leads (tenant_id, sector_code, company_name, industry, sub_industry, city, district, pincode, website, company_size, annual_revenue_inr, contact_name, designation, email, phone, lead_score, stage, source, tags) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'it_ites', 'Zoho Corporation', 'Information Technology', 'SaaS Products', 'Chennai', 'Chennai', '600096', 'https://www.zoho.com', '5000-10000', 50000000000, 'Rajesh Ganesan', 'VP of Engineering', 'rajesh.g@zoho.com', '+919840012345', 85, 'qualified', 'website', ARRAY['enterprise', 'saas', 'high-value']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'it_ites', 'Freshworks Inc', 'Information Technology', 'Customer Engagement', 'Chennai', 'Chennai', '600032', 'https://www.freshworks.com', '1000-5000', 30000000000, 'Anitha Ramachandran', 'Director of Sales', 'anitha.r@freshworks.com', '+919841123456', 78, 'contacted', 'linkedin', ARRAY['saas', 'growth-stage']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'it_ites', 'Kovai.co (Document360)', 'Information Technology', 'Knowledge Management', 'Coimbatore', 'Coimbatore', '641014', 'https://www.kovai.co', '200-500', 5000000000, 'Saravana Kumar', 'CEO', 'saravana@kovai.co', '+919842234567', 72, 'new', 'referral', ARRAY['startup', 'knowledge-mgmt']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'it_ites', 'Intellect Design Arena', 'Information Technology', 'FinTech Solutions', 'Chennai', 'Chennai', '600034', 'https://www.intellectdesign.com', '1000-5000', 15000000000, 'Deepak Kathuria', 'CTO', 'deepak.k@intellectdesign.com', '+919843345678', 65, 'new', 'event', ARRAY['fintech', 'enterprise']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'it_ites', 'KaarTech Solutions', 'Information Technology', 'SAP Consulting', 'Coimbatore', 'Coimbatore', '641018', 'https://www.kaartech.com', '500-1000', 8000000000, 'Mani Parthasarathy', 'Head of Business Development', 'mani.p@kaartech.com', '+919844456789', 60, 'new', 'cold-outreach', ARRAY['consulting', 'sap']);

-- Agriculture & Allied Sectors (5 leads)
INSERT INTO leads (tenant_id, sector_code, company_name, industry, sub_industry, city, district, pincode, website, company_size, annual_revenue_inr, contact_name, designation, email, phone, lead_score, stage, source, tags) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'agriculture', 'Coromandel International', 'Agriculture', 'Fertilizers & Pesticides', 'Chennai', 'Chennai', '600002', 'https://www.coromandel.biz', '1000-5000', 200000000000, 'Venkatesh Iyer', 'Regional Sales Manager', 'venkatesh.i@coromandel.biz', '+919845567890', 80, 'qualified', 'trade-show', ARRAY['fertilizers', 'large-enterprise']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'agriculture', 'Tafe Motors and Tractors', 'Agriculture', 'Farm Equipment', 'Chennai', 'Chennai', '600003', 'https://www.tafe.com', '5000-10000', 120000000000, 'Suresh Balaji', 'VP Sales - South', 'suresh.b@tafe.com', '+919846678901', 75, 'contacted', 'referral', ARRAY['tractors', 'equipment']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'agriculture', 'CropIn Technology', 'Agriculture', 'Agri-Tech', 'Madurai', 'Madurai', '625001', 'https://www.cropin.com', '200-500', 2000000000, 'Priya Narayanan', 'Business Development Lead', 'priya.n@cropin.com', '+919847789012', 68, 'new', 'website', ARRAY['agri-tech', 'startup']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'agriculture', 'Salem Agro Industries', 'Agriculture', 'Food Processing', 'Salem', 'Salem', '636001', 'https://www.salemagro.in', '50-200', 500000000, 'Murugan Krishnan', 'Managing Director', 'murugan@salemagro.in', '+919848890123', 55, 'new', 'cold-outreach', ARRAY['food-processing', 'sme']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'agriculture', 'TN Dairy Federation (Aavin)', 'Agriculture', 'Dairy & Allied', 'Tirunelveli', 'Tirunelveli', '627001', 'https://www.aavin.tn.gov.in', '1000-5000', 50000000000, 'Lakshmi Devi', 'Procurement Officer', 'lakshmi.d@aavin.tn.in', '+919849901234', 62, 'new', 'government-listing', ARRAY['dairy', 'government']);

-- Manufacturing (5 leads)
INSERT INTO leads (tenant_id, sector_code, company_name, industry, sub_industry, city, district, pincode, website, company_size, annual_revenue_inr, contact_name, designation, email, phone, lead_score, stage, source, tags) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'manufacturing', 'Ashok Leyland', 'Manufacturing', 'Automotive', 'Chennai', 'Chennai', '600086', 'https://www.ashokleyland.com', '10000+', 300000000000, 'Gopal Mahadevan', 'CFO', 'gopal.m@ashokleyland.com', '+919850012345', 88, 'qualified', 'event', ARRAY['automotive', 'large-enterprise', 'high-value']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'manufacturing', 'Saint-Gobain India (Grindwell)', 'Manufacturing', 'Building Materials', 'Chennai', 'Chennai', '600034', 'https://www.saint-gobain-india.com', '5000-10000', 150000000000, 'Ramya Santhanam', 'Head of Procurement', 'ramya.s@saint-gobain.com', '+919851123456', 76, 'contacted', 'trade-show', ARRAY['building-materials', 'mnc']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'manufacturing', 'Pricol Limited', 'Manufacturing', 'Auto Components', 'Coimbatore', 'Coimbatore', '641028', 'https://www.pricol.com', '1000-5000', 25000000000, 'Vikram Mohan', 'Managing Director', 'vikram.m@pricol.com', '+919852234567', 70, 'new', 'linkedin', ARRAY['auto-parts', 'mid-market']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'manufacturing', 'Karpagam Spinners', 'Manufacturing', 'Textiles', 'Tirupur', 'Tirupur', '641604', 'https://www.karpagamspinners.com', '500-1000', 8000000000, 'Senthil Kumar', 'General Manager', 'senthil.k@karpagamspinners.com', '+919853345678', 58, 'new', 'industry-directory', ARRAY['textiles', 'tirupur']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'manufacturing', 'Sakthi Sugars', 'Manufacturing', 'Sugar & Distillery', 'Sivaganga', 'Sivaganga', '630001', 'https://www.sakthisugars.com', '1000-5000', 18000000000, 'Balasubramanian V', 'Plant Head', 'bala.v@sakthisugars.com', '+919854456789', 52, 'new', 'cold-outreach', ARRAY['sugar', 'fmcg']);

-- Education (5 leads)
INSERT INTO leads (tenant_id, sector_code, company_name, industry, sub_industry, city, district, pincode, website, company_size, annual_revenue_inr, contact_name, designation, email, phone, lead_score, stage, source, tags) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'education', 'SRM Institute of Science and Technology', 'Education', 'Higher Education', 'Chennai', 'Kancheepuram', '603203', 'https://www.srmist.edu.in', '5000-10000', 20000000000, 'Dr. Santhosh Kumar', 'Dean - Academics', 'santhosh.k@srmist.edu.in', '+919855567890', 74, 'contacted', 'event', ARRAY['university', 'large-institution']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'education', 'Amrita Vishwa Vidyapeetham', 'Education', 'Deemed University', 'Coimbatore', 'Coimbatore', '641112', 'https://www.amrita.edu', '5000-10000', 15000000000, 'Prof. Meenakshi Raman', 'Registrar', 'meenakshi.r@amrita.edu', '+919856678901', 70, 'new', 'referral', ARRAY['university', 'tech-focused']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'education', 'NIIT Learning Systems', 'Education', 'Corporate Training', 'Chennai', 'Chennai', '600017', 'https://www.niit.com', '1000-5000', 8000000000, 'Arvind Thakur', 'Regional Director - South', 'arvind.t@niit.com', '+919857789012', 65, 'new', 'website', ARRAY['edtech', 'corporate-training']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'education', 'Velammal Educational Trust', 'Education', 'K-12 Schools', 'Madurai', 'Madurai', '625009', 'https://www.velammal.com', '1000-5000', 5000000000, 'Selvi Mohan', 'Chief Administrator', 'selvi.m@velammal.com', '+919858890123', 58, 'new', 'cold-outreach', ARRAY['k12', 'school-chain']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'education', 'Trichy Coaching Academy', 'Education', 'Coaching & Test Prep', 'Trichy', 'Tiruchirappalli', '620001', 'https://www.trichycoaching.in', '50-200', 200000000, 'Raghavan Subramanian', 'Founder & Director', 'raghavan@trichycoaching.in', '+919859901234', 45, 'new', 'google-ads', ARRAY['coaching', 'sme']);

-- Marketing, Media & Services (5 leads)
INSERT INTO leads (tenant_id, sector_code, company_name, industry, sub_industry, city, district, pincode, website, company_size, annual_revenue_inr, contact_name, designation, email, phone, lead_score, stage, source, tags) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'marketing_media', 'Vikatan Group', 'Media', 'Publishing & Digital Media', 'Chennai', 'Chennai', '600010', 'https://www.vikatan.com', '500-1000', 3000000000, 'Shanmugam B', 'Digital Head', 'shanmugam.b@vikatan.com', '+919860012345', 72, 'contacted', 'linkedin', ARRAY['media', 'tamil-market']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'marketing_media', 'Social Beat Digital Marketing', 'Marketing', 'Digital Marketing Agency', 'Chennai', 'Chennai', '600018', 'https://www.socialbeat.in', '50-200', 500000000, 'Vikas Chawla', 'Co-Founder', 'vikas@socialbeat.in', '+919861123456', 67, 'new', 'referral', ARRAY['agency', 'digital-marketing']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'marketing_media', 'FoxyMoron (Zoo Media)', 'Marketing', 'Creative Agency', 'Chennai', 'Chennai', '600004', 'https://www.foxymoron.in', '200-500', 1500000000, 'Harish Bijoor', 'Strategy Director', 'harish@foxymoron.in', '+919862234567', 60, 'new', 'event', ARRAY['creative', 'agency']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'marketing_media', 'Coimbatore Media Works', 'Media', 'Video Production', 'Coimbatore', 'Coimbatore', '641012', 'https://www.cbemediaworks.com', '10-50', 100000000, 'Karthik Rajan', 'Creative Director', 'karthik@cbemediaworks.com', '+919863345678', 48, 'new', 'cold-outreach', ARRAY['video-production', 'sme']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'marketing_media', 'Brand Avatar Events', 'Marketing', 'Event Management', 'Madurai', 'Madurai', '625002', 'https://www.brandavatar.in', '10-50', 150000000, 'Prithvi Raj', 'CEO', 'prithvi@brandavatar.in', '+919864456789', 42, 'new', 'google-ads', ARRAY['events', 'south-tn']);

-- Finance & Professional Services (5 leads)
INSERT INTO leads (tenant_id, sector_code, company_name, industry, sub_industry, city, district, pincode, website, company_size, annual_revenue_inr, contact_name, designation, email, phone, lead_score, stage, source, tags) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'finance_professional', 'Sundaram Finance', 'Finance', 'NBFC & Lending', 'Chennai', 'Chennai', '600002', 'https://www.sundaramfinance.in', '1000-5000', 80000000000, 'Harsha Viji', 'Joint Managing Director', 'harsha.v@sundaramfinance.in', '+919865567890', 82, 'qualified', 'referral', ARRAY['nbfc', 'high-value']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'finance_professional', 'Karvy Fintech', 'Finance', 'Wealth Management', 'Chennai', 'Chennai', '600006', 'https://www.karvyfintech.com', '500-1000', 10000000000, 'Nagaraj Srinivasan', 'Head of Technology', 'nagaraj.s@karvyfintech.com', '+919866678901', 68, 'new', 'linkedin', ARRAY['fintech', 'wealth-mgmt']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'finance_professional', 'Dhanalakshmi Associates', 'Professional Services', 'Chartered Accountants', 'Coimbatore', 'Coimbatore', '641011', 'https://www.dhanalakshmicas.com', '10-50', 50000000, 'CA Dhanalakshmi M', 'Senior Partner', 'dhanalakshmi@dhanalakshmicas.com', '+919867789012', 55, 'new', 'cold-outreach', ARRAY['ca-firm', 'professional-services']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'finance_professional', 'Shriram General Insurance', 'Insurance', 'General Insurance', 'Chennai', 'Chennai', '600018', 'https://www.shriramgi.com', '1000-5000', 45000000000, 'Padma Suresh', 'Chief Distribution Officer', 'padma.s@shriramgi.com', '+919868890123', 73, 'contacted', 'trade-show', ARRAY['insurance', 'mid-market']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'finance_professional', 'Madurai Legal Associates', 'Professional Services', 'Legal Services', 'Madurai', 'Madurai', '625001', 'https://www.madurailegal.in', '10-50', 80000000, 'Advocate Selvaraj K', 'Managing Partner', 'selvaraj@madurailegal.in', '+919869901234', 40, 'new', 'website', ARRAY['legal', 'sme']);

-- Construction & Real Estate (5 leads)
INSERT INTO leads (tenant_id, sector_code, company_name, industry, sub_industry, city, district, pincode, website, company_size, annual_revenue_inr, contact_name, designation, email, phone, lead_score, stage, source, tags) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'construction_real_estate', 'Casagrand Builder', 'Real Estate', 'Residential Development', 'Chennai', 'Chennai', '600035', 'https://www.casagrand.co.in', '1000-5000', 30000000000, 'Arun Mn', 'President - Sales', 'arun.mn@casagrand.co.in', '+919870012345', 80, 'qualified', 'website', ARRAY['real-estate', 'residential', 'high-value']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'construction_real_estate', 'L&T Construction (South)', 'Construction', 'Infrastructure & EPC', 'Chennai', 'Chennai', '600089', 'https://www.lntecc.com', '10000+', 500000000000, 'Mohanram K', 'VP - Business Development South', 'mohanram.k@lntecc.com', '+919871123456', 90, 'contacted', 'event', ARRAY['infrastructure', 'enterprise']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'construction_real_estate', 'TVS Emerald', 'Real Estate', 'Premium Housing', 'Chennai', 'Chennai', '600017', 'https://www.tvsemerald.com', '200-500', 8000000000, 'Sriram Iyer', 'General Manager - Marketing', 'sriram.i@tvsemerald.com', '+919872234567', 65, 'new', 'referral', ARRAY['premium-housing', 'brand']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'construction_real_estate', 'Coimbatore Constructions Pvt Ltd', 'Construction', 'Commercial Construction', 'Coimbatore', 'Coimbatore', '641001', 'https://www.coimbatoreconstructions.com', '200-500', 2000000000, 'Anandh Shankar', 'Director', 'anandh@coimbatoreconstructions.com', '+919873345678', 55, 'new', 'cold-outreach', ARRAY['commercial', 'regional']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'construction_real_estate', 'KPN Travels & Estates', 'Real Estate', 'Mixed Development', 'Salem', 'Salem', '636004', 'https://www.kpnestates.in', '50-200', 1000000000, 'Nagarajan P', 'Business Head - Estates', 'nagarajan@kpnestates.in', '+919874456789', 48, 'new', 'industry-directory', ARRAY['mixed-use', 'salem']);

-- Retail & E-commerce (5 leads)
INSERT INTO leads (tenant_id, sector_code, company_name, industry, sub_industry, city, district, pincode, website, company_size, annual_revenue_inr, contact_name, designation, email, phone, lead_score, stage, source, tags) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'retail_ecommerce', 'Nalli Silks', 'Retail', 'Silk & Textiles', 'Chennai', 'Chennai', '600017', 'https://www.nalli.com', '1000-5000', 15000000000, 'Lavanya Nalli', 'Executive Director', 'lavanya@nalli.com', '+919875567890', 76, 'contacted', 'referral', ARRAY['textiles', 'heritage-brand', 'omnichannel']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'retail_ecommerce', 'GRT Jewellers', 'Retail', 'Jewellery', 'Chennai', 'Chennai', '600015', 'https://www.grtjewellers.com', '1000-5000', 50000000000, 'Ananthapadmanabhan G', 'Director - Retail', 'anantha.g@grtjewellers.com', '+919876678901', 82, 'qualified', 'event', ARRAY['jewellery', 'premium']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'retail_ecommerce', 'Wildcraft India', 'Retail', 'Outdoor & Lifestyle', 'Trichy', 'Tiruchirappalli', '620002', 'https://www.wildcraft.in', '500-1000', 6000000000, 'Dinesh Kumar', 'Zonal Manager - TN', 'dinesh.k@wildcraft.in', '+919877789012', 60, 'new', 'linkedin', ARRAY['lifestyle', 'd2c']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'retail_ecommerce', 'Chettinad Grocery (ZopNow)', 'E-commerce', 'Grocery Delivery', 'Madurai', 'Madurai', '625020', 'https://www.chettinadgrocery.in', '50-200', 300000000, 'Meenakshi Sundaram', 'Founder & CEO', 'meenakshi@chettinadgrocery.in', '+919878890123', 50, 'new', 'cold-outreach', ARRAY['grocery', 'ecommerce', 'startup']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'retail_ecommerce', 'Pothys Retail', 'Retail', 'Clothing & Sarees', 'Tirunelveli', 'Tirunelveli', '627001', 'https://www.pfrsilks.com', '500-1000', 8000000000, 'Ramesh Pothy', 'Joint Managing Director', 'ramesh@pothys.com', '+919879901234', 68, 'new', 'referral', ARRAY['textiles', 'traditional-retail']);

-- Energy & Utilities (5 leads)
INSERT INTO leads (tenant_id, sector_code, company_name, industry, sub_industry, city, district, pincode, website, company_size, annual_revenue_inr, contact_name, designation, email, phone, lead_score, stage, source, tags) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'energy_utilities', 'TANGEDCO (TN Electricity Board)', 'Energy', 'Power Distribution', 'Chennai', 'Chennai', '600002', 'https://www.tangedco.tn.gov.in', '10000+', 400000000000, 'Kavitha Ramu', 'Chief Engineer - Projects', 'kavitha.r@tangedco.tn.gov.in', '+919880012345', 70, 'new', 'government-listing', ARRAY['government', 'power', 'large-enterprise']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'energy_utilities', 'Auroville Solar', 'Energy', 'Solar Energy', 'Villupuram', 'Villupuram', '605101', 'https://www.aurovillesolar.com', '50-200', 500000000, 'Jean-Pierre Esvaran', 'Project Director', 'jpe@aurovillesolar.com', '+919881123456', 62, 'new', 'website', ARRAY['solar', 'renewable']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'energy_utilities', 'CLP Wind Farms India', 'Energy', 'Wind Energy', 'Coimbatore', 'Coimbatore', '641044', 'https://www.clpindia.in', '200-500', 12000000000, 'Mahesh Palashikar', 'CEO', 'mahesh.p@clpindia.in', '+919882234567', 75, 'contacted', 'trade-show', ARRAY['wind-energy', 'international']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'energy_utilities', 'Raasi Green Earth Energy', 'Energy', 'Biomass & Biogas', 'Salem', 'Salem', '636005', 'https://www.raasienergy.com', '50-200', 300000000, 'Prabhu Doss', 'Managing Director', 'prabhu@raasienergy.com', '+919883345678', 52, 'new', 'cold-outreach', ARRAY['biomass', 'green-energy', 'sme']),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'energy_utilities', 'Tata Power (Southern Region)', 'Energy', 'Integrated Power', 'Chennai', 'Chennai', '600042', 'https://www.tatapower.com', '10000+', 350000000000, 'Srinivasan Venkat', 'Regional Head - South', 'srinivasan.v@tatapower.com', '+919884456789', 85, 'qualified', 'referral', ARRAY['power', 'enterprise', 'high-value']);
