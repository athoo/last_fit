var util = require('util')

//traverse when meeting nested obj, without unfolding arrays
function trav(obj, fieldName, res){
        for (var key in obj) {
           // func.apply(this,[i,obj[i]]);  
          //  console.log("key: " + key + ",val : " + obj[key]);
            if (obj[key] !== null && typeof(obj[key])=="object" && !util.isArray(obj[key])) {            
                trav(obj[key],fieldName.concat(key, '=_+'), res);
            } else {
                //console.log("elem met:" + key + ", fieldName:" + fieldName.concat(key))
                res.push([fieldName.concat(key),JSON.stringify(obj[key])]);//ZXTODO solve the null issue
            }
        }
}

exports.trav = trav;
