-- Requested team places only: no email, authentication identity or active privilege.
-- Idempotent template keys preserve any profiles already prepared in the console.
INSERT OR IGNORE INTO account_slots(id,template_key,name,role,status,created_at,created_by) VALUES
('WL-7C7CE42414FDD4B2','tester-1','Testeur 01','member','prepared',CAST(strftime('%s','now') AS INTEGER)*1000,'owner-request'),
('WL-9151CD0A309EA49F','tester-2','Testeur 02','member','prepared',CAST(strftime('%s','now') AS INTEGER)*1000,'owner-request'),
('WL-99C016935F82F1EF','tester-3','Testeur 03','member','prepared',CAST(strftime('%s','now') AS INTEGER)*1000,'owner-request'),
('WL-6B7D95FD7E63CB66','tester-4','Testeur 04','member','prepared',CAST(strftime('%s','now') AS INTEGER)*1000,'owner-request'),
('WL-87967625525C2E61','tester-5','Testeur 05','member','prepared',CAST(strftime('%s','now') AS INTEGER)*1000,'owner-request'),
('WL-0DDA7E5179A5AAF5','approver-1','Approbateur 01','referent','prepared',CAST(strftime('%s','now') AS INTEGER)*1000,'owner-request'),
('WL-54D77A2261E0B86A','approver-2','Approbateur 02','referent','prepared',CAST(strftime('%s','now') AS INTEGER)*1000,'owner-request'),
('WL-1DCA2C012DB86B69','approver-3','Approbateur 03','referent','prepared',CAST(strftime('%s','now') AS INTEGER)*1000,'owner-request'),
('WL-2607C528505FC4E9','approver-4','Approbateur 04','referent','prepared',CAST(strftime('%s','now') AS INTEGER)*1000,'owner-request');
