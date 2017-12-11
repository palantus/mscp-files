"use strict"

const guid = require("guid")
const moment = require("moment")
const AccessTokenManager = require("mscp-accesstokens");
const fs = require("fs")
const path = require("path")
const md5File = require('md5-file/promise')
const md5 = require('md5')
const mime = require('mime-types')

class Handler{

  async initFirst(){
    this.global.accessManager = new AccessTokenManager({secret: this.mscp.setupHandler.setup.accessTokenSecret, alwaysFullAccess: this.mscp.setupHandler.setup.useAccessTokens !== true})
    this.global.setup = await new Promise((r) => fs.readFile(path.join(__dirname, "setup.json"), "utf-8", (err, file) => r(JSON.parse(file))))

    if(!this.global.setup.baseurl)
      this.global.setup.baseurl = "http://localhost"

    this.global.hashToPath = {}
    this.global.hashToSubFiles = {}
    this.global.hashToFilename = {}
    this.global.hashToSubFolders = {}
    this.global.hashToParentFolder = {}

    this.reindex()
  }

  async reindex(){
    let hashToPath = {}
    let hashToSubFiles = {}
    let hashToSubFolders = {}
    let hashToFilename = {}
    let hashToParentFolder = {}

    let folders = this.global.setup.folders || {}
    for(let folderName in folders){
      let folder = path.resolve(folders[folderName])
      let rootFolderNumParts = folder.split("/").length
      this.global.setup.folders[folderName] = folder

      let files = await this.getAllFilesOfDir(folder)
      for(let file of files){
        //let id = await md5File(file)

        let parts = file.split("/")
        let curPath = `/${folderName}`
        let prevPath = curPath
        let curPathHash = md5(prevPath)
        let prevPathHash = curPathHash

        hashToPath[curPathHash] = curPath

        for(let i = rootFolderNumParts; i <= parts.length - 1; i++){
          curPath += "/" + parts[i]

          //console.log(`${i}, ${rootFolderNumParts}, ${file}, ${curPath}, ${parts[parts.length - 1]}`)

          curPathHash = md5(curPath)

          if(hashToPath[curPathHash] === undefined){
            if(i == parts.length - 1){
              if(hashToSubFiles[prevPathHash] === undefined)
                hashToSubFiles[prevPathHash] = []
              if(hashToSubFiles[prevPathHash].indexOf(curPathHash) < 0)
                hashToSubFiles[prevPathHash].push(curPathHash)
            } else {
              if(hashToSubFolders[prevPathHash] === undefined)
                hashToSubFolders[prevPathHash] = []
              if(hashToSubFolders[prevPathHash].indexOf(curPathHash) < 0)
                hashToSubFolders[prevPathHash].push(curPathHash)
            }

            hashToParentFolder[curPathHash] = prevPathHash
            hashToFilename[curPathHash] = parts[i]
            hashToPath[curPathHash] = curPath
          }

          prevPath = curPath
          prevPathHash = curPathHash
        }
      }
    }

    this.global.hashToPath = hashToPath
    this.global.hashToSubFiles = hashToSubFiles
    this.global.hashToFilename = hashToFilename
    this.global.hashToSubFolders = hashToSubFolders
    this.global.hashToParentFolder = hashToParentFolder
  }

  async download(hash){
    if(this.global.hashToPath[hash] === undefined)
      throw "Unknown file"

    let filename = this.virtualPathToReal(this.global.hashToPath[hash]);
    let isFile = await new Promise((r) => fs.lstat(filename, (err, stats) => r(stats.isFile(filename))))
    if(!isFile)
      throw `${hash} is a directory`

    return {name: this.global.hashToFilename[hash], path: filename}
  }

  async raw(hash){
    if(this.global.hashToPath[hash] === undefined)
      throw "Unknown file"

    let filename = this.virtualPathToReal(this.global.hashToPath[hash]);
    let isFile = await new Promise((r) => fs.lstat(filename, (err, stats) => r(stats.isFile(filename))))
    if(!isFile)
      throw `${hash} is a directory`

    this.request.res.sendFile(filename)
  }

  async file(id){
    if(this.global.hashToFilename[id] === undefined)
      throw "Unknown file"

    return {
      id: id,
      filename: this.global.hashToFilename[id],
      path: this.global.hashToPath[id],
      md5: await md5File(this.virtualPathToReal(this.global.hashToPath[id])),
      mime: mime.lookup(this.global.hashToFilename[id]),
      links: {
        raw: `${this.global.setup.baseurl}/api/raw/${id}`,
        download: `${this.global.setup.baseurl}/api/download/${id}`,
        self: `${this.global.setup.baseurl}/api/file/${id}`
      }
    }
  }

