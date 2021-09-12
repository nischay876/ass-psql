# ass-psql

[ass] PostgreSQL StorageEngine.

## Usage

1. Install with `npm i @tycrek/ass-psql`
2. Create `auth.psql.json` in your project root with the following content:
  ```json
  {
    "sslPath": "filename-of-your-ca-cert.crt",
    "host": "domain.name.to.your.database.com",
    "port": 12345,
    "username": "your-db-username",
    "password": "your-db-password",
    "database": "your-database-or-pool"
  }
  ```
  | Key | Description |
  | --- | --- |
  | `sslPath` | Path to the CA certificate |
  | `host` | Hostname of the PostgreSQL server |
  | `port` | Port of the PostgreSQL server |
  | `username` | Username of the PostgreSQL user |
  | `password` | Password of the PostgreSQL user |
  | `database` | Name of the database to connect to |
3. Add `@tycrek/ass-psql` to `data.js` using `require` & create a new instance of `PSQLStorageEngine`:
  ```js
  // Import the package
  const { PSQLStorageEngine } = require('@tycrek/ass-psql');

  // Import the options
  const { sslPath, host, port, username, password, database } = require('./auth.psql.json');

  // Create a new instance of the PSQLStorageEngine
  const data = new PSQLStorageEngine({
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

  // Initialize the StorageEngine
  // Always call data.init() before using the StorageEngine!
  data.init()
    .then(console.log)
    .catch(console.error);

  // Export the StorageEngine
  module.exports = data;
  ```

### The `init()` method

The `init()` method is used to initialize the StorageEngine. It returns a Promise that resolves when the StorageEngine is ready to use.

This method is used to create the database if it doesn't already exist.

### Migrating old data (from `JsonStorageEngine`)

Create a new instance of `PSQLStorageEngine` with the same options as before. Run `data.migrate()`, which returns a Promise. The result of `.then()` is the number of data entries migrated.
```js
// Import the old StorageEngine
const { JsonStorageEngine } = require('@tycrek/ass-storage-engine');
const dataOld = new JsonStorageEngine();

// Import the new StorageEngine & options
const { PSQLStorageEngine } = require('@tycrek/ass-psql');
const { sslPath, host, port, username, password, database } = require('./auth.psql.json');

// Create a new instance of the PSQLStorageEngine
const data = new PSQLStorageEngine({ /* ... */ });
data.init()
  .then(console.log)
  .then(() => dataOld.get())
  .then((oldData) => data.migrate(oldData)) // <-- Remove this after migration!
  .then(console.log)
  .catch(console.error);

module.exports = data;
```

**Only run this command if you are sure you want to migrate your data!**
  
Make sure you have a backup of your data before running this command. In pretty much all scenarios, you'll only need to run this command once, and then you can remove the migrate function from your code. Calling `data.migrate()` will only work if you have a `data.json` file in your project root. It will **not** modify or delete your `data.json` file (but having a backup of your data is still a good idea)


### Delete your table

If you want to delete the entire table, with zero data returns or backups or anything, you can use the following code:

```js
// Please realize this is dangerous
data.deleteTable()
  .then(console.log)
  .catch(console.error);
// There is no undo for this command!
```

**This will immediatly delete your table,** use with caution! The table will automatically be created when you call `data.init()` again.

## Compatibility with managed databases

So far this has only been tested with [DigitalOcean Managed PostgreSQL Databases], but it most likely works with any PostgreSQL database.

# GetgreSQL

Come and get your ass!

<details>
  <summary><small>wtf?</small></summary>

  <a href="https://copilot.github.com/">GitHub CoPilot</a> recommended this and it was too funny to not include it

</details>

[ass]: https://github.com/tycrek/ass
[DigitalOcean Managed PostgreSQL Databases]: https://www.digitalocean.com/products/managed-databases-postgresql/
