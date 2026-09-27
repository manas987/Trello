ALTER TABLE invites
    ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'member';
