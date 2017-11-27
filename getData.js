const request = require('request')
//const async = require('async')
const dbHandler = require('./dbHandler')
const utils = require('./utils')
let settings;

//Use "-" (dash) for current logged-in user.

exports.saveProfile = function(AccessToken, RefreshToken, userID){
  return new Promise((resolve,reject)=>{
    settings = {
      headers: {
        'Authorization':' Bearer ' + AccessToken
      },
      url: 'https://api.fitbit.com/1/user/-/profile.json'
    };
    request.post(settings, function(error, response, body) {
      var Profile = JSON.parse(body)
      var keyNval = new Array();//a dict 2 insert
      //ASSUMPTION:always have data parsed, so the result array would be 2d(w layers of [])
      utils.trav(Profile,"Profl",keyNval) //XZNOTE should parse here and feed parsed json to dbHandler funcs

      let defaultLogin = new Date(-1)
      keyNval.push(['lastLogin',defaultLogin.toISOString().split('T')[0]])
      //keyNval.push(['zerotest','0'])
      //console.log(keyNval)
      var rowsChanged = dbHandler.save2DB('TOKEN2ID', 'names',0, Array([userID, AccessToken, RefreshToken])) //insert TOKEN and userID into the global table
      rowsChanged.then((value)=>{
          if(value > 0){
              console.log('saving profile for user ' + userID);
              dbHandler.save2DB(userID, 'profile', 1, keyNval).then(()=>{
                resolve();
              }).catch(reason=>{console.log(`ERROR in saveProfile: fail to save profile to ${userID}.db`)});
          } else {
              console.log('registerd user')
              resolve();
          }
      }).catch(reason=>{console.log('ERROR in saveProfile: fail to save name to TOKEN2ID.db') + reason});
    })
  })
}

//can choose among all day long / within certain hours, start date / end date
//check https://dev.fitbit.com/reference/web-api/activity/#get-activity-intraday-time-series
//may split the function, update datas column by column
//this function and the corresponding "get1dayActSeries3Resources1min" one is used for dynamic mechanism
//(but we won't be able to tell all day 0 step or data of the date not saved at all)
//
function get1dayActFromFitbitAPI(AccessToken, date, resource, stime = undefined, etime = undefined) {
    //get calories, steps, as well as distance
    //console.log("date:" + date)
    return new Promise((resolve, reject) => {
        var hhmmRegEx = new RegExp(/^([01]\d|2[0-3]):([0-5]\d)$/);//time should follow the patter HH:MM
        if(stime.match(hhmmRegEx) && etime.match(hhmmRegEx)){
            time = '/time/'+stime+'/'+etime
        } else {
            time = ''
        };
        //console.log('time pattern' + time);
        dataReq = {
          headers: {
            'Authorization':' Bearer ' + AccessToken
          },
          url: 'https://api.fitbit.com/1/user/-/activities/'+resource+'/date/'+date+'/1d/1min'+time+'.json'
        };

        //console.log(dataReq.url)
        request.get(dataReq, function(error, response, body) {
          if(error){
              reject(error)
          }
          var dataArray = []
          var data = JSON.parse(body)
          try{
            var series = data['activities-'+resource+'-intraday']['dataset']
            for(var itr = 0; itr < series.length; itr++) {
                ((itr)=>{
                    if(series[itr]['value'] > 0){
                       dataArray.push([date+'T'+series[itr]['time'],series[itr]['value']])
                    }
                })(itr)
            }
            //console.log('in-- '+resource+' length:'+dataArray.length + 'data example:\n')
            resolve(dataArray);
          } catch(err){
            console.log('err when calling ' + dataReq.url)
            console.log('body is '+body)
            resolve([])//here might get error:too many requests, since each user is allowed 150 requests every hour
          }
        });
    })
}

exports.get1dayActFromFitbitAPI = get1dayActFromFitbitAPI

