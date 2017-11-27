const sqlite3 = require('sqlite3').verbose();
const utils = require('./utils')
//const async = require('async')

//horizontal(dim1):schema, column names, and placeholder format
//vertical(dim0): global token table, profile info for a certain user, activity for a certain user, label record for a certain user
var schemaAndColName = [['(userID PRIMARY KEY, accTok, refTok)','(userID, accTok, refTok)','(?, ?, ?)'],
                        ['(dataType PRIMARY KEY, val)','(dataType, val)','(?, ?)'],
                        ['(time PRIMARY KEY, calories, steps)','(time, calories, steps)','(?, ?, ?)'],
                        ['(startTime, endTime, categories, PRIMARY KEY (startTime, endTime))','(startTime, endTime, categories)','(?, ?, ?)']]
//pay attention to schema name! should first write all other column names if want to use PRIMARY KEY (colA, colB)

//for activity, we want to first check date, then
exports.save2DB = function(userID, tableName,tableType, data){//dbName,tableName,tableType mode(0,1,2), data
    //datatype should be a concatenated one got in corresponding getData module
    return new Promise((resolve, reject) => {
        let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {//are we processing all data in a batch? or should avoid open-close cost
            if (err) {
                return console.error(err.message);
            }
            console.log('Connected to the local SQlite database:./db/'+userID+'.db');
        });

        var schema = schemaAndColName[tableType][0]
        var colsName = schemaAndColName[tableType][1]
        var placeHolder = schemaAndColName[tableType][2]

        var insertSql = `INSERT OR IGNORE INTO ${tableName} ${colsName} VALUES ${placeHolder}`

        var totalChange = 0;
        //serielize here coz we want to make sure the table is created
        //db.serialize(() => {
          // check whether table exist
        db.run(`CREATE TABLE IF NOT EXISTS ${tableName} ${schema}`,function(err) {
            if (err) {
                return console.error('err Creating table\n'+err.message);
            }
            console.log('table ' + tableName + ' in DB file ' + userID + ' created.')
            db.run("begin transaction");//to speed up the insertion, we use transaction here
            var stmt = db.prepare(insertSql);
            db.parallelize(()=>{
                for(var dp in data) {//data piece
                    ((dp)=>{
                        let complData = data[dp]
                        //if(tableType !== 2 || complData[2] > 0){
                        //we do non zero check outside
                            stmt.run(complData, function(err) {//TODO try to use multiple placeholder and insert data all at once
                                if (err) {
                                    return console.error('errLine42'+err.message);
                                }
                                if(this.changes){
                                    totalChange += this.changes
                                }
                            });

                    })(dp);
                }//check whether the inserted user ID is correct!
            });
            stmt.finalize();
            db.run("commit");
        });

        db.close((err) => {
          if (err) {
            return console.error('Error Closing'+err.message);
          }
          resolve(totalChange)
          console.log('Close the database connection.');
        });
    })
}

