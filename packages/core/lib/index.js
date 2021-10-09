'use strict';

const pkg = require('../package.json')
const log = require('@harry-cli-dev/log')
const path = require('path')
const semver = require('semver')
const colors = require('colors/safe')
const userHome = require('user-home')
const pathExists = require('path-exists').sync
const commander = require('commander')
const exec = require('@harry-cli-dev/exec')
const constant = require('./const')

const program = new commander.Command()

async function core(){
    try{
        await prepare()
        registryCommand()
    }catch(e){
        log.error(e.message)
        if(program.debug){
            console.log(e)
        }
    }
}
function registryCommand(){
    program
        .name(Object.keys(pkg.bin)[0])
        .usage('<command> [options]')
        .version(pkg.version)
        .option('-d, --debug', '是否开启调试模式', false)
        .option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '');
    
    program
        .command('init [projectName]')
        .option('-f, --force', '是否强制初始化项目')
        .action(exec)

    program
        .command('publish')
        .action(exec)

    program.on('option:debug',function(){
        if(program.debug){
            process.env.LOG_LEVEL = 'verbose'
        }else{
            process.env.LOG_LEVEL = 'info'
        }
        log.level = process.env.LOG_LEVEL
    })
    program.on('option:targetPath',function(){
        process.env.CLI_TARGET_PATH = program.targetPath
    })
    program.on('command:*',function(obj){
        const availableCommands = program.commands.map(cmd=>cmd.name())
        console.log(colors.red('未知的命令：'+obj[0]))
        if(availableCommands.length>0){
            console.log(colors.red('可用的命令：'+availableCommands.join(',')))
        }
    })
    program.parse(process.argv)

    if(program.argv && program.argv.length < 1){
        program.outputHelp()
        console.log()
    }
}

async function prepare(){
    checkPkgVersion()
    checkRoot()
    checkUserHome()
    checkEnv()
    await checkGlobalUpdate()
}

async function checkGlobalUpdate(){
    const currentVersion = pkg.version
    const npmName = pkg.name
    const {getNpmSemverVersion} = require('@harry-cli-dev/get-npm-info')
    const latestVersion = await getNpmSemverVersion(currentVersion,npmName)
    if(latestVersion && semver.gt(latestVersion,currentVersion)){
        log.warn(colors.yellow(
            `
            请手动更新${npmName},当前版本${currentVersion}，最新版本${latestVersion}
            更新命令：npm install -g ${npmName}
            `
        ))
    }
}

function checkEnv(){
    const dotenv = require('dotenv')
    const dotenvPath = path.resolve(userHome, '.env')
    if(pathExists(dotenvPath)){
        dotenv.config({
            path:dotenvPath
        })
    }
    createDefaultConfig()
}

function createDefaultConfig(){
    const cliConfig ={
        home:userHome
    }
    if(process.env.CLI_HOME){
        cliConfig['cliHome']=path.join(userHome, process.env.CLI_HOME)
    }else{
        cliConfig['cliHome']=path.join(userHome,constant.DEFAULT_CLI_HOME)
    }
    process.env.CLI_HOME_PATH = cliConfig.cliHome
}

function checkUserHome(){
    if(!userHome || !pathExists(userHome)){
        throw new Error(colors.red('当前登录用户主目录不存在！'))
    }
}

function checkRoot(){
    const rootCheck = require('root-check')
    rootCheck()
}

function checkPkgVersion(){
    log.info('cli', pkg.version)
}

module.exports = core