const sqlite3 = require('sqlite3').verbose();
const utils = require('./utils')
//const async = require('async')

//horizontal(dim1):schema, column names, and placeholder format
//vertical(dim0): names-global token table, profile-profile info for a certain user, activity-activity for a certain user, labels-label record for a certain user
var schemaAndColName = [['(userID PRIMARY KEY, accTok, refTok)','(userID, accTok, refTok)','(?, ?, ?)'],
                        ['(dataType PRIMARY KEY, val)','(dataType, val)','(?, ?)'],
                        ['(time PRIMARY KEY, calories, steps)','(time, calories, steps)','(?, ?, ?)'],
                        ['(startTime, endTime, labelName, totalSteps, totalCals, subjectiveNotes, PRIMARY KEY (startTime, endTime))','(startTime, endTime, labelName, totalSteps, totalCals, subjectiveNotes)','(?, ?, ?, ?, ?,?)'],
                        ['(startTime, endTime, planLblName, aveIntensity, planSet, PRIMARY KEY (startTime, endTime, planSet))','(startTime, endTime, planLblName, aveIntensity, planSet)','(?,?,?,?,?)']]
//pay attention to schema name! should first write all other column names if want to use PRIMARY KEY (colA, colB)

//TODO here we actually open->create tables->close, and after in the voking function open again. improve with callback function format
function createTables (userID, tableType, tableName){
    return new Promise((resolve, reject)=>{
        let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {//
            if (err) {
                reject(err);
                console.log('No db file for userID: '+userID);
            }
        });
        var schema = schemaAndColName[tableType][0]
        var colsName = schemaAndColName[tableType][1]
        var placeHolder = schemaAndColName[tableType][2]
        var createSql = `CREATE TABLE IF NOT EXISTS ${tableName} ${schema}`
        db.serialize(() => {
            db.run(createSql, function(err) {
              //  console.log(createSql)
                if (err) {
                    reject(err)
                    console.log(`Error when trying to create table ${tableName} for user : `+userID);
                } else{
                    console.log(`table ${tableName} in DB file` + userID + ' created.')
                }
            });
        })
        db.close((err) => {
          if (err) {
            reject(err)
          }
          resolve()
        });
    })
}

//for activity, we want to first check date, then
function save2DB(userID, tableName,tableType, data){//dbName,tableName,tableType mode(0,1,2), data
    //datatype should be a concatenated one got in corresponding getData module
    return new Promise((resolve, reject) => {
    //    var schema = schemaAndColName[tableType][0]
        var colsName = schemaAndColName[tableType][1]
        var placeHolder = schemaAndColName[tableType][2]

        var insertSql = `INSERT OR IGNORE INTO ${tableName} ${colsName} VALUES ${placeHolder}`

        var totalChange = 0;

        createTables(userID, tableType, tableName).then(()=>{
          let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {//are we processing all data in a batch? or should avoid open-close cost
              if (err) {
                  reject(console.error(err.message));
              }
            //  console.log('Connected to the local SQlite database:./db/'+userID+'.db');
          });
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
          db.close((err) => {
            if (err) {
              return console.error('Error Closing'+err.message);
            }
            console.log(`save2DB, in total ${totalChange} changes`)
            resolve(totalChange);
  //          console.log('Close the database connection.');
          });
      })
    })
}

exports.save2DB = save2DB;

exports.queryLabels = function(userID){
    return new Promise((resolve, reject) => {
        let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {//are we processing all data in a batch? or should avoid open-close cost
            if (err) {
                reject(`No user data for userID: ${userID}` + err);
                console.log();
            }
            console.log('linked to DB of ' + userID + ' to check labels');
        });
//startTime, endTime, labelName, totalSteps, totalCals, subjectiveNotes
        let sql = `SELECT startTime stime, endTime etime, labelName lbl, totalSteps ttstp, totalCals cal, subjectiveNotes subj
                   FROM labels`;//
                   //WHERE startTime >= ? AND endTime <= ?`;//TODO should return intersection? or as long as overlapping would be ok?
        var actList = new Array();
        db.each(sql, [], (err, row) => {
          if (err) {
            reject(err);
          }
        //  console.log(row);
          actList.push([row.stime,row.etime,row.lbl,row.ttstp,row.cal,row.subj])
        }, ()=>{
            db.close();
            console.log('query result, in total '+actList.length+' records')
            resolve(actList)
        })
    })
}

