const request = require('@harry-cli-dev/request');

module.exports = function (){
    return request({
        url:'/project/template',
    })
}