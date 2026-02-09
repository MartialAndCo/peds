-- Table des stories narratives
CREATE TABLE stories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  
  story_type TEXT NOT NULL CHECK (story_type IN ('FACTURE', 'SANTE', 'FAMILLE', 'ECOLE', 'URGENCE', 'TRANSPORT', 'FILLER')),
  description TEXT NOT NULL,
  angle TEXT NOT NULL,
  amount INTEGER,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED', 'ESCAPED', 'PENDING')),
  
  previous_story_id TEXT REFERENCES stories(id),
  story_chain JSONB DEFAULT '[]',
  
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  last_mentioned_at TIMESTAMP DEFAULT NOW(),
  prompt_template TEXT NOT NULL,
  
  UNIQUE(agent_id, contact_id, description)
);

CREATE INDEX idx_stories_contact ON stories(contact_id, agent_id);
CREATE INDEX idx_stories_status ON stories(status);
