'use strict';

const path = require('path');
const fse = require('fs-extra');
const pkgDir = require('pkg-dir').sync;
const pathExists = require('path-exists').sync;
const npminstall = require('npminstall');
const {isObject} = require('@harry-cli-dev/utils');
const formatPath = require('@harry-cli-dev/format-path');
const { getDefaultRegistry, getNpmLatestVersion } = require('@harry-cli-dev/get-npm-info');

class Package {
    constructor(options){
        if(!options){
            throw new Error('Package类的options参数不能为空！');
        }
        if(!isObject(options)){
            throw new Error('Package类的options参数必须为对象！');
        }
        this.targetPath = options.targetPath;

        this.storeDir = options.storeDir;

        this.packageName = options.packageName;

        this.packageVersion = options.packageVersion;

        this.cacheFilePathPrefix = this.packageName.replace('/','_');
    }
    async prepare(){
        if(this.storeDir && !pathExists(this.storeDir)){
            fse.mkdirpSync(this.storeDir);
        }
        if(this.packageVersion === 'latest'){
            this.packageVersion = await getNpmLatestVersion(this.packageName);
        }
    }
    get cacheFilePath(){
        return path.resolve(this.storeDir,`_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`)
    }
    getSpecificCacheFilePath(packageVersion){
        return path.resolve(this.storeDir,`_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`)
    }
    async exists(){
        if(this.storeDir){
            await this.prepare();
            return fse.pathExists(this.cacheFilePath)
        }else{
            return pathExists(this.targetPath)
        }
    }
    async install(){
        await this.prepare();
        return npminstall({
            root:this.targetPath,
            storeDir:this.storeDir,
            registry:getDefaultRegistry(),
            pkgs:[{
                name:this.packageName,
                version:this.packageVersion
            }]
        })
    }
    async update(){
        await this.prepare();
        const latestPackageVersion = await getNpmLatestVersion(this.packageName);
        const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion);
        if(!pathExists(latestFilePath)){
            await npminstall({
                root:this.targetPath,
                storeDir:this.storeDir,
                registry:getDefaultRegistry(),
                pkgs:[{
                    name:this.packageName,
                    version:latestPackageVersion
                }]
            })
            this.packageVersion=latestPackageVersion
        }else{
            this.packageVersion=latestPackageVersion
        }
    }
    getRootFilePath(){
        function _getRootFile(targetPath){
            const dir = pkgDir(targetPath);
            if(dir){
                const pkgFile = require(path.resolve(dir,'package.json'));
                if(pkgFile && pkgFile.main){
                    return formatPath(path.resolve(dir,pkgFile.main))
                }
            }
            return null;
        }
        if(this.storeDir){
            return _getRootFile(this.cacheFilePath)
        }else{
            return _getRootFile(this.targetPath)
        }
    }
}

module.exports=Package
