const path = require('path');
const { PSQLStorageEngine } = require('./PSQLStorageEngine');
const { sslPath, host, port, username, password, database, table } = require(path.join(process.cwd(), 'auth.psql.json'));

const engine = new PSQLStorageEngine({
	ssl: {
		rejectUnauthorized: true,
		ca: require('fs-extra').readFileSync(`${sslPath}`).toString()
	},
	host,
	port,
	username,
	password,
	database,
	table
});

// Export the StorageEngine
module.exports = engine;
