'use strict';

const fs = require('fs');
const path = require('path');
const inquire = require('inquirer');
const fse = require('fs-extra');
const glob = require('glob');
const ejs = require('ejs');
const semver = require('semver');
const useHome = require('user-home');
const Command = require('@harry-cli-dev/command');
const Package = require('@harry-cli-dev/package');
const log = require('@harry-cli-dev/log');
const { spinnerStart, sleep, execAsync } = require('@harry-cli-dev/utils')

const getProjextTemplate = require('./getProjextTemplate');
const inquirer = require('inquirer');

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'

const TEMPLATE_TYPE_NORMAL = 'normal'
const TEMPLATE_TYPE_CUSTOM = 'custom'

const WHITE_COMMAND = ['npm', 'cnpm']

class InitCommand extends Command {
    init(){
        this.projectName = this._argv[0] || '';
        this.force = !!this._cmd.force;
        log.verbose('projectName', this.projectName)
        log.verbose('force', this.force)
    }
    async exec(){
        try{
            const projectInfo = await this.prepare();
            if(projectInfo){
                log.verbose('projectInfo', projectInfo);
                this.projectInfo = projectInfo;
                await this.downloadTemplate();
                await this.installTemplate()
            }
        }catch(e){
            log(e.message)
            if(process.env.LOG_LEVEL === 'verbose'){
                console.log(e)
            }
        }
    }
    async installTemplate(){
        log.verbose('templateInfo', this.templateInfo);
        if(this.templateInfo){
            if(!this.templateInfo.type){
                this.templateInfo.type = TEMPLATE_TYPE_NORMAL
            }
            if(this.templateInfo.type === TEMPLATE_TYPE_NORMAL){
                await this.installNormalTemplate();

            }else if(this.templateInfo.type === TEMPLATE_TYPE_CUSTOM){
                await this.installCustomTemplate()
            }else {
                throw new Error('无法识别项目模板！')
            }
        }else{
            throw new Error('项目模板信息不存在！')
        }
    }
    checkCommand(cmd){
        if(WHITE_COMMAND.includes(cmd)){
            return cmd
        }
        return null
    }
    async execCommand(command, errMsg){
        let ret;
        if(command){
            const cmdArray = command.split(' ');
            const cmd = this.checkCommand(cmdArray[0])
            if(!cmd){
                throw new Error('命令不存在！命令：'+command)
            }
            const args = cmdArray.slice(1)
            ret = await execAsync(cmd, args, {
                stdio: 'inherit',
                cmd: process.cwd()
            })
        }
        if(ret !== 0){
            throw new Error(errMsg)
        }
        return ret;
    }
    async ejsRender(options){
        const dir = process.cwd();
        const projectInfo = this.projectInfo;
        return new Promise((resolve,reject)=>{
            glob('**', {
                cwd:dir,
                ignore:options.ignore || '',
                nodir:true
            },function(err,files){
                if(err){
                    reject(err)
                }
                Promise.all(files.map(file=>{
                    const filePath = path.join(dir, file);
                    return new Promise((resolve1,reject1)=>{
                        ejs.renderFile(filePath, projectInfo, {}, (err, result)=>{
                            if(err){
                                reject1(err)
                            }else{
                                fse.writeFileSync(filePath, result)
                                resolve1(result)
                            }
                        })
                    })
                })).then(()=>{
                    resolve()
                }).catch(()=>{
                    reject()
                })
            })
        })
    }
    async installNormalTemplate(){
        log.verbose('templateNpm', this.templateNpm);
        let spinner = spinnerStart('正在安装模版...');
        await sleep();
        try{
            const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
            const targetPath = process.cwd();
            fse.ensureDirSync(templatePath);
            fse.ensureDirSync(targetPath);
            fse.copySync(templatePath,targetPath);
        }catch(e){
            throw e
        }finally{
            spinner.stop(true)
            log.success('模版安装成功')
        }
        const templateIgnore = this.templateInfo.ignore || [];
        const ignore = ['**/node_modules/**', ...templateIgnore];
        await this.ejsRender({ignore});
        const {installCommand, startCommand} = this.templateInfo;
        await this.execCommand(installCommand, '依赖安装失败！');
        await this.execCommand(startCommand, '启动执行命令失败！')
    }
    async installCustomTemplate(){
        if(await this.templateNpm.exists()){
            const rootFile = this.templateNpm.getRootFilePath();
            if(fs.existsSync(rootFile)){
                log.notice('开始执行自定义模版');
                const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
                const options = {
                    templateInfo: this.templateInfo,
                    projectInfo: this.projectInfo,
                    sourcePath: templatePath,
                    targetPath: process.cwd()
                }
                const code = `require('${rootFile}')(${JSON.stringify(options)})`;
                log.verbose('code', code);
                await execAsync('node', ['-e', code], {stdio:'inherit', cwd: process.cwd()})
                log.success('自定义模版安装成功！')
            }else{
                throw new Error('自定义模版入口文件不存在！')
            }
        }
    }
    async downloadTemplate(){
        const {projectTemplate} =this.projectInfo
        const templateInfo = this.template.find(item => item.npmName === projectTemplate);
        const targetPath = path.resolve(userHome,'.harry-cli-dev','template');
        const storeDir = path.resolve(userHome, '.harry-cli-dev', 'template', 'node_modules');
        const {npmName, version}= templateInfo;
        this.templateInfo=templateInfo
        const templateNpm = new Package({
            targetPath,
            storeDir,
            packageName:npmName,
            packageVersion:version
        });
        if(!await templateNpm.exists()){
            const spinner = spinnerStart('正在下载模版...');
            await sleep();
            try{
                await templateNpm.install()
            }catch(e){
                throw e
            }finally{
                spinner.stop(true);
                if(await templateNpm.exists()){
                    log.success('下载模版成功')
                    this.templateNpm = templateNpm
                }
            }
        }else{
            const spinner = spinnerStart('正在更新模版...')
            await sleep()
            try{
                templateNpm.update()
            }catch(e){
                throw e
            }finally{
                spinner.stop(true)
                if(await templateNpm.exists()){
                    log.success('更新模版成功')
                    this.templateNpm=templateNpm
                }
            }
        }
    }
    async prepare(){
        const template = await getProjextTemplate();
        if(!template || template.length === 0){
            throw new Error('项目模版不存在')
        }
        this.template = template;
        const localPath = process.cwd();
        if(!this.isDirEmpty(localPath)){
            let ifContinue = false;
            if(!this.force){
                ifContinue = (await inquire.prompt({
                    type:'confirm',
                    name:'isContinue',
                    default:false,
                    message:'当前文件夹不为空，是否继续创建项目？',
                })).ifContinue;
                if(!ifContinue){
                    return 
                }
            }
            if(ifContinue || this.force){
                const {confirmDelete}= await inquire.prompt({
                    type:'confirm',
                    name:'confirmDelete',
                    default:false,
                    message:'是否清空当前目录下的文件？'
                })
                if(confirmDelete){
                    fse.emptyDirSync(localPath)
                }
            }
        }
        return this.getProjectInfo()
    }
    async getProjectInfo(){
        function isValidName(v){
            return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)
        }
        let projectInfo = {}
        let isProjectNameValid = false
        if(isValidName(this.projectName)){
            isProjectNameValid = true
            projectInfo.projectName=this.projectName
        }
        const {type}= await inquirer.prompt({
            type:'list',
            name:'type',
            message:'请选择初始化类型',
            default:TYPE_PROJECT,
            choices:[{
                name:'项目',
                value:TYPE_PROJECT,
            },{
                name:'组件',
                value:TYPE_COMPONENT,
            }]
        })
        log.verbose('type',type)
        this.template = this.template.filter(template=>template.tag.includes(type));
        const title = type === TYPE_PROJECT?'项目':'组件';
        const projextNamePrompt = {
            type:'input',
            name:'projectName',
            message:`请输入${title}名称`,
            default:'',
            validate: function(v){
                const done = this.async();
                setTimeout(function(){
                    if(!isValidName(v)){
                        done(`请输入合法的${title}名称`)
                        return
                    }
                    done(null,true)
                },0)
            },
            filter:function(v){
                return v
            }
        }
        const projectPrompt = [];
        if(!isProjectNameValid){
            projectPrompt.push(projextNamePrompt)
        }
        projectPrompt.push({
            type:'input',
            name:'projectVersion',
            message:`请输入${title}版本号`,
            default:'1.0.0',
            validate:function(v){
                const done = this.async()
                setTimeout(()=>{
                    if(!(!!semver.valid(v))){
                        done('请输入合法的版本号');
                        return 
                    }
                    done(null,true)
                },0)
            },
            filter:function(v){
                if(!!semver.valid(v)){
                    return semver.valid(v)
                }else{
                    return v
                }
            }
        },{
            type:'list',
            name:'projectTemplate',
            message:`请选择${title}模板`,
            choices:this.createTemplateChoice()
        })
        if(type=== TYPE_PROJECT){
            const project = await inquirer.prompt(projectPrompt)
            projectInfo ={
                ...projectInfo,
                type,
                ...project
            }
        }else if(type === TYPE_COMPONENT){
            const descriptionPrompt = {
                type:'input',
                name:'componentDescription',
                message:'请输入组件描述信息',
                default:'',
                validate:function(v){
                    const done= this.async()
                    setTimeout(function(){
                        if(!v){
                            done('请输入组件描述信息')
                            return 
                        }
                        done(null,true)
                    },0)
                }
            }
            projectPrompt.push(descriptionPrompt)
            const component = await inquirer.prompt(projectPrompt)
            projectInfo = {
                ...projectInfo,
                type,
                ...component
            }
        }
        if(projectInfo.projectName){
            projectInfo.name=projectInfo.projectName
            projectInfo.className=require('kebab-case')(projectInfo.projectName).replace(/^-/,'')
        }
        if(projectInfo.projectVersion){
            projectInfo.version= projectInfo.projectVersion
        }
        if(projectInfo.componentDescription){
            projectInfo.description=projectInfo.componentDescription
        }
        return projectInfo
    }
    isDirEmpty(localPath){
        let filePath = fs.readdirSync(localPath)
        fileList= fileList.filter(file=>{
            !file.startsWith('.') && ['node_modules'].indexOf(file)<0
        })
        return !filePath || fileList.length<=0
    }
    createTemplateChoice(){
        return this.template.map(tem=>({
            value:item.npmName,
            name:item.name
        }))
    }
}


function init(argv){
    return new InitCommand(argv)
}
module.exports = init
module.exports.InitCommand=InitCommand