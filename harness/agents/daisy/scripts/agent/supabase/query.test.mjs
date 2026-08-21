import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const query = new URL("./query", import.meta.url);

function validate(sql) {
	const env = { ...process.env };
	for (const key of [
		"SUPABASE_PROJECT_ID",
		"SUPABASE_DB_PASSWORD",
		"PGHOST",
		"PGUSER",
		"PGPORT",
	]) {
		delete env[key];
	}
	return spawnSync(process.execPath, [query.pathname, "-c", sql], {
		env,
		encoding: "utf8",
	});
}

function assertAllowed(sql) {
	const result = validate(sql);
	assert.equal(result.status, 2, result.stderr);
	assert.match(result.stderr, /SUPABASE_PROJECT_ID not set/);
	assert.doesNotMatch(result.stderr, /SQL validation failed/);
}

function assertBlocked(sql, keyword) {
	const result = validate(sql);
	assert.equal(result.status, 3, result.stderr);
	assert.match(result.stderr, /SQL validation failed/);
	if (keyword) assert.match(result.stderr.toLowerCase(), new RegExp(keyword));
}

test("forbidden words are harmless inside PostgreSQL quoted regions", () => {
	for (const sql of [
		"INSERT INTO supplier_messages (body) VALUES ('Please DO not DROP this source note')",
		"UPDATE supplier_messages SET body = 'They didn''t DO the drop' WHERE id = 1",
		String.raw`UPDATE supplier_messages SET body = E'Chris\'s note says DROP and DO' WHERE id = 1`,
		"SELECT $$DO; DROP TABLE suppliers;$$",
		"SELECT $evidence$DO NOT DROP — supplier’s source note$evidence$",
		'SELECT "drop", "do", "a""drop" FROM inventory',
		"SELECT 'unicode 🌳 before DROP and DO'",
	]) {
		assertAllowed(sql);
	}
});

test("comment markers and semicolons inside literals cannot hide later SQL", () => {
	for (const sql of [
		"SELECT 'source says -- do not'; DROP TABLE suppliers",
		"SELECT 'source says /* do not */'; DROP TABLE suppliers",
		"SELECT 'safe; DROP TABLE suppliers'; DELETE FROM suppliers",
		String.raw`SELECT E'escaped quote: \\' ; DROP TABLE suppliers`,
	]) {
		assertBlocked(sql, "drop|delete");
	}
});

test("real forbidden syntax remains blocked across whitespace and comments", () => {
	for (const [sql, keyword] of [
		["DROP TABLE suppliers", "drop"],
		["DO $$ BEGIN DELETE FROM suppliers; END $$", "do"],
		["WITH doomed AS (DELETE FROM inventory RETURNING *) SELECT * FROM doomed", "delete"],
		["SELECT 1; /* harmless DROP */\n -- harmless DO\n DROP TABLE suppliers", "drop"],
		["SELECT 1; DR/**/OP TABLE suppliers", "disallowed leading keyword"],
		["CREATE /* gap */ TABLE nope (id int)", "only create"],
	]) {
		assertBlocked(sql, keyword);
	}
});

test("dollar-quote markers inside identifiers cannot mask later SQL", () => {
	// The trailing marker is now an unterminated opener, so fail-closed is
	// sufficient; critically, the identifier-adjacent marker cannot mask DROP.
	assertBlocked("SELECT foo$tag$; DROP TABLE suppliers; SELECT $tag$");
});

test("nested comments are masked, but code after them is still scanned", () => {
	assertAllowed("SELECT 1 /* outer DROP /* inner DO */ still DELETE */");
	assertBlocked("SELECT 1 /* outer /* inner */ done */; DROP TABLE suppliers", "drop");
});

test("unterminated quoted regions fail closed", () => {
	for (const sql of ["SELECT 'DROP", 'SELECT "drop', "SELECT $tag$DROP", "SELECT 1 /* DROP"]) {
		assertBlocked(sql, "unterminated");
	}
});
