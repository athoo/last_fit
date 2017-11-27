var utils = require('./utils')
const sqlite3 = require('sqlite3').verbose();
const dbHandler = require('./dbHandler')
const request = require('request')

function checkDB(dbName, tableName){
    let db = new sqlite3.Database('./db/'+dbName+'.db',/*TOKEN2ID*/ (err) => {//are we processing all data in a batch? or should avoid open-close cost
        if (err) {
            return console.error(err.message);
        }
        console.log('Connected to the local SQlite database.');
    });

    let sql = 'SELECT * FROM '+tableName;//names;
    let prfSql = 'SELECT * FROM profile';
    let namesSql = 'SELECT * FROM names';

    db.each(sql, (err, row) => {
        if(err){
            console.log(err)
        }
        console.log(row)
    })

    db.close((err) => {
      if (err) {
        return console.error(err.message);
      }
      console.log('Close the database connection.');
    });
}

function updateLostLoginTest(){
    var today = new Date(-1)
    today = today.toISOString().split('T')[0]
    dbHandler.updateLastLogin('52KG66',today)
    checkDB('52KG66','profile');
}

function getDataFromLocDB(){
  var locadata = dbHandler.getActDataFromLocalDB('52KG66', 'calories', '2017-09-23T00:00:00', '2017-10-04:23:59:59',['1','2','3','4','5'])
  Promise.all([locadata]).then(val=>{
    console.log(val)
  })
}
//checkDB('52KG66','profile');
//checkDB('52KG66','activity');
getDataFromLocDB();
