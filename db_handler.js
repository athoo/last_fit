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

var CreateTable = function(ClientId, AccessToken, RefreshToken, UpdateTime, Profile){
  var db = new sqlite3.Database(':memory:');
  db.serialize(function() {
    db.run("CREATE TABLE Client (id INTEGER, AccessToken TEXT, RefreshToken TEXT, UpdateTime TIMESTAMP, Profile TEXT)");
    var stmt = db.prepare("INSERT INTO Client VALUES (?,?,?,?,?)",[],function(err, rows){
    });

    stmt.run(ClientId, AccessToken, RefreshToken, UpdateTime, Profile);

    stmt.finalize();

    db.each("SELECT Profile FROM Client", function(err, row) {
        console.log(row.Profile);
    });
  });

  db.close();
}

module.exports.CreateTable = CreateTable;
//
// var CreateTable = function(){
//   var
// }
