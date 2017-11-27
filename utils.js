var util = require('util')
var moment = require('moment')

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

exports.dayFilter = function (startDate, endDate, dayFilter){
    var dates = []
    for (var m = moment(startDate);  m.isBefore(endDate); m.add(1, 'days')) {
        if(dayFilter.includes(m.day()) || !dayFilter.length){
            dates.push(m.format('YYYY-MM-DD'));
        }
    }
/*    console.log('filtered in utils.dayFilter:')
    console.log(dates)*/
    return dates;
}

exports.dayCompFilter = function (startDate, endDate, dayFilter){
    /**complementary function of dayFilter    **/
    var dates = []
    if(!dayFilter.length){
        return dates;
    }
    for (var m = moment(startDate);  m.isBefore(endDate); m.add(1, 'days')) {
        if(dayFilter.includes(m.day())){
            dates.push(m.format('YYYY-MM-DD'));
        }
    }
    return dates;
}

//var dates = dayFilter('2017-10-01','2017-10-15',[2,4,6])
//console.log(dates)
exports.trav = trav;

const HHMMfmt = new RegExp(/^([01]\d|2[0-3]):([0-5]\d)$/);
exports.inHHMMformat = function(time){
    return time.match(HHMMfmt)
}