/**previously implemented a version that can check whether label created here and update if exists:
  *e.g., 2017-10-10T12:30,2017-10-10T13:30, "running", now want to add another label:"group work"
  *here we assume that the database already created for this user.
  *we mainly test only insertion, not update since we don't know how to update totalSteps(currently only updating labelName and subjectiveNotes allowed)
  @param{string} userID
  @param{Array} 2d array, element should be of format [startTime, endTime, labelName, totalSteps, totalCals, subjectiveNotes], so toUpdate is a 2d array,
  if don't want to update a certain term ,should pass '' as the value of that column
  here, subjectiveNotes would be a longer description
  */
exports.updateLabels = function(userID, toUpdate){//TODO how to deal with multiple label?
//queryLabels in single entry format, this is in batch processing format
    return new Promise((resolve, reject) => {
        var tableType = 3;
        createTables(userID, tableType, 'labels').then(()=>{
          let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {//are we processing all data in a batch? or should avoid open-close cost
              if (err) {
                  reject(err);
                  console.log('No user data for userID: '+userID + '\n'+err);
              }
          });
          console.log('pure data is \n'+toUpdate)
          var colsName = schemaAndColName[tableType][1]
          var placeHolder = schemaAndColName[tableType][2]//var placeHolder = schemaAndColName[tableType][1].map((itm) => '?').join(',');
          //actually not necessary, select * would be good enough since we only care exist or not
          var qrySql = `SELECT startTime stime, endTime etime, labelName lbls, subjectiveNotes subj FROM labels
                        WHERE startTime = ? AND endTime = ? `;
          var isrtSql = `INSERT INTO labels ${colsName} VALUES ${placeHolder}`;
          //currently we don;t support modification of totalSteps and Calories
          var updSql = `UPDATE labels SET labelName = ?, subjectiveNotes = ?
                          WHERE startTime = ? AND endTime = ?`;

          for (var i = 0; i < toUpdate.length; i++){
              //console.log(toUpdate[i])
              var tempArr = toUpdate[i];
              var [startTime, endTime, newLabel, steps, cals, newSubj] = tempArr;
              console.log('new Subj is ' + newSubj);
              (function (startTime, endTime, newLabel, steps, cals, newSubj) {
                  console.log(startTime + ', ' + endTime + ', ' + newLabel);
                  db.get(qrySql, [startTime, endTime], (err, row) => {
                      if(err){
                          console.log('error occured when updating data:')
                      }
                    //  console.log('in,  newLabel:'+newLabel)
                      var updateExisted = false;
                      var origLabels, origSubjNotes;
                      if(row){
                          console.log('query res:'+row)
                          origLabels = JSON.parse(row.lbls)
                          origSubjNotes = JSON.parse(row.subj)
                          if(!origLabels.includes(newLabel) || !origSubjNotes.includes(newSubj)){
                              updateExisted = true;//else, this label has already been recorded
                          }
                      }
                      if(updateExisted){//this time period already recorded with at least one label
                          console.log('parsed original labels and original subjective notes:')
                          console.log(origLabels)
                          console.log(origSubjNotes)
                          if(newLabel !== '')
                            origLabels.push(newLabel)//now actually become new label
                          if(newSubj !== '')
                            origSubjNotes.push(newSubj)
                          console.log('new parsed array:')
                          console.log(origLabels)
                          db.run(updSql,[JSON.stringify(origLabels), JSON.stringify(origSubjNotes), startTime, endTime], function(err) {
                              if (err) {
                                  console.error('err updating ' + err.message)
                                  reject(err)
                              }
                              console.log(`Rows updated ${this.changes}`);
                          });
                      } else if(!row){     //the to be recorded label not exist
                          var newJSONLbl = JSON.stringify([newLabel])
                          var newJSONSubj = JSON.stringify([newSubj])
                          startTime, endTime, newJSONLbl, steps, cals, newJSONSubj
                          //console.log('new value is ' + newSet)
                          if(newJSONLbl || newJSONSubj)
                          db.run(isrtSql,[startTime, endTime, newJSONLbl, steps, cals, newJSONSubj], function(err) {
                              if (err) {
                                  console.error('err updating -- inserting -- '+err.message);
                                  reject(err)
                              }
                              console.log(`Rows inserted ${this.changes}`);
                          });
                      }
                  })
              })(startTime, endTime, newLabel, steps, cals, newSubj);
          };//), (()=>{
          db.close((err) => {
            if (err) {
              return console.error('Error Closing'+err.message);
            }
            console.log('DB updating finished.');
            resolve();
          });
        })
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
        console.log('get token of user ' + userID + 'in getToken')
        db.get(sql,userID,(err,row)=>{
            if(row){
                resolve(row.tok)
            } else {
                var errMsg = 'no userID ' + userID + ' found when trying to getToken'
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
        console.log('get token of user ' + userID + 'to check last login')
        db.get(sql,[],(err,row)=>{
            if(row){
                resolve(row.val)
            } else {
                var errMsg = 'no userID ' + userID + ' found when trying to update lastLogin'
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
        var res = []
        if (startDay > endDay){
            resolve(res)
        }
        let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {
            if (err) {
                reject('No user data for userID: ' + userID + err);
            }
        });
        var paramArr = [];
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
            db.close((err)=>{
              console.log('data read from local DB, reslength == '+res.length)
              resolve(res);
            });
        });
    })
}

//currently useless
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

//['(startTime, endTime, planLblName, aveIntensity, planSet, PRIMARY KEY (startTime, endTime, planSet))','startTime, endTime, planLblName, aveIntensity, planSet','(?,?,?,?,?)']
//every plan with following format:startTime, endTime, planLblName(cal/minute), aveIntensity, planSet
exports.getPlan = function(userID,startTime, endTime, planSet){
  console.log(`get plan of ${userID} from ${startTime} to ${endTime}`)
  return new Promise((resolve,reject)=>{
      var res = []
      if (startTime > endTime){
          resolve(res)
      }
      let db = new sqlite3.Database('./db/'+userID+'.db', (err) => {
          if (err) {
              reject('No user data for userID: ' + userID + err);
          }
      });
      var paramArr = [startTime, endTime, planSet];
      var queryCols = 'startTime stime, endTime etime, planLblName pln, aveIntensity itst, planSet pset'

      let sql = `SELECT ${queryCols}
                 FROM plan
                 WHERE stime >= ? AND etime < ? AND pset == ?`


  //    console.log('sql statement is : '+sql)
  //    console.log('select params: '+paramArr)
      db.each(sql,paramArr, (err, row) => {
          if(err){
              console.log('error displaying formatted time'+err)
          }
          if(row) {
              console.log(row)
              res.push([row.stime,row.etime,row.pln, row.itst,row.pset])
          }
      },()=>{
          db.close((err)=>{
            console.log('data read from local DB, reslength == '+res.length)
            resolve(res);
          });
      });
  })
}

exports.setPlan = function(userID, planArr, date){
  return new Promise((resolve,reject)=>{
    createTables(userID, 4, 'plan').then(()=>{
      let db = new sqlite3.Database('./db/'+userID+'.db');//no worry db wrong
      let sql = `DELETE FROM plan WHERE date(startTime) == ?`;//
                 //WHERE startTime >= ? AND endTime <= ?`;//TODO should return intersection? or as long as overlapping would be ok?
      db.each(sql, date, (err) => {
        if (err) {reject(err);}
      }, ()=>{
          db.close();
        //  console.log('before return');
          if(planArr.length !== 0){
              save2DB(userID, 'plan', 4, planArr).then(()=>{resolve();});
          } else {
              resolve();
          }
      })
    }).catch(reason=>{reject('err checking data in createTables' + reason)});
  })
  //console.log('quit from set plan');
}
