-- WarLike Horror v1: Cloudflare D1 / SQLite. Metadata only, GLB files belong in R2.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS horror_games (
 id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,
 genre TEXT NOT NULL DEFAULT 'survival_horror',description TEXT,
 status TEXT NOT NULL DEFAULT 'concept' CHECK(status IN ('concept','prototype','development','released','archived')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS horror_creatures (
 id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,name TEXT NOT NULL,
 archetype TEXT NOT NULL CHECK(archetype IN ('walker','brute','crawler','stalker','boss','other')),
 lore TEXT,base_health INTEGER NOT NULL DEFAULT 100 CHECK(base_health>0),
 base_speed REAL NOT NULL DEFAULT 1 CHECK(base_speed>=0),
 threat_level INTEGER NOT NULL DEFAULT 1 CHECK(threat_level BETWEEN 1 AND 10),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS horror_assets (
 id TEXT PRIMARY KEY,creature_id TEXT REFERENCES horror_creatures(id) ON DELETE SET NULL,
 asset_kind TEXT NOT NULL CHECK(asset_kind IN ('model','texture','animation','audio','thumbnail','prefab')),
 label TEXT NOT NULL,variant TEXT NOT NULL DEFAULT 'default',
 r2_key TEXT UNIQUE,source_url TEXT,license TEXT NOT NULL DEFAULT 'unverified',
 format TEXT,bytes INTEGER CHECK(bytes IS NULL OR bytes>=0),
 sha256 TEXT CHECK(sha256 IS NULL OR length(sha256)=64),
 rigged INTEGER NOT NULL DEFAULT 0 CHECK(rigged IN (0,1)),
 verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(r2_key IS NOT NULL OR source_url IS NOT NULL OR verified=0));
CREATE TABLE IF NOT EXISTS horror_behaviors (
 id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,description TEXT,
 graph_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(graph_json)),
 api_version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS horror_creature_behaviors (
 creature_id TEXT NOT NULL REFERENCES horror_creatures(id) ON DELETE CASCADE,
 behavior_id TEXT NOT NULL REFERENCES horror_behaviors(id) ON DELETE CASCADE,
 priority INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(creature_id,behavior_id));
CREATE TABLE IF NOT EXISTS horror_game_creatures (
 game_id TEXT NOT NULL REFERENCES horror_games(id) ON DELETE CASCADE,
 creature_id TEXT NOT NULL REFERENCES horror_creatures(id) ON DELETE CASCADE,
 spawn_enabled INTEGER NOT NULL DEFAULT 0 CHECK(spawn_enabled IN (0,1)),
 difficulty_multiplier REAL NOT NULL DEFAULT 1 CHECK(difficulty_multiplier>0),
 narrative_role TEXT,PRIMARY KEY(game_id,creature_id));
CREATE TABLE IF NOT EXISTS horror_story_chapters (
 id TEXT PRIMARY KEY,game_id TEXT NOT NULL REFERENCES horror_games(id) ON DELETE CASCADE,
 chapter_order INTEGER NOT NULL CHECK(chapter_order>=0),
 title TEXT NOT NULL,synopsis TEXT,UNIQUE(game_id,chapter_order));
CREATE TABLE IF NOT EXISTS horror_story_events (
 id TEXT PRIMARY KEY,chapter_id TEXT NOT NULL REFERENCES horror_story_chapters(id) ON DELETE CASCADE,
 event_order INTEGER NOT NULL CHECK(event_order>=0),
 trigger_name TEXT NOT NULL,content_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(content_json)),
 UNIQUE(chapter_id,event_order));
CREATE INDEX IF NOT EXISTS idx_horror_assets_creature ON horror_assets(creature_id,asset_kind);
CREATE INDEX IF NOT EXISTS idx_horror_game_creatures_creature ON horror_game_creatures(creature_id);
CREATE INDEX IF NOT EXISTS idx_horror_story_events_chapter ON horror_story_events(chapter_id);
INSERT OR IGNORE INTO horror_creatures(id,slug,name,archetype,lore,base_health,base_speed,threat_level) VALUES
('horror-walker','walker','Zombie marcheur classique','walker','Infecté errant, sensible aux sons.',100,1,2),
('horror-brute','brute','Zombie colosse mutant','brute','Mutation puissante, lente et destructrice.',400,0.55,8),
('horror-crawler','crawler','Zombie rampant','crawler','Prédateur bas et furtif.',70,1.35,5);
INSERT OR IGNORE INTO horror_games(id,slug,title,genre,status) VALUES
('chambre-07','chambre-07','CHAMBRE 07 · La Voix','psychological_horror','prototype');
INSERT OR IGNORE INTO horror_behaviors(id,name,description,graph_json) VALUES
('horror-audio-hunt','Hearing and pursuit','Patrol → hear noise → investigate → chase → search → patrol','{"nodes":["patrol","hear","investigate","chase","search"]}'),
('horror-brute-charge','Heavy pursuit','Slow detection and heavy attack','{"nodes":["patrol","detect","chase","heavy_attack"]}'),
('horror-crawler-ambush','Crawler ambush','Low-profile hiding and ambush','{"nodes":["hide","hear","stalk","ambush"]}');
INSERT OR IGNORE INTO horror_creature_behaviors(creature_id,behavior_id) VALUES
('horror-walker','horror-audio-hunt'),('horror-brute','horror-brute-charge'),('horror-crawler','horror-crawler-ambush');
-- Optional prototypes only, disabled by default in CHAMBRE 07.
INSERT OR IGNORE INTO horror_game_creatures(game_id,creature_id,spawn_enabled,narrative_role) VALUES
('chambre-07','horror-walker',0,'Potential failed reconstruction'),
('chambre-07','horror-brute',0,'Optional future boss'),
('chambre-07','horror-crawler',0,'Optional failed reconstruction');