exports.createTables = function(userID){
    return new Promise((resolve, reject)=>{
        let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {//
            if (err) {
                reject(err);
                console.log('No user data for userID: '+userID);
            }
        });
        var lblSchema = schemaAndColName[3][0]
        var actSchema = schemaAndColName[2][0]
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS labels ${lblSchema}`,function(err) {
                console.log(`CREATE TABLE IF NOT EXISTS labels ${lblSchema}`)
                if (err) {
                    //reject(err)
                    console.log('Error when trying to create table Labels for user : '+userID);
                } else{
                    console.log('table labels in DB file ' + userID + ' created.')
                }
            });
            db.run(`CREATE TABLE IF NOT EXISTS activity ${actSchema}`,function(err) {
                console.log(`CREATE TABLE IF NOT EXISTS activity ${actSchema}`)
                if (err) {
                    reject(err)
                    console.log('Error when trying to create table activity for user : '+userID);
                } else {
                    console.log('table activity in DB file ' + userID + ' created.')
                }
            });
        })
        db.close((err) => {
          if (err) {
            reject(err)
          }
          console.log('Close the database connection.');
          resolve()
        });
    })
}

exports.queryLabels = function(userID, timeStart, timeEnd){
    return new Promise((resolve, reject) => {
        let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {//are we processing all data in a batch? or should avoid open-close cost
            if (err) {
                reject(err);
                console.log('No user data for userID: '+userID);
            }
        });

        let sql = `SELECT startTime stime, endTime etime, categories cats
                   FROM labels
                   WHERE startTime >= ? AND endTime <= ?`;//TODO should return intersection? or as long as overlapping would be ok?

        var actList = new Array();
        db.each(sql, [timeStart, timeEnd], (err, row) => {
          if (err) {
            reject(err);
          }
          //console.log(`${row.time}, ${row.cal}, ${row.steps}`)
          actList.push([row.stime,row.etime,row.cats])
        }, ()=>{
            db.close();
            console.log('query result, in total '+actList.length+' records')
            resolve(actList)
        })
    })
}

exports.updateLabels = function(userID, toUpdate){//TODO how to deal with multiple label?
//queryLabels in single entry format, this is in batch processing format
//element of toUpdate should be of format [startTime, endTime, target categories], so toUpdate is a 2d array
    return new Promise((resolve, reject) => {
        let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {//are we processing all data in a batch? or should avoid open-close cost
            if (err) {
                reject(err);
                console.log('No user data for userID: '+userID + '\n'+err);
            }
        });

        console.log('pure data is \n'+toUpdate)
        var qrySql = `SELECT startTime stime, endTime etime, categories lbls FROM labels
                      WHERE startTime = ? AND endTime = ? `;
        var isrtSql = `INSERT INTO labels (startTime, endTime, categories) VALUES (?,?,?)`;
        var updSql = `UPDATE labels SET categories = ?
                        WHERE startTime = ? AND endTime = ?`;

        /*async.each(toUpdate, (value => {
            var startTime = value[0];
            var endTime = value[1];
            var newVal = value[2];*/
        for (var i = 0; i < toUpdate.length; i++){
            var startTime = toUpdate[i][0], endTime = toUpdate[i][1], newVal = toUpdate[i][2];
            (function (startTime, endTime, newVal) {
                console.log(startTime + ', ' + endTime + ', ' + newVal)
                db.get(qrySql, [startTime, endTime], (err, row) => {
                    if(err){
                        console.log('error occured when updating data:')
                    }
                    console.log('in,  newVal:'+newVal)
                    var updateExisted = false;
                    var parsedArr;
                    if(row){
                        console.log('query res:'+row)
                        parsedArr = JSON.parse(row.lbls)
                        if(!parsedArr.includes(newVal)){
                            updateExisted = true;//else, this label has already been recorded
                        }
                    }
                    if(updateExisted){//this time period already recorded with at least one label
                        console.log('parsed array:')
                        console.log(parsedArr)
                        parsedArr.push(newVal)
                        console.log('new parsed array:')
                        console.log(parsedArr)
                        db.run(updSql,[JSON.stringify(parsedArr), startTime, endTime], function(err) {
                            if (err) {
                                console.error('err updating ' + err.message)
                                reject(err)
                            }
                            console.log(`Rows updated ${this.changes}`);
                        });
                    } else if(!row){     //the to be recorded label not exist
                        var newJSON = JSON.stringify([newVal])
                        //console.log('new value is ' + newSet)
                        if(newJSON)
                        db.run(isrtSql,[startTime, endTime, newJSON], function(err) {
                            if (err) {
                                console.error('err updating -- inserting -- '+err.message);
                                reject(err)
                            }
                            console.log(`Rows inserted ${this.changes}`);
                        });
                    }
                })
            })(startTime, endTime, newVal);
        };//), (()=>{
        db.close((err) => {
          if (err) {
            return console.error('Error Closing'+err.message);
          }
          console.log('DB updating finished.');
          resolve();
        });
    //}))
    })
}

exports.getToken = function(userID){
    return new Promise((resolve, reject)=>{
        var sql = `SELECT accTok tok FROM names WHERE userID = ?`
        let db = new sqlite3.Database('./db/TOKEN2ID.db', (err) => {
            if (err) {
                reject('Error on opening TOKEN2ID' + err);
            }
        });
        console.log('get token of user ' + userID)
        db.get(sql,userID,(err,row)=>{
            if(row){
                resolve(row.tok)
            } else {
                var errMsg = 'no userID ' + userID + ' found'
                errMsg += err?err:''
                reject(errMsg)
            }
        });
        db.close((err) => {
          if (err) {
            reject('Error on closing TOKEN2ID' + err);
          }
        });
    })
}

exports.getLastLogin = function(userID){
    return new Promise((resolve, reject)=>{
        var sql = `SELECT val val FROM profile WHERE dataType = 'lastLogin'`
        let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {
            if (err) {
                reject('Error on opening TOKEN2ID' + err);
            }
        });
        console.log('get token of user ' + userID)
        db.get(sql,[],(err,row)=>{
            if(row){
                resolve(row.val)
            } else {
                var errMsg = 'no userID ' + userID + ' found'
                errMsg += err?err:''
                reject(errMsg)
            }
        });
        db.close((err) => {
          if (err) {
            reject('Error on closing TOKEN2ID' + err);
          }
        });
    })
}

exports.updateLastLogin = function(userID, newLastLogin){
    console.log('updating last login')
    var updSql = `UPDATE profile SET val = ?
                        WHERE dataType = ?`
    let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {
        if (err) {
            console.log('Error on opening TOKEN2ID' + err);
        }
    });
    db.run(updSql,[newLastLogin,'lastLogin'],(err,row)=>{
        if(err){
            console.log(err)
        }
    });
    db.close((err) => {
      if (err) {
        console.log('Error on closing TOKEN2ID' + err);
      }
    });
}

exports.getProfile = function(userID){
    return new Promise((resolve, reject)=>{
        var existOrNot = `SELECT * FROM names WHERE userID = ?`
        let db = new sqlite3.Database('./db/TOKEN2ID.db', (err) => {
            if (err) {
                reject('Error on opening TOKEN2ID' + err);
            }
        });
        db.get(existOrNot,userID,(err,row)=>{
            if (err) {
                reject(`Error on retrieving user data for userID: ${userID}\n`+err);
            }
            if(!row) {
                reject(`No user data of userID: ${userID}\n`+err);
            } else{
                let profileDB = new sqlite3.Database('./db/'+userID+'.db', (err) => {
                    if (err) {
                        reject(`Error on opening ${userID}.db` + err);
                    }
                });
                profileDB.all(`SELECT dataType, val FROM profile`, [], (err, rows) => {
                    resolve(rows)
                })
                profileDB.close((err) => {
                  if (err) {
                    reject('Error on closing TOKEN2ID' + err);
                  }
                });
            }
        });
        db.close((err) => {
          if (err) {
            reject('Error on closing TOKEN2ID' + err);
          }
        });
    })
}

//exactTime, while query labels comes down to whether use union or intersection
exports.queryActivity = function(userID, tableName, timeStart, timeEnd){
    return new Promise((resolve, reject) => {
        let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {
            if (err) {
                reject(err);
                console.log('No user data for userID: '+userID);
            }
        });

        let sql = `SELECT time time, calories cal, steps steps
                   FROM ${tableName}
                   WHERE time >= ? AND time <= ?`;

        var actList = new Array();
        db.each(sql, [timeStart, timeEnd], (err, row) => {
          if (err) {
            reject(err);
          }
          //console.log(`${row.time}, ${row.cal}, ${row.steps}`)
          actList.push([row.time,row.cal,row.steps])
        }, ()=>{
            db.close();
            console.log('correctly closed db connection, result#:',actList)
            resolve(actList)
        })
    })
}

exports.getActDataFromLocalDB = function(userID, resourceType, startDay, endDay, dayFilter = [], hourFilter = []){
    console.log(`get data of ${userID} about ${resourceType} from ${startDay}
      to ${endDay}, with hourFilter ${hourFilter} and dayFilter ${dayFilter}`)
    return new Promise((resolve,reject)=>{
        if (startDay > endDay){
            resolve([])
        }
        let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {
            if (err) {
                reject(err);
                console.log('No user data for userID: '+userID);
            }
        });
        var paramArr = []
        var queryCols;
        var mode;
        if(Array.isArray(resourceType) && resourceType.includes('steps') && resourceType.includes('calories')){
            queryCols = 'time time, calories cal, steps steps'
            mode = 'cs'
        } else if(resourceType == 'steps' || resourceType.includes('steps')){
            queryCols = 'time time, steps steps'
            mode = 's'
        } else if(resourceType == 'calories' || resourceType.includes('steps')){
            queryCols = 'time time, calories cal'
            mode = 'c'
        }
        let sql = `SELECT ${queryCols}
                   FROM activity
                   WHERE time >= ? AND time < ? `

        paramArr = paramArr.concat([startDay, endDay])
        if (Array.isArray(dayFilter) && dayFilter.length > 0 && dayFilter.length < 6){
            var dayOfWeekHolder = dayFilter.map((day) => '?').join(',');
            dayOfWeekHolder = '(' + dayOfWeekHolder + ')'
            sql += `AND strftime('%w', time) IN ${dayOfWeekHolder} `
            paramArr = paramArr.concat(dayFilter.map((day) => day.toString()))
        }

        if (Array.isArray(hourFilter) && hourFilter.length == 2 && utils.inHHMMformat(hourFilter[0]) && utils.inHHMMformat(hourFilter[1])){
            sql += `AND (strftime('%H', time) > ? OR (strftime('%H', time) = ? AND strftime('%M', time) > ?))
                   AND (strftime('%H', time) < ? OR (strftime('%H', time) = ? AND strftime('%M', time) < ?))`
            var [sHH, sMM] = hourFilter[0].split(':')
            var [eHH, eMM] = hourFilter[1].split(':')
            paramArr = paramArr.concat([sHH,sHH,sMM,eHH,eHH,eMM])
        }

        var res = []
        console.log('sql statement is : '+sql)
        console.log('select params: '+paramArr)
        db.each(sql,paramArr, (err, row) => {
            if(err){
                console.log('error displaying formatted time'+err)
            }
            if(row) {
              //console.log(row)
              switch(mode){
                  case 'c':
                      res.push([row.time,row.cal])
                      break;
                  case 's':
                      res.push([row.time,row.steps])
                      break;
                  case 'cs':
                      res.push([row.time,row.cal,row.steps])
                      break;
                  default:
                      reject('invalid resources type')
              }
            }
        },()=>{
            db.close();
            console.log('reslength == '+res.length)
            console.log('data read from local DB')
            resolve(res)
        });
    })
}

exports.getMemberSinceDate = function(userID){
    return new Promise((resolve, reject)=>{
        let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {
            if (err) {
                reject('Error on opening TOKEN2ID' + err);
            }
        });
        let sql = 'SELECT val val FROM profile WHERE dataType = ?'
        db.get(sql,'Profluser=_+memberSince',(err,row)=>{
                if(row){
                    resolve(row.val)
                } else {
                    var errMsg = 'no memberSince data for user ' + userID
                    errMsg += err?err:''
                    reject(errMsg)
                }
        });
        db.close((err) => {
          if (err) {
            reject('Error on closing TOKEN2ID' + err);
          }
        });
    })
}
