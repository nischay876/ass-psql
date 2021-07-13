const { mergeNoArray } = require('./deepMerge');
const { name: EngineName, version: EngineVersion } = require('./package.json');
const { Pool } = require('pg');
const { StorageType, StorageEngine, StorageFunction, StorageFunctionType, StorageFunctionGroup, KeyFoundError, KeyNotFoundError } = require('@tycrek/ass-storage-engine');

const TIMEOUTS = {
	IDLE: 30000,
	CONNECT: 5000,
};

const TABLE_NAME = 'ass';
const OPTIONS = {
	ssl: {
		rejectUnauthorized: true,
		ca: 'ca-cert',
	},
	host: 'localhost',
	port: 12345,
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
			? PSQLStorageEngine.pool.query(`SELECT * FROM ${TABLE_NAME};`,
				(err, res) => (err)
					? reject(err)
					: resolve(res.rows.map(({ id, data }) => [id, data])))
			: PSQLStorageEngine.pool.query(`SELECT * FROM ${TABLE_NAME} WHERE id = '${resourceId}';`,
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
			.then(() => PSQLStorageEngine.pool.query(`INSERT INTO ${TABLE_NAME} (id, data) VALUES ('${resourceId}', '${JSON.stringify(resourceData)}');`, (err) =>
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
		PSQLStorageEngine.pool.query(`DELETE FROM ${TABLE_NAME} WHERE id = '${resourceId}';`, (err) =>
			(err) ? reject(err) : resolve()));
}

/**
 * Check if resource data exists in the database
 * @param {string} resourceId The resource id
 * @returns {Promise<boolean>}
 */
function has(resourceId) {
	return new Promise((resolve, reject) =>
		PSQLStorageEngine.pool.query(`SELECT * FROM ${TABLE_NAME} WHERE id = '${resourceId}';`, (err, res) =>
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
	 * @returns {Promise<*>}
	 */
	init() {
		return new Promise((resolve, reject) => {
			// Get the options 
			const { ssl, host, port, database, username: user, password } = this.#options;

			// Create the pool
			PSQLStorageEngine.pool = new Pool({ ssl, host, port, database, user, password, idleTimeoutMillis: TIMEOUTS.IDLE, connectTimeoutMillis: TIMEOUTS.CONNECT });

			// Create the table if it doesn't exist
			PSQLStorageEngine.pool.query(`SELECT * FROM pg_catalog.pg_tables`, (err, res) => {
				if (err) reject(err);
				else if (res.rows.findIndex((row) => row.tablename === TABLE_NAME) === -1)
					PSQLStorageEngine.pool.query(`CREATE TABLE ${TABLE_NAME} (id text PRIMARY KEY, data jsonb NOT NULL);`,
						(err) => (err && !err.message.includes('does not exist')) ? reject(err) : resolve(`Table ${TABLE_NAME} created`));
				else resolve(`Table ${TABLE_NAME} exists`);
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
				PSQLStorageEngine.pool.query(`SELECT COUNT(*) FROM ${TABLE_NAME};`, (err, res) =>
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
		return new Promise((resolve, reject) => {
			Promise.all(data.map(([key, value]) => has(key).then((exists) => !exists && put(key, value))))
				.then((results) => resolve(`${results.length} entries migrated`))
				.catch(reject);
		});
	}

	/** Delete the table
	 * @returns {Promise<*>}
	 */
	deleteTable() {
		return new Promise((resolve, reject) =>
			PSQLStorageEngine.pool.query(`DROP TABLE ${TABLE_NAME};`, (err) =>
				(err) ? reject(err) : resolve()));
	}
}

module.exports = {
	EngineName,
	EngineVersion,
	PSQLStorageEngine
};
