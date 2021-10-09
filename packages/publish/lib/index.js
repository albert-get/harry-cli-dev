'use strict';

const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const Command = require('@harry-cli-dev/command')
const log = require('@harry-cli-dev/log')

class PublishCommand extends Command{
    init(){
        log.verbose('init',this._argv)
    }
    async exec(){
        try{
            const startTime = new Date().getTime()
            this.prepare()
            const endTime = new Date().getTime()
            log.info('本次发布耗时:',Math.floor((endTime - startTime)/1000)+'秒')
        }catch(e){
            log.error(e.message)
            if(process.env.LOG_LEVEL === 'verbose'){
                console.log(e)
            }
        }
    }
    prepare(){
        const projectPath = process.cwd()
        const pkgPath = path.resolve(projectPath, 'package.json');
        log.verbose('package.json',pkgPath)
        if(!fs.existsSync(pkgPath)){
            throw new Error('package.json不存在！')
        }
        const pkg = fse.readJSONSync(pkgPath)
        const {name, version, scripts } =pkg
        log.verbose('package.json',name, version, scripts)
        if(!name||!version||!scripts||!scripts.build){
            throw new Error('package.json信息不全，请检查是否存在name,version和scripts（需提供build命令）！')
        }
        this.projectInfo = {name,version,dir:projectPath}
    }
}

function init(argv){
    return new PublishCommand(argv)
}
module.exports =init;
module.exports.PublishCommand = PublishCommand;