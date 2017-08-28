const sqlite3 = require('sqlite3').verbose();
let db;

// const ConnectDB = function(){
//   console.log('connected to db');
//   db = new sqlite3.Database('./db/users.db');
// }

// const CreateTable = function(db){
//   console.log('Create table')
//   db = new sqlite3.Database('./db/users.db');    
//   db.serialize(function(){
//     db.run("CREATE TABLE IF NOT EXISTS user_info(id Char, profile TEXT)")
//   })
//   db.close()  
// }

const InsertItem = function(item){
  console.log('Insert Item')
  db = new sqlite3.Database('./db/users.db');      
  db.serialize(function(){
    db.run("CREATE TABLE IF NOT EXISTS user_info (id Char, profile TEXT)")      
    // db.run("INSERT INTO user_info(id, profile) VALUES (?,?) WHERE NOT EXISTS (SELECT * FROM user_info WHERE id=item[0])", item[0],item[1],item[0])
    db.run("INSERT INTO user_info(id, profile) VALUES (?,?) ON DUPLICATE KEY UPDATE profile=?)", item[1])    
    // console.log(item)
  })
  db.close()
}
const QueryItem = function(id){
  db = new sqlite3.Database('./db/users.db')
  db.serialize(function(){
    db.all("SELECT * from user_info where id=?",id, function(err, rows){
      console.log(rows);
    })
  })
  db.close()
}

const DelItem = function(){}
const EditItem = function(){}
// module.exports.ConnectDB = ConnectDB;
// module.exports.CreateTable = CreateTable;
module.exports.InsertItem = InsertItem

// CreateTable();

InsertItem(['hekh', "買數字現在仍是個謎。但微軟有援引一位 GameStop 副總裁的話，稱 Project Scorpio Edition 的預售成績要好過正代的 Xbox One。"]);

QueryItem('hekh');