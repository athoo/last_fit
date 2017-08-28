const request = require('request')
let settings;

exports.GetProfile = function(AccessToken, UserId){
    settings = {
      headers: {
        'Authorization':' Bearer ' + AccessToken
      },
      url: 'https://api.fitbit.com/1/user/'+ UserId +'/profile.json'
    };
    request.get(settings, function(error, response, body) {
  
      var Profile = JSON.parse(body)
      // db_handler.CreateTable(USER_ID,AccessToken,REFRESH_TOKEN,moment().format(),body)
      console.log(Profile)
      return Profile
    })
  }

// exports.GetActivity = function(AccessToken, UserId) {

// }
