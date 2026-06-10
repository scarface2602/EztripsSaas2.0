-- Customizable Trip ID format per organization
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS trip_id_config jsonb NOT NULL DEFAULT '{
  "prefix": "EZQ",
  "separator": "",
  "date_format": "YYMMDD",
  "seq_digits": 3,
  "type_codes": {
    "PKG": "PKG",
    "HTL": "HTL",
    "FLT": "FLT",
    "VSA": "VSA",
    "TRF": "TRF",
    "MISC": "MISC"
  }
}'::jsonb;
