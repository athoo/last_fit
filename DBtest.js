var utils = require('./utils')
const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('./db/52KG66.db',/*TOKEN2ID*/ (err) => {//are we processing all data in a batch? or should avoid open-close cost
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the local SQlite database.');        
});

let sql = 'SELECT * FROM activity';//names';

/*db.each(sql, (err, row) => {
  if (err) {
    throw err;
  }
  console.log(row);
});*/
//check all table names or table attributes
/*db.serialize(function () {
    //db.all("select * from sqlite_master where type='table' AND name = 'labels'", function (err, tables) {
    db.run("DROP TABLE labels")
    db.all("select * from sqlite_master where type='table'", function (err, tables) {
        console.log(tables);
    });
});*/
//

db.each('SELECT * FROM labels', (err, row) => {
    if(err){
        console.log(err) 
    }
    console.log(row.categories)
})


db.close((err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Close the database connection.');
});
