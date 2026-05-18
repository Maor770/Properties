-- NYC Properties Hub - D1 schema

DROP TABLE IF EXISTS property_files;
DROP TABLE IF EXISTS property_log;
DROP TABLE IF EXISTS properties;

CREATE TABLE properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'Initial Review',
  address TEXT NOT NULL,
  next_step TEXT,
  my_max_price REAL,
  asking_price REAL,
  units INTEGER,
  annual_noi REAL,
  dscr REAL,
  annual_cash_flow REAL,
  coc_return REAL,
  rent_stabilized TEXT DEFAULT 'Not Checked',
  bbl TEXT,
  borough TEXT,
  year_built INTEGER,
  last_offer REAL,
  notes TEXT,
  last_updated TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  enrichment_json TEXT
);

CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_borough ON properties(borough);
CREATE INDEX idx_properties_bbl ON properties(bbl);

CREATE TABLE property_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  size INTEGER,
  mime_type TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX idx_files_property ON property_files(property_id);

CREATE TABLE property_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  message TEXT NOT NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX idx_log_property ON property_log(property_id);
