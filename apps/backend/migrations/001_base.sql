CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

CREATE TABLE orgs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
);

CREATE TYPE user_role AS ENUM ('admin', 'member');

CREATE TABLE membership (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id INT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'member',
    PRIMARY KEY (user_id, org_id)
);

CREATE TABLE boards (
    id serial PRIMARY KEY,
    title TEXT NOT NULL,
    orginisationId INT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE TABLE sections(
    id serial PRIMARY KEY,
    title TEXT ,
    boardId INT NOT NULL REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE issues(
    id SERIAL PRIMARY KEY,
    title TEXT ,
    description TEXT ,
    sectionId INT NOT NULL REFERENCES sections(id) ON DELETE RESTRICT
);

CREATE TABLE issues_mapping(
    userid INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    issueid INT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,

    PRIMARY KEY (userid, issueid)
);

CREATE TABLE comments(
    id SERIAL PRIMARY KEY,
    issueId INT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    userId INT REFERENCES users(id) ON DELETE SET NULL
);