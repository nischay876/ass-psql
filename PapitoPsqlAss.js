const path = require('path');
const { PSQLStorageEngine } = require('./PSQLStorageEngine');
const { sslPath, host, port, username, password, database } = require(path.join(process.cwd(), 'auth.psql.json'));

const engine = new PSQLStorageEngine({
	ssl: {
		rejectUnauthorized: true,
		ca: require('fs-extra').readFileSync(`${sslPath}`).toString()
	},
	host,
	port,
	username,
	password,
	database
});

// Export the StorageEngine
module.exports = engine;
