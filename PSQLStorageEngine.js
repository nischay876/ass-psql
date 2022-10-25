const path = require('path');
const { mergeNoArray } = require('./deepMerge');
const { name: EngineName, version: EngineVersion } = require('./package.json');
const { Pool } = require('pg');
const { StorageType, StorageEngine, StorageFunction, StorageFunctionType, StorageFunctionGroup, KeyFoundError, KeyNotFoundError } = require('@tycrek/ass-storage-engine');

let TABLE = '';
const TIMEOUTS = {
	IDLE: 30000,
	CONNECT: 5000,
};

const OPTIONS = {
	host: 'localhost',
	port: 12345,
	table: 'ass',
	database: 'dbname',
	username: 'dbuser',
	password: 'dbpass',
};

/**
 * Get resource data from the database
 * @param {string} resourceId The resource id
 * @returns {Promise<*>} The resource data
 * @throws {KeyNotFoundError} If the resource is not found
 */
function get(resourceId) {
	return new Promise((resolve, reject) =>
		(!resourceId)
			? PSQLStorageEngine.pool.query(`SELECT * FROM ${table};`,
				(err, res) => (err)
					? reject(err)
					: resolve(res.rows.map(({ id, data }) => [id, data])))
			: PSQLStorageEngine.pool.query(`SELECT * FROM ${table} WHERE id = '${resourceId}';`,
				(err, res) => (err)
					? reject(err)
					: (res.rows.length === 0)
						? reject(new KeyNotFoundError(resourceId))
						: resolve(res.rows[0].data)));
}

/**
 * Put resource data into the database
 * @param {string} resourceId The resource id
 * @param {Object} resourceData The resource data
 * @returns {Promise<*>}
 * @throws {KeyFoundError} If the resource already exists
 */
function put(resourceId, resourceData) {
	return new Promise((resolve, reject) =>
		has(resourceId)
			.then((exists) => (exists) ? reject(new KeyFoundError(resourceId)) : Promise.resolve())
			.then(() => PSQLStorageEngine.pool.query(`INSERT INTO ${table} (id, data) VALUES ('${resourceId}', '${JSON.stringify(resourceData)}');`, (err) =>
				(err) ? reject(err) : resolve())));
}

/**
 * Delete resource data from the database
 * @param {string} resourceId The resource id
 * @returns {Promise<*>}
 * @throws {KeyNotFoundError} If the resource is not found
 */
function del(resourceId) {
	return new Promise((resolve, reject) =>
		PSQLStorageEngine.pool.query(`DELETE FROM ${table} WHERE id = '${resourceId}';`, (err) =>
			(err) ? reject(err) : resolve()));
}

/**
 * Check if resource data exists in the database
 * @param {string} resourceId The resource id
 * @returns {Promise<boolean>}
 */
function has(resourceId) {
	return new Promise((resolve, reject) =>
		PSQLStorageEngine.pool.query(`SELECT * FROM ${table} WHERE id = '${resourceId}';`, (err, res) =>
			(err) ? reject(err)
				: resolve(res.rows.length !== 0)));
}

class PSQLStorageEngine extends StorageEngine {

	/**
	 * @type {OPTIONS}
	 * @private
	 */
	#options = {};

	/**
	 * @type {Pool}
	 * @public
	 * @static
	 */
	static pool = null;

	/**
	 * @param {OPTIONS} [options] The options to use for the storage engine (optional)
	 */
	constructor(options = OPTIONS) {
		super('PostgreSQL', StorageType.DB, new StorageFunctionGroup(
			new StorageFunction(StorageFunctionType.GET, get),
			new StorageFunction(StorageFunctionType.PUT, put),
			new StorageFunction(StorageFunctionType.DEL, del),
			new StorageFunction(StorageFunctionType.HAS, has)
		));

		this.#options = mergeNoArray(OPTIONS, options);
	}

	/**
	 * Initialize the database connection pool
	 * @param {StorageEngine} oldEngine The previous storage engine
	 * @returns {Promise<*>}
	 */
	init(oldEngine) {
		return new Promise((resolve, reject) => {
			// Get the options 
			const { ssl, host, port, database, username: user, password, table } = this.#options;

			// Create the pool
			PSQLStorageEngine.pool = new Pool({ ssl, host, port, database, user, password, idleTimeoutMillis: TIMEOUTS.IDLE, connectTimeoutMillis: TIMEOUTS.CONNECT });

			// Create the table if it doesn't exist
			PSQLStorageEngine.pool.query(`SELECT * FROM pg_catalog.pg_tables`, (err, res) => {
				if (err) reject(err);
				else if (res.rows.findIndex((row) => row.tablename === table) === -1) {
					PSQLStorageEngine.pool.query(`CREATE TABLE ${table} (id text PRIMARY KEY, data jsonb NOT NULL);`,
						(err) => (err && !err.message.includes('does not exist'))
							? reject(err)
							: oldEngine.get()
								.then((oldData) => this.migrate(oldData))
								.then(() => resolve(`Table ${table} created`))
								.catch((err) => reject(err)));
				} else resolve(`Table ${table} exists`);
			});
		});
	}

	/**
	 * Get the number of keys in the database
	 * @returns {number} The number of keys
	 */
	get size() { return this.#size(); }
	async #size() {
		try {
			const promise = new Promise((resolve, reject) =>
				PSQLStorageEngine.pool.query(`SELECT COUNT(*) FROM ${this.#options.table};`, (err, res) =>
					(err) ? reject(err)
						: resolve(res.rows[0].count)));
			const data = await promise;
			return data;
		} catch (ex) {
			return 0;
		}
	}

	/**
	 * Migrate function takes the existing and adds all entries to the database.
	 * @param {*[]} data The existing data
	 * @returns {Promise<*>}
	 */
	migrate(data) {
		return new Promise((resolve, reject) =>
			Promise.all(data.map(([key, value]) => has(key).then((exists) => !exists && put(key, value))))
				.then((results) => resolve(`${results.length} entries migrated`))
				.catch(reject));
	}

	/** Delete the table
	 * @returns {Promise<*>}
	 */
	deleteTable() {
		return new Promise((resolve, reject) =>
			PSQLStorageEngine.pool.query(`DROP TABLE ${this.#options.table};`, (err) =>
				(err) ? reject(err) : resolve()));
	}
}

const { host, port, username, password, database, table } = require(path.join(process.cwd(), 'auth.psql.json'));
TABLE = table;
const assEngine = new PSQLStorageEngine({
	host,
	port,
	username,
	password,
	database,
	table
});

module.exports = {
	EngineName,
	EngineVersion,
	PSQLStorageEngine,

	_ENGINE_: (oldEngine) => {
		assEngine.init(oldEngine)
			.then(console.log)
			.catch(console.error);
		return assEngine;
	}
};