//if we use this mechanism and find that we don't have the required data, we save the data automatically
exports.get1dayActSeries3Resources1min = function(AccessToken, date, userID) {
    //first query, if empty, then continue http://www.sqlitetutorial.net/sqlite-nodejs/query/
    //MODIFY! the date should not be fixed unless for debugging
    var startTime = date+'T00:00:00'
    var endTime = date+'T23:59:59'
    var actsList = (dbHandler.queryActivity(userID, 'activity', startTime, endTime))
    var nextOp = actsList.then( value => {
        console.log(value.length)
        if(!value.length) {
            console.log('no local record, request data from Fitbit API --- ')
            caloSeries = get1dayActFromFitbitAPI(AccessToken, date, 'calories', userID);
            stepSeries = get1dayActFromFitbitAPI(AccessToken, date, 'steps', userID);
            // distSeries = get1dayActFromFitbitAPI(AccessToken, date, 'distance', userID);
            Promise.all([caloSeries,stepSeries]).then(values => {
            //callback(values.map(...).reduce(...));
                var concatened = []
                for(var i = 0; i < values[0].length; i++){
                    //concatened[i] = [date+values[0][i][0],values[0][i][1],values[1][i][1]]
                    concatened[i] = [values[0][i][0],values[0][i][1],values[1][i][1]]
                }
                dbHandler.save2DB(userID, 'activity',2, concatened)
                return concatened//perhaps should modify to be resolve(concatened)
                //console.log('dim:' + concatened.length + ',' + concatened[0].length) //1440, 4
               // console.log(concatened)
            });
        } else {
            console.log('requested data found in local database')
            return value
        }
    }).catch(reason => {
        console.log(reason)
    })
}

function getActDataRequestHeader(AccessToken, resourceType, date){
    var dataReq = {
      headers: {
        'Authorization':' Bearer ' + AccessToken
      },
      url: 'https://api.fitbit.com/1/user/-/activities/'+resourceType+'/date/'+date+'/1d/1min.json'
    };
    return dataReq
}

function fitbitData2arr1Resource1day(AccessToken,requiredDates,resourceType, hourFilter = ['00:00','23:59']){
    return new Promise((resolve,reject)=>{
        if (resourceType !== 'steps' && resourceType !== 'calories')
          reject("err when calling fitbitData2arr1Resource1day, unsupported resource type!")
        var toUser = Promise.all(requiredDates.map((date)=>{
            return get1dayActFromFitbitAPI(AccessToken, date, resourceType,hourFilter[0],hourFilter[1])}))
        .then(values => {
            if(values.length){
                return new Promise((resolve, reject)=>{
                    resolve(values.reduce((accumulator, currentValue) => {
                            return accumulator.concat(currentValue);
                        }))
                })
            } else {
                return new Promise((resolve, reject)=>{
                    resolve([])
                })
            }
        }).then(value=>{resolve(value)})
    })
}

function mergeResources(steps, calories){
    console.log('merging~')
    var i = 0;
    var j = 0;
    var res = []
    while(i < steps.length && j < calories.length){
        while(calories[j][0] < steps[i][0]){j++;}
        while(steps[i][0] < calories[j][0]){i++;}
        if(i < steps.length && j < calories.length){
            res.push([steps[i][0],calories[j][1],steps[i][1]]);
            i++;j++;
        }
    }
    return res;
}

/** get data from Fitbit API
@param{Date} startDate, the date from which we require data from fitbit API
@param{Date} yesterday, yesterday since we assume that the data is not updated today
@param{Number Array}dayfilter, in number, to indicate what days of week is counted, e.g. [0,6] for weekend
@param{String Array}hourFilter, 2-entry array, each in HHMM format string, to indicate the time period that we are interested in. Notice that for other time period
 data is still store into local DB, although we don't rend it to user(frontend)
@param{String or String Array}resourceType, elems could be either 'steps' or 'calories' or both. However, that just decides what we rend to user. We store both
 type regardless of this parameter
@return{Promise} data array, each entry of format (YYYY-MM-DDTHH:MM:00, value of resourceType, [value of resourceType2])
**/
exports.getActDataFromFitbitAPI = function(resourceType, AccessToken, startDate, endDate = new Date(), dayFilter = [], hourFilter = ['00:00','23:59']){

    return new Promise((resolve, reject) => {
        //first filter the dates
        console.log('get act data from API startDate:'+startDate)
        console.log('get from API endDate:'+endDate)
        var requiredDates = utils.dayFilter(startDate, endDate, dayFilter)
        console.log('get act date from API filtered dates:\n'+requiredDates)
        //get data about both steps and calories of the filtered dates from API
        //parallel: 1.apply hourfilter and rend to user;
        //background operatoin:2.save data of all dates
        var toUser;
        if(!Array.isArray(resourceType)){
            toUser = fitbitData2arr1Resource1day(AccessToken,requiredDates,resourceType, hourFilter)
            toUser.then(value=>{resolve(value)})
        }
        else {
            toUser = fitbitData2arr1Resource1day(AccessToken,requiredDates,resourceType[0], hourFilter)
            if(resourceType.length == 1){
                toUser.then(value=>{resolve(value)})
            }
            else if(resourceType.length == 2){
                var toUser2 = fitbitData2arr1Resource1day(AccessToken,requiredDates,resourceType[1], hourFilter)
                if(resourceType[0] == 'steps'){
                    Promise.all([toUser,toUser2]).then(values=>{
                        resolve(mergeResources(values[0], values[1]))
                    }).catch(reason=>{  console.log('reason in merging try'+reason) })
                } else if(resourceType[1] == 'steps'){
                    Promise.all([toUser,toUser2]).then(values=>{
                        resolve(mergeResources(values[1], values[0]))
                    }).catch(reason=>{  console.log('reason in merging try'+reason) })
                } else {
                    reject('resource order wrong')
                }
            } else {
                reject('we only support steps and calories')
            }
        }
    })
}
/**save full data to local Database, notice that we call fitbit here separately to get FULL data
 * this function is discarded since it would cause additional data request
 *@param{String} userID, like '52KG66'
 *@param{String} AccessToken, the token we need to pass to fitbit API
 *@param{Date} startDate, start date of the time period that we want to get data, included
 *@param{Date} endDate, end date of the time period that we want to get data, not included
 #@return{Promise} a promise to make sure that this function could be waited.
 */
