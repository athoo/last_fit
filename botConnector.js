require('dotenv').config();
const request = require('request');

let messenger_token = process.env.MESSENGER_TOKEN
exports.sendText = function(sender, text) {
	let messageData = {text: text}
	request({
		url:"https://graph.facebook.com/v2.6/me/messages",
		qs: {access_token: messenger_token},
		method: "post",
		json: {
			recipient: {id: sender},
			message: messageData
		}
	}, function(error, response, body) {
		if (error) {
			console.log("sending error");
		} else if (response.body.error) {
			console.log("response body error")
		}
	})
}