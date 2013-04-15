exports.openPool = function(connectionString, callback) {
	require('mongodb').MongoClient.connect(connectionString, function(err, db) {
		if (err) { console.log('-ChatServerDb.openPool-', err);}
		callback(db, err);
	});
};