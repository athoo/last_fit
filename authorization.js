exports.code  = {
    url: 'https://www.fitbit.com/oauth2/authorize',
    qs: {
      response_type: 'code',
      client_id: process.env.CLIENT_ID,
      redirect_uri: process.env.CALLBACK_URL,
      expires_in: '604800',
      scope: 'activity heartrate location nutrition profile settings sleep social weight'
    }
  }
  
exports.token = {
    headers: {
      'Authorization': process.env.AUTHORIZATION,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    url: 'https://api.fitbit.com/oauth2/token',
    form: {
      clientId: process.env.CLIENT_ID,
      grant_type: 'authorization_code',
      redirect_uri: process.env.CALLBACK_URL,
      code: ''
    }
  };