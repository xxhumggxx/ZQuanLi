-- ══════════════════════════════════════════════
-- TRÀ CHANH ZODY - Supabase Schema & Data
-- ══════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── SHIFTS TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    password VARCHAR(50) NOT NULL,
    shift_type VARCHAR(20) DEFAULT 'morning' CHECK (shift_type IN ('morning', 'afternoon', 'evening')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── MATERIALS TABLE ───────────────────────────────────
CREATE TABLE IF NOT EXISTS materials (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    default_value DECIMAL(10,2) DEFAULT 0,
    sort_order INTEGER DEFAULT 99,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── SHIFT REPORTS TABLE ───────────────────────────────
CREATE TABLE IF NOT EXISTS shift_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
    shift_name VARCHAR(100),
    report_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'submitted')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── INVENTORY ENTRIES TABLE ─────────────────────────
CREATE TABLE IF NOT EXISTS inventory_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    report_id UUID REFERENCES shift_reports(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    material_name VARCHAR(100),
    opening_qty DECIMAL(10,2) DEFAULT 0,
    closing_qty DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(20),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── SHIFT FINANCE TABLE ───────────────────────────────
CREATE TABLE IF NOT EXISTS shift_finance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    report_id UUID REFERENCES shift_reports(id) ON DELETE CASCADE,
    opening_cash DECIMAL(15,2) DEFAULT 0,
    software_revenue DECIMAL(15,2) DEFAULT 0,
    bank_transfer DECIMAL(15,2) DEFAULT 0,
    total_expense DECIMAL(15,2) DEFAULT 0,
    register_keep DECIMAL(15,2) DEFAULT 500000,
    pig_keep DECIMAL(15,2) DEFAULT 30000,
    actual_cash DECIMAL(15,2) GENERATED ALWAYS AS (
        (software_revenue + opening_cash - bank_transfer - total_expense)
    ) STORED,
    cash_to_bring DECIMAL(15,2) GENERATED ALWAYS AS (
        (software_revenue + opening_cash - bank_transfer - total_expense - register_keep - pig_keep)
    ) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── EXPENSES TABLE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    report_id UUID REFERENCES shift_reports(id) ON DELETE CASCADE,
    description VARCHAR(200) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── INDEXES ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shifts_active ON shifts(is_active);
CREATE INDEX IF NOT EXISTS idx_materials_active ON materials(is_active);
CREATE INDEX IF NOT EXISTS idx_shift_reports_date ON shift_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_shift_reports_status ON shift_reports(status);
CREATE INDEX IF NOT EXISTS idx_inventory_report ON inventory_entries(report_id);
CREATE INDEX IF NOT EXISTS idx_inventory_material ON inventory_entries(material_id);
CREATE INDEX IF NOT EXISTS idx_finance_report ON shift_finance(report_id);
CREATE INDEX IF NOT EXISTS idx_expenses_report ON expenses(report_id);

-- ── ROW LEVEL SECURITY (RLS) ───────────────────────────
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
    DROP POLICY IF EXISTS "Enable all for shifts" ON shifts;
    DROP POLICY IF EXISTS "Enable all for materials" ON materials;
    DROP POLICY IF EXISTS "Enable all for shift_reports" ON shift_reports;
    DROP POLICY IF EXISTS "Enable all for inventory_entries" ON inventory_entries;
    DROP POLICY IF EXISTS "Enable all for shift_finance" ON shift_finance;
    DROP POLICY IF EXISTS "Enable all for expenses" ON expenses;
END $$;

-- Allow all operations (for simplicity - adjust for production)
CREATE POLICY "Enable all for shifts" ON shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for materials" ON materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for shift_reports" ON shift_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for inventory_entries" ON inventory_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for shift_finance" ON shift_finance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- ── SAMPLE DATA ─────────────────────────────────────────
-- Sample Shifts
INSERT INTO shifts (name, password, shift_type) VALUES
('Ca Sáng', 'sang123', 'morning'),
('Ca Chiều', 'chieu456', 'afternoon'),
('Ca Tối', 'toi789', 'evening')
ON CONFLICT DO NOTHING;

-- Sample Materials
INSERT INTO materials (category, name, unit, default_value, sort_order) VALUES
('TRÁI CÂY', 'Chanh Dây', 'chai', 10, 1),
('TRÁI CÂY', 'Chanh Leo', 'kg', 2, 2),
('TRÁI CÂY', 'Dâu Tây', 'hộp', 5, 3),
('SỮA / KEM', 'Sữa Tươi', 'lít', 10, 1),
('SỮA / KEM', 'Kem Whipping', 'hộp', 3, 2),
('SỮA / KEM', 'Sữa Condensed', 'lon', 5, 3),
('TOPPING', 'Trân Châu', 'kg', 2, 1),
('TOPPING', 'Thạch Dừa', 'hộp', 5, 2),
('TOPPING', 'Pudding', 'hộp', 3, 3),
('SỐT', 'Sốt Trái Cây', 'chai', 5, 1),
('SỐT', 'Sốt Chocolate', 'chai', 3, 2),
('TRÀ', 'Trà Đen', 'kg', 5, 1),
('TRÀ', 'Trà Xanh', 'kg', 3, 2),
('TRÀ', 'Trà Lài', 'kg', 2, 3),
('ĂN VẶT', 'Bánh Mì', 'cái', 20, 1),
('ĂN VẶT', 'Bánh Ngọt', 'cái', 15, 2),
('KHÁC', 'Đá Biên', 'kg', 10, 1),
('KHÁC', 'Lá Nếp', 'bó', 5, 2)
ON CONFLICT DO NOTHING;

-- Sample Shift Reports (for testing admin dashboard)
-- Get shift IDs
DO $$
DECLARE
    morning_shift_id UUID;
    afternoon_shift_id UUID;
    evening_shift_id UUID;
    morning_report_id UUID;
    afternoon_report_id UUID;
    evening_report_id UUID;
BEGIN
    SELECT id INTO morning_shift_id FROM shifts WHERE name = 'Ca Sáng' LIMIT 1;
    SELECT id INTO afternoon_shift_id FROM shifts WHERE name = 'Ca Chiều' LIMIT 1;
    SELECT id INTO evening_shift_id FROM shifts WHERE name = 'Ca Tối' LIMIT 1;
    
    -- Create sample reports for today
    INSERT INTO shift_reports (shift_id, shift_name, report_date, status, submitted_at)
    VALUES (morning_shift_id, 'Ca Sáng', CURRENT_DATE, 'submitted', NOW() - INTERVAL '8 hours')
    RETURNING id INTO morning_report_id;
    
    INSERT INTO shift_reports (shift_id, shift_name, report_date, status, submitted_at)
    VALUES (afternoon_shift_id, 'Ca Chiều', CURRENT_DATE, 'submitted', NOW() - INTERVAL '4 hours')
    RETURNING id INTO afternoon_report_id;
    
    INSERT INTO shift_reports (shift_id, shift_name, report_date, status, submitted_at)
    VALUES (evening_shift_id, 'Ca Tối', CURRENT_DATE, 'submitted', NOW() - INTERVAL '1 hour')
    RETURNING id INTO evening_report_id;
    
    -- Sample Finance Data
    INSERT INTO shift_finance (report_id, opening_cash, software_revenue, bank_transfer, total_expense, register_keep, pig_keep)
    VALUES 
    (morning_report_id, 500000, 850000, 200000, 50000, 500000, 30000),
    (afternoon_report_id, 500000, 650000, 150000, 30000, 500000, 30000),
    (evening_report_id, 500000, 750000, 180000, 40000, 500000, 30000);
    
    -- Sample Expenses
    INSERT INTO expenses (report_id, description, amount)
    VALUES 
    (morning_report_id, 'Mua đá', 50000),
    (afternoon_report_id, 'Mua đường', 30000),
    (evening_report_id, 'Mua ly nhựa', 40000);
    
    -- Sample Inventory Entries (for a few materials)
    INSERT INTO inventory_entries (report_id, material_id, material_name, opening_qty, closing_qty, unit)
    SELECT 
        morning_report_id,
        id,
        name,
        default_value,
        default_value - (random() * 2),
        unit
    FROM materials 
    WHERE is_active = true
    LIMIT 5;
    
    INSERT INTO inventory_entries (report_id, material_id, material_name, opening_qty, closing_qty, unit)
    SELECT 
        afternoon_report_id,
        id,
        name,
        default_value,
        default_value - (random() * 2),
        unit
    FROM materials 
    WHERE is_active = true
    LIMIT 5;
    
    INSERT INTO inventory_entries (report_id, material_id, material_name, opening_qty, closing_qty, unit)
    SELECT 
        evening_report_id,
        id,
        name,
        default_value,
        default_value - (random() * 2),
        unit
    FROM materials 
    WHERE is_active = true
    LIMIT 5;
END $$;

-- ── FUNCTIONS FOR UPDATED_AT ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shift_finance_updated_at
    BEFORE UPDATE ON shift_finance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