  async folder(hashOrPath){
    let hash = "";
    if(this.global.hashToPath[hashOrPath])
      hash = hashOrPath
    else {
      hash = hashOrPath.startsWith("/") ? md5(hashOrPath) : md5("/"+hashOrPath)

      if(this.global.hashToPath[hash] === undefined)
        throw "Unknown folder: " + hashOrPath
    }

    hash = hash || md5("")

    let files = []
    let folders = []

    for(let fhash of this.global.hashToSubFiles[hash] || []){
      files.push({hash: fhash, filename: this.global.hashToFilename[fhash], link: `${this.global.setup.baseurl}/api/file/${fhash}`})
    }
    for(let fhash of this.global.hashToSubFolders[hash] || []){
      folders.push({hash: fhash, filename: this.global.hashToFilename[fhash], link: `${this.global.setup.baseurl}/api/folder/${fhash}`})
    }

    return {
      id: hash,
      parentHash: this.global.hashToParentFolder[hash],
      path: this.global.hashToPath[hash],
      files: files,
      folders: folders,
      links: {
        parent: this.global.hashToParentFolder[hash] !== undefined ? `${this.global.setup.baseurl}/api/folder/${this.global.hashToParentFolder[hash]}` : null,
        self: `${this.global.setup.baseurl}/api/folder/${hash}`
      }
    }
  }

  async diagnostics(){ //TODO: remove
    return {
      hashToPath: this.global.hashToPath,
      hashToSubFiles: this.global.hashToSubFiles,
      hashToFilename: this.global.hashToFilename,
      hashToSubFolders: this.global.hashToSubFolders,
      hashToParentFolder: this.global.hashToParentFolder
    }
  }

  async folderContent(hash){

  }

  async getAllFilesOfDir(path){
    const { promisify } = require('util');
    const { resolve } = require('path');
    const fs = require('fs');
    const readdir = promisify(fs.readdir);
    const rename = promisify(fs.rename);
    const stat = promisify(fs.stat);

    async function getFiles(dir) {
      const subdirs = await readdir(dir);
      const files = await Promise.all(subdirs.map(async (subdir) => {
        const res = resolve(dir, subdir);
        return (await stat(res)).isDirectory() ? getFiles(res) : res;
      }));
      return files.reduce((a, f) => a.concat(f), []);
    }

    return await getFiles(path)
  }

  async upload(path){
    let files = []
    for(let filedef in this.request.req.files){
      let file = this.request.req.files[filedef]
      let realPath = this.virtualPathToReal(path)
      let exists = await new Promise((r) => fs.access(realPath, fs.constants.R_OK | fs.constants.W_OK, (err) => r(err?false:true)))
      if(exists){
        file.mv(realPath + "/" + file.name)
      }
      files.push(this.realPathToVirtual(realPath + "/" + file.name))
    }

    await this.reindex(); //TODO: nok for ineffektivt

    let ret = []
    for(let f of files){
      console.log(f)
      ret.push(await this.file(md5(f)))
    }
    return ret
  }

  virtualPathToReal(path){
    path = path.startsWith("/") ? path : "/" + path
    path = (path.endsWith("/") && path.length > 1) ? path.substring(0, path.length - 1) : path
    let rootName = path.split("/")[1]

    if(this.global.setup.folders[rootName] !== undefined){
      let remainingPath = path.substring(1).indexOf("/") > 0 ? path.substring(path.substring(1).indexOf("/") + 1) : ""
      return this.global.setup.folders[rootName] + remainingPath
    } else {
      throw "Unknown folder"
    }
  }

  realPathToVirtual(path){
    console.log(path)
    for(let folderName in this.global.setup.folders){
      let fpath = this.global.setup.folders[folderName]
      if(path.startsWith(fpath)){
        if(path == fpath)
          return "/" + folderName
        else
          return `/${folderName}/${path.substring(fpath.length + 1)}`
      }
    }
    throw "Unknown real path: " + path
  }

  validateAccessToFile(id, requireWrite){
    this.global.accessManager.validateAccessReadWriteThrow(this.request.data.accessToken, id, requireWrite)
  }
}

module.exports = Handler
