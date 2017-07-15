// var sqlite3 = require('sqlite3').verbose();
// var db = new sqlite3.Database(':memory:');
//
// db.serialize(function() {
//   db.run(
//     "CREATE TABLE UserAccounts (ClientId varchar(255), AccessToken varchar(512), RefreshToken varchar(512), UpdateTime TIMESTAMP )"
//   )
//
//   var stmt = db.prepare(
//     "INSERT INTO UserAccounts VALUES (?)"
//   )
// })


var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(':memory:');

db.serialize(function() {
  db.run("CREATE TABLE ClientId (ClientId varchar(255), AccessToken varchar(512), RefreshToken varchar(512), UpdateTime TIMESTAMP)");
  console.log('second')
  var stmt = db.prepare("INSERT INTO ClientId VALUES (?,?,?,?)",[],function(err, rows){
    console.log('bad');
  });
  console.log('first');

  for (var i = 0; i < 10; i++) {
      stmt.run("Ipsum " + i, 'this is an intro');
  }
  stmt.finalize();

  db.each("SELECT rowid AS id, info, intro FROM ClientId", function(err, row) {
      console.log(row.id + ": " + row.info + ":"+row.intro);
  });
});

db.close();
