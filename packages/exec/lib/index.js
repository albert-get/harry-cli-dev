'use strict';

const path = require('path');
const Package = require('@harry-cli-dev/package');
const log = require('@harry-cli-dev/log');
const {exec:spawn} = require('@harry-cli-dev/utils')

const SETTINGS = {
    init:'@harry-cli-dev/init',
    pubilsh:'@harry-cli-dev/publish'
}

const CACHE_DIR = 'dependencies'

async function exec(){
    let targetPath = process.env.CLI_TARGETPATH;
    const homePath = process.env.CLI_HOMEPATH;
    let storeDir = '';
    let pkg;
    log.verbose('targetPath',targetPath)
    log.verbose('homePath',homePath)

    const cmdObj = arguments[arguments.length - 1]
    const cmdName = cmdObj.name()
    const packageName = SETTINGS[cmdName]
    const packageVersion = 'latest'

    if(!targetPath){
        targetPath = path.resolve(homePath,CACHE_DIR);
        storeDir = path.resolve(targetPath, 'node_modules');
        log.verbose('targetPath', targetPath)
        log.verbose('storeDir',storeDir)
        pkg = new Package({
            targetPath,
            storeDir,
            packageName,
            packageVersion
        })
        if(await pkg.exists()){
            await pkg.update()
        }else{
            await pkg.install()
        }
    }else {
        pkg = new Package({
            targetPath,
            packageName,
            packageVersion
        })
    }
    const rootFile = pkg.getRootFilePath();
    if(rootFile){
        try{
            const args = Array.from(arguments)
            const cmd = args[args.length - 1]
            const o = Object.create(null)
            Object.keys(cmd).forEach(key =>{
                if(
                    cmd.hasOwnProperty(key) &&
                    !key.startsWith('_') &&
                    key!=='parent'
                ){
                    o[key]=cmd[key]
                }
            })
            args[args.length - 1] = o
            const code = `require('${rootFile}').call(null,${JSON.stringify(args)})`
            const child = spawn('node',['-e', code],{
                cwd:process.cwd(),
                stdio:'inherit'
            })
            child.on('error',e=>{
                log.error(e.message)
                process.exit(1)
            })
            child.on('exit',e => {
                log.verbose('命令执行成功:'+e)
                process.exit(e)
            })
        }catch(e){
            log.error(e.message)
        }
    }
}

module.exports = exec;