exports.saveFitbitAct2Local = function(userID, AccessToken, startDate, endDate = (new Date()).toISOString().split('T')[0]){
    return new Promise((resolve, reject) => {
      var requiredDates = utils.dayFilter(startDate, endDate, [])
      var stepsData = fitbitData2arr1Resource1day(AccessToken,requiredDates,'steps')
      var caloriesData = fitbitData2arr1Resource1day(AccessToken,requiredDates,'calories')
      Promise.all([stepsData,caloriesData]).then(values=>{
          var concatened = (mergeResources(values[0], values[1]))
          console.log('start writing to DB')
          return dbHandler.save2DB(userID, 'activity',2, concatened)
      }).catch(reason=>{  console.log('reason in saveFitbitAct2Local'+reason) })
      .then(() => {
            resolve(concatened)
          })
    })
}

/**
* This is a fake function since "If your application has the appropriate access, your calls to a time series endpoint for a specific day (by using start and end dates on the same day or a period of 1d), the response will include extended intraday values with a 1-minute detail level for that day."
*/
exports.getActInPeriodFromFitbitAPI = function(AccessToken, userID, sdate, edate, resource, stime = undefined, etime = undefined) {
    //get calories, steps, as well as distance
    //console.log("date:" + date)
    return new Promise((resolve, reject) => {
        var time = ''
        stime = '10:00'
        etime = '16:00'
        if(typeof(stime)==='string' && typeof(etime)==='string'){
            var hhmmRegEx = new RegExp(/^([01]\d|2[0-3]):([0-5]\d)$/);//time should follow the patter HH:MM
            if(stime.match(hhmmRegEx) && etime.match(hhmmRegEx)){
                time = '/time/'+stime+'/'+etime
            }
        }
        //console.log('time pattern' + time);
        dataReq = {
          headers: {
            'Authorization':' Bearer ' + AccessToken
          },
          url: 'https://api.fitbit.com/1/user/-/activities/'+resource+'/date/'+sdate+'/'+edate+'/1min'+time+'.json'
        };

        console.log(dataReq.url)
        request.get(dataReq, function(error, response, body) {
          if(error){
              reject(error)
          }
          var dataArray = []
          var data = JSON.parse(body)
          console.log(data)
          try{
            var series = data['activities-'+resource+'-intraday']['dataset']
            for(var itr = 0; itr < series.length; itr++) {
                ((itr)=>{
                    if(series[itr]['value'] > 0){
                       dataArray.push([date+'T'+series[itr]['time'],series[itr]['value']])
                    }
                })(itr)
            }
            //console.log('in-- '+resource+' length:'+dataArray.length + 'data example:\n')
            resolve(dataArray);
          } catch(err){
            console.log('err when calling ' + dataReq.url)
            console.log('body is '+body)
            resolve([])//here might get error:too many requests, since each user is allowed 150 requests every hour
          }
        });
    })
}
