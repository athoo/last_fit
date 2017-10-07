const sqlite3 = require('sqlite3').verbose();
const async = require('async')

//horizontal(dim1):schema, column names, and placeholder format
//vertical(dim0): global token table, static info for a certain user, activity for a certain user, label record for a certain user
var schemaAndColName = [['(UserID PRIMARY KEY, accTok, refTok)','(UserID, accTok, refTok)','(?, ?, ?)'],
                        ['(dataType PRIMARY KEY, val)','(dataType, val)','(?, ?)'],
                        ['(time PRIMARY KEY, calories, steps)','(time, calories, steps)','(?, ?, ?)'],
                        ['(startTime, endTime, categories, PRIMARY KEY (startTime, endTime))','(startTime, endTime, categories)','(?, ?, ?)']]
//pay attention to schema name! should first write all other column names if want to use PRIMARY KEY (colA, colB)

exports.save2DB = function(UserID, tableName,tableType, data){//dbName,tableName,tableType mode(0,1,2), data
    //datatype should be a concatenated one got in corresponding getData module
    let db = new sqlite3.Database('./db/'+UserID+'.db', (err) => {//are we processing all data in a batch? or should avoid open-close cost
        if (err) {
            return console.error(err.message);
        }
        console.log('Connected to the local SQlite database:./db/'+UserID+'.db');        
    });
        
    var schema = schemaAndColName[tableType][0]
    var colsName = schemaAndColName[tableType][1]
    var placeHolder = schemaAndColName[tableType][2]
        
    var insertSql = `INSERT OR IGNORE INTO ${tableName} ${colsName} VALUES ${placeHolder}`
    console.log(insertSql)    
    
    db.serialize(() => {
      // check whether table exist
        db.run(`CREATE TABLE IF NOT EXISTS ${tableName} ${schema}`,function(err) {
            if (err) {
                return console.error('err Creating table\n'+err.message);
            }
            console.log('table ' + tableName + ' in DB file ' + UserID + ' created.')
        });
        
        //db.serialize(()=>{
        db.parallelize(()=>{        
            for(var dp in data) {//data piece
                let complData = data[dp]
                console.log("value:", complData)
                db.run(insertSql, complData, function(err) {
                  if (err) {
                    return console.error('errLine42'+err.message);
                  }
                  console.log(`Rows inserted ${this.changes}`);
                });
            }//check whether the inserted user ID is correct!
        });
    });
        
    db.close((err) => {
      if (err) {
        return console.error('Error Closing'+err.message);
      }
      console.log('Close the database connection.');
    });
}

exports.createTables = function(UserID){
    return new Promise((resolve, reject)=>{
        let db = new sqlite3.Database('./db/'+UserID+'.db', (err) => {//
            if (err) {
                reject(err);
                console.log('No user data for UserID: '+UserID);
            }            
        });
        var lblSchema = schemaAndColName[3][0]
        var actSchema = schemaAndColName[2][0]
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS labels ${lblSchema}`,function(err) {
                console.log(`CREATE TABLE IF NOT EXISTS labels ${lblSchema}`)
                if (err) {
                    //reject(err)
                    console.log('Error when trying to create table Labels for user : '+UserID);
                } else{
                    console.log('table labels in DB file ' + UserID + ' created.')
                }            
            });
            db.run(`CREATE TABLE IF NOT EXISTS activity ${actSchema}`,function(err) {
                console.log(`CREATE TABLE IF NOT EXISTS activity ${actSchema}`)
                if (err) {
                    reject(err)
                    console.log('Error when trying to create table activity for user : '+UserID);
                } else {
                    console.log('table activity in DB file ' + UserID + ' created.')
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

//exactTime, while query labels comes down to whether use union or intersection
exports.queryActivity = function(UserID, tableName, timeStart, timeEnd){
    return new Promise((resolve, reject) => {
        let db = new sqlite3.Database('./db/'+UserID+'.db', (err) => {
            if (err) {
                reject(err);
                console.log('No user data for UserID: '+UserID);
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

exports.queryLabels = function(UserID, timeStart, timeEnd){
    return new Promise((resolve, reject) => {
        let db = new sqlite3.Database('./db/'+UserID+'.db', (err) => {//are we processing all data in a batch? or should avoid open-close cost
            if (err) {
                reject(err);
                console.log('No user data for UserID: '+UserID);
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

exports.updateLabels = function(UserID, toUpdate){//TODO how to deal with multiple label?
//queryLabels in single entry format, this is in batch processing format
//element of toUpdate should be of format [startTime, endTime, target categories], so toUpdate is a 2d array
    return new Promise((resolve, reject) => {
        let db = new sqlite3.Database('./db/'+UserID+'.db', (err) => {//are we processing all data in a batch? or should avoid open-close cost
            if (err) {
                reject(err);
                console.log('No user data for UserID: '+UserID + '\n'+err);
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
            var startTime = toUpdate[i][0];
            var endTime = toUpdate[i][1];
            var newVal = toUpdate[i][2];
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