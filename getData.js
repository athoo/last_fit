const request = require('request')
const async = require('async')
const dbHandler = require('./dbHandler')
const utils = require('./utils')
let settings;

//Use "-" (dash) for current logged-in user.

exports.GetProfile = function(AccessToken, RefreshToken, UserId){
    settings = {
      headers: {
        'Authorization':' Bearer ' + AccessToken
      },
      url: 'https://api.fitbit.com/1/user/-/profile.json'
    };
    request.get(settings, function(error, response, body) {  
      var Profile = JSON.parse(body)
      var keyNval = new Array();//a dict 2 insert
      //insert TOKEN and USERID into the global table      
      dbHandler.save2DB('TOKEN2ID', 'names',0, Array([UserId, AccessToken, RefreshToken]))
      //ASSUMPTION:always have data parsed, so the result array would be 2d(w layers of [])
      utils.trav(Profile,"Profl",keyNval) //XZNOTE
      console.log("rawData is \n")
      console.log(Profile)
      console.log("2 insert:\n")
 //     console.log(keyNval.slice(0,3) + '\n ...')
      dbHandler.save2DB(UserId, 'profile', 1, keyNval)//should parse here and feed parsed json to dbHandler funcs  */    
      return Profile
    })
  }
  
//can choose among all day long / within certain hours, start date / end date
//check https://dev.fitbit.com/reference/web-api/activity/#get-activity-intraday-time-series
//may split the function, update datas column by column
function Get1dayActSeries1minDetailed(AccessToken, date, resource) {
    //get calories, steps, as well as distance
    //console.log("date:" + date)
    return new Promise((resolve, reject) => {
        dataReq = {
          headers: {
            'Authorization':' Bearer ' + AccessToken
          },
          url: 'https://api.fitbit.com/1/user/-/activities/'+resource+'/date/'+date+'/1d/1min.json'
        };
            
        request.get(dataReq, function(error, response, body) {  
          if(error){
              reject(error)
          }
          var dataArray = []
          var data = JSON.parse(body)
          let series = data['activities-'+resource+'-intraday']['dataset']
          //console.log(series)
          for(var itr = 0; itr < series.length; itr++) {
              dataArray.push([series[itr]['time'],series[itr]['value']])
          }
          console.log('in-- '+resource+' length:'+dataArray.length + 'data example:\n')
          resolve(dataArray);
        });
    })
}

exports.Get1dayActSeries1minDetailed = Get1dayActSeries1minDetailed

exports.Get1dayActSeries3Resources1min = function(AccessToken, date, UserID) {
    //first query, if empty, then continue http://www.sqlitetutorial.net/sqlite-nodejs/query/
    //MODIFY! the date should not be fixed unless for debugging
    var startTime = date+'00:00:00'
    var endTime = date+'23:59:59'
    var actsList = (dbHandler.queryActivity(UserID, 'activity', startTime, endTime))
    var nextOp = actsList.then( value => {
        console.log(value.length)
        if(!value.length) {
            console.log('value len 0 --- '+value.length)
            caloSeries = Get1dayActSeries1minDetailed(AccessToken, date, 'calories', UserID);
            stepSeries = Get1dayActSeries1minDetailed(AccessToken, date, 'steps', UserID);
            // distSeries = Get1dayActSeries1minDetailed(AccessToken, date, 'distance', UserID);   
            Promise.all([caloSeries,stepSeries]).then(values => { 
            //callback(values.map(...).reduce(...));
                var concatened = []
                for(var i = 0; i < values[0].length; i++){
                    concatened[i] = [date+values[0][i][0],values[0][i][1],values[1][i][1]]
                }
                dbHandler.save2DB(UserID, 'activity',2, concatened)
                return concatened//perhaps should modify to be resolve(concatened)
                //console.log('dim:' + concatened.length + ',' + concatened[0].length) //1440, 4
               // console.log(concatened)
            });
        } else {
            //console.log(value)
            return value
        }        
    }).catch(reason => {
        console.log(reason)
    })    
